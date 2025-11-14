from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from conexion import conectar_db
from config import configurar_cors
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from endpoints import (
    endpointActividades,
    endpointAdministradores,
    endpointNoticias,
    endpointProyectos,
    endpointReserva,
    endpointBiometria,
    endpointCertificados,   
    endpointNotificaciones,
    endpointUV,  
)
from datetime import date
from fastapi import Depends, Header
from fastapi.routing import APIRoute
import math, json

# JWT utils (acepta nombres en español o inglés)
try:
    from jwt.jwt_utils import crear_access_token, verificar_access_token
except ImportError:
    from jwt.jwt_utils import create_access_token as crear_access_token, verify_token as verificar_access_token


app = FastAPI(title="API Junta de Vecinos")
configurar_cors(app)

# Middleware de logging simple para depurar CORS/errores
@app.middleware("http")
async def log_requests(request, call_next):
    origin = request.headers.get("origin")
    method = request.method
    path = request.url.path
    response = await call_next(request)
    # Intenta leer header CORS en respuesta
    acao = response.headers.get("access-control-allow-origin")
    # Usa print simple para consola uvicorn
    print(f"[REQ] {method} {path} origin={origin} -> {response.status_code} acao={acao}")
    return response

# =========================
# Routers
# =========================
app.include_router(endpointActividades.router)
app.include_router(endpointAdministradores.router)
app.include_router(endpointNoticias.router)
app.include_router(endpointProyectos.router)
app.include_router(endpointReserva.router)
app.include_router(endpointBiometria.router)
app.include_router(endpointCertificados.router)
app.include_router(endpointNotificaciones.router)
app.include_router(endpointUV.router) 



def obtener_usuario_actual(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token inválido")
    token = authorization.split(" ")[1]
    payload = verificar_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")
    return payload

# NUEVO: dependencia simple para extraer id_uv desde el JWT
def get_admin_uv(authorization: str = Header(None)) -> int | None:
    # Devuelve None si no hay token o es inválido, para que los endpoints puedan responder vacío en lugar de 401
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = verificar_access_token(token)
    if not payload:
        return None

    # 1) si viene en el token, úsalo
    uv_claim = payload.get("id_uv")
    if uv_claim is not None:
        try:
            return int(uv_claim)
        except Exception:
            return None

    # 2) fallback: consulta a la BD por el usuario (sub) y, si es necesario, por su vecino o rut
    user_id = payload.get("sub")
    if not user_id:
        return None
    db = conectar_db()
    if db is None:
        # sin id_uv y sin DB: no se puede derivar; devolver None para negar acceso a datos sensibles
        return None
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT id_uv, id_vecino, rut FROM usuarios WHERE id_usuario = %s", (user_id,))
        row = cur.fetchone() or {}
        if row.get("id_uv") is not None:
            return int(row["id_uv"])
        # intenta por id_vecino
        if row.get("id_vecino") is not None:
            cur.execute("SELECT id_uv FROM vecinos WHERE id_vecino = %s", (row["id_vecino"],))
            v = cur.fetchone()
            if v and v.get("id_uv") is not None:
                return int(v["id_uv"])
        # intenta por rut (desde usuarios o token)
        rut = row.get("rut") or payload.get("rut")
        if rut:
            cur.execute("SELECT id_uv FROM vecinos WHERE rut = %s LIMIT 1", (rut,))
            v2 = cur.fetchone()
            if v2 and v2.get("id_uv") is not None:
                return int(v2["id_uv"])
        # no hay id_uv: devolver None para que los endpoints puedan decidir (p. ej., 1=0)
        return None
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass

def validar_rut(rut: str) -> bool:
    rut = rut.replace('.', '').replace('-', '')
    if not rut[:-1].isdigit():
        return False
    cuerpo = rut[:-1]
    dv = rut[-1].upper()
    suma = 0
    multiplo = 2
    for c in reversed(cuerpo):
        suma += int(c) * multiplo
        multiplo = multiplo + 1 if multiplo < 7 else 2
    resto = suma % 11
    dv_esperado = 'K' if (11 - resto) == 10 else '0' if (11 - resto) == 11 else str(11 - resto)
    return dv == dv_esperado

# =========================
# Endpoints utilitarios
# =========================
@app.get("/__routes")
def list_routes():
    return sorted([r.path for r in app.routes if isinstance(r, APIRoute)])

# Diagnóstico: conteo rápido de tablas y por id_uv del token (si viene)
@app.get("/__counts")
def counts(authorization: str | None = Header(None)):
    db = conectar_db()
    if db is None:
        return {"ok": False, "error": "sin DB"}
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT COUNT(*) AS c FROM vecinos")
        vecinos_total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) AS c FROM noticias")
        noticias_total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) AS c FROM proyectos")
        proyectos_total = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) AS c FROM reservas")
        reservas_total = cur.fetchone()["c"]

        id_uv = None
        rol = None
        if authorization and authorization.startswith("Bearer "):
            payload = verificar_access_token(authorization.split(" ", 1)[1])
            if payload:
                rol = payload.get("rol")
                uv_claim = payload.get("id_uv")
                try:
                    id_uv = int(uv_claim) if uv_claim is not None else None
                except Exception:
                    id_uv = None

        uv_counts = None
        if id_uv is not None:
            cur.execute("SELECT COUNT(*) AS c FROM vecinos WHERE id_uv=%s", (id_uv,))
            vecinos_uv = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM noticias WHERE id_uv=%s", (id_uv,))
            noticias_uv = cur.fetchone()["c"]
            cur.execute("SELECT COUNT(*) AS c FROM proyectos WHERE id_uv=%s", (id_uv,))
            proyectos_uv = cur.fetchone()["c"]
            # reservas puede tener id_uv en r o inferido por vecino
            cur.execute(
                """
                SELECT COUNT(*) AS c
                FROM reservas r
                LEFT JOIN vecinos v ON r.id_vecino = v.id_vecino
                WHERE COALESCE(r.id_uv, v.id_uv) = %s
                """,
                (id_uv,)
            )
            reservas_uv = cur.fetchone()["c"]
            uv_counts = {
                "id_uv": id_uv,
                "vecinos": vecinos_uv,
                "noticias": noticias_uv,
                "proyectos": proyectos_uv,
                "reservas": reservas_uv,
            }

        return {
            "ok": True,
            "role": rol,
            "totals": {
                "vecinos": vecinos_total,
                "noticias": noticias_total,
                "proyectos": proyectos_total,
                "reservas": reservas_total,
            },
            "uv": uv_counts,
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass

# =========================
# Helpers geoespaciales para UV
# =========================
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def min_vertex_distance(gj_str, p_lat, p_lon):
    try:
        gjson = json.loads(gj_str or "{}")
    except:
        return float("inf")
    t = gjson.get("type")
    if t not in ("Polygon", "MultiPolygon"):
        return float("inf")
    dmin = float("inf")
    if t == "Polygon":
        for ring in gjson.get("coordinates", []):
            for lonv, latv in ring:
                dmin = min(dmin, haversine_m(p_lat, p_lon, latv, lonv))
    else:
        for poly in gjson.get("coordinates", []):
            for ring in poly:
                for lonv, latv in ring:
                    dmin = min(dmin, haversine_m(p_lat, p_lon, latv, lonv))
    return dmin

def resolver_id_uv_por_punto(cursor, lat: float | None, lon: float | None) -> int | None:
    if lat is None or lon is None:
        return None
    wkt = f"POINT({lon} {lat})"
    # 1) Dentro del polígono
    cursor.execute("""
        SELECT id_uv
        FROM juntas_vecinos
        WHERE ST_Contains(geom, ST_GeomFromText(%s, ST_SRID(geom)))
        LIMIT 1
    """, (wkt,))
    row = cursor.fetchone()
    if row:
        return row["id_uv"]
    # 2) Más cercana por vértices
    cursor.execute("""SELECT id_uv, ST_AsGeoJSON(geom) AS gj FROM juntas_vecinos""")
    polys = cursor.fetchall() or []
    best_id, best_d = None, float("inf")
    for r in polys:
        d = min_vertex_distance(r["gj"], lat, lon)
        if d < best_d:
            best_d, best_id = d, r["id_uv"]
    return best_id




def _get_payload(authorization: str | None):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    return verificar_access_token(token) or None

@app.get("/me/id_uv")
def me_id_uv(authorization: str | None = Header(None)):
    payload = _get_payload(authorization)
    print(payload.get("id_uv"))

    if not payload:
        return {"id_uv": None}

    # 1) si viene directo en el token
    if payload.get("id_uv") is not None:
        try:
            return {"id_uv": int(payload["id_uv"])}
        except Exception:
            pass

    db = conectar_db()
    if db is None:
        return {"id_uv": None}
    cur = db.cursor(dictionary=True)
    try:
        # 2) por sub (id_usuario) -> usuarios -> (id_uv o id_vecino) -> vecinos
        sub = payload.get("sub")
        if sub is not None:
            cur.execute("SELECT id_uv, id_vecino FROM usuarios WHERE id_usuario=%s", (sub,))
            u = cur.fetchone() or {}
            if u.get("id_uv") is not None:
                return {"id_uv": int(u["id_uv"])}
            if u.get("id_vecino") is not None:
                cur.execute("SELECT id_uv FROM vecinos WHERE id_vecino=%s", (u["id_vecino"],))
                v = cur.fetchone()
                if v and v.get("id_uv") is not None:
                    return {"id_uv": int(v["id_uv"])}

        # 3) por rut -> usuarios (mejor) -> vecinos; si no, directo a vecinos
        rut = payload.get("rut")
        if rut:
            cur.execute("SELECT id_uv, id_vecino FROM usuarios WHERE rut=%s", (rut,))
            u2 = cur.fetchone() or {}
            if u2.get("id_uv") is not None:
                return {"id_uv": int(u2["id_uv"])}
            if u2.get("id_vecino") is not None:
                cur.execute("SELECT id_uv FROM vecinos WHERE id_vecino=%s", (u2["id_vecino"],))
                v2 = cur.fetchone()
                if v2 and v2.get("id_uv") is not None:
                    return {"id_uv": int(v2["id_uv"])}
            # último intento: rut directo en vecinos
            cur.execute("SELECT id_uv FROM vecinos WHERE rut=%s LIMIT 1", (rut,))
            v3 = cur.fetchone()
            if v3 and v3.get("id_uv") is not None:
                return {"id_uv": int(v3["id_uv"])}

        return {"id_uv": None}
    finally:
        try: cur.close()
        except: pass
        try: db.close()
        except: pass
# =========================
# Modelos Pydantic
# =========================

class Vecino(BaseModel):
    nombre: str 
    apellido: str
    rut: str
    correo: EmailStr
    numero_telefono: str
    direccion: str
    contrasena: str
    miembro: int = 0
    fecha_nacimiento: Optional[int] = None  
    # nuevos: coordenadas opcionales para resolver UV
    lat: Optional[float] = None  # <-- agregado
    lon: Optional[float] = None  # <-- agregado

    @field_validator('rut')
    def validar_y_formatear_rut(cls, v):
        rut_limpio = v.replace('.', '').replace('-', '')
        if not validar_rut(rut_limpio):
            raise ValueError("RUT inválido.")
        rut_num, dv = rut_limpio[:-1], rut_limpio[-1]
        rut_formateado = f"{int(rut_num):,}".replace(",", ".") + '-' + dv
        return rut_formateado

class VecinoUpdate(BaseModel):
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    rut: Optional[str] = None
    correo: Optional[str] = None
    fecha_nacimiento: Optional[int] = None
    numero_telefono: Optional[str] = None
    direccion: Optional[str] = None
    miembro: Optional[bool] = None
    contrasena: Optional[str] = None


class LoginRequest(BaseModel):
    rut: str
    contrasena: str


class RegistroIdentidad(BaseModel):
    # Se usa tras verificación biométrica en el frontend
    nombre: str
    apellido: str
    rut: str
    correo: EmailStr
    numero_telefono: str
    direccion: str
    contrasena: str
    miembro: int = 0


# =========================
# Endpoints
# =========================
@app.get("/")
def read_root():
    return {"message": "API Junta de Vecinos"}


#  handler de excepciones global para validaciones de Pydantic
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errores = []
    for error in exc.errors():
        campo = ".".join(str(x) for x in error["loc"] if x != "body")
        mensaje = error["msg"]
        errores.append(f"Error en '{campo}': {mensaje}")
    return JSONResponse(
        status_code=422, 
        content={"mensaje": "Datos inválidos en la solicitud", "errores": errores}
    )

#


# ---------- CRUD Vecinos (crea también usuario) ----------
@app.post("/vecinos/", tags=["CRUD vecinos"])
def crear_vecino(vecino: Vecino):
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    try:
        # validar edad minima
        if vecino.fecha_nacimiento:
            hoy = date.today()
            anio_nacimiento = vecino.fecha_nacimiento // 10000
            mes_nacimiento = (vecino.fecha_nacimiento % 10000) // 100
            dia_nacimiento = vecino.fecha_nacimiento % 100
            fecha_nac = date(anio_nacimiento, mes_nacimiento, dia_nacimiento)
            edad = hoy.year - fecha_nac.year - ((hoy.month, hoy.day) < (fecha_nac.month, fecha_nac.day))
            if edad < 14:
                raise HTTPException(status_code=400, detail="El vecino debe ser mayor de 14 años.")
        else:
            raise HTTPException(status_code=422, detail="El campo fecha_nacimiento es obligatorio")
        
        # Evitar duplicado de RUT en vecinos
        cursor.execute("SELECT 1 FROM vecinos WHERE rut = %s", (vecino.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como vecino.")

        # Resolver UV a partir de lat/lon (si vienen)
        id_uv = resolver_id_uv_por_punto(cursor, vecino.lat, vecino.lon)  # <-- agregado

        # Insertar vecino (incluye fecha_nacimiento e id_uv)
        sql_vecino = """
            INSERT INTO vecinos (nombre, apellido, rut, direccion, correo, numero_telefono, contrasena, miembro, fecha_nacimiento, id_uv)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        try:
            cursor.execute(sql_vecino, (
                vecino.nombre,
                vecino.apellido,
                vecino.rut,
                vecino.direccion,
                vecino.correo,
                vecino.numero_telefono,
                vecino.contrasena,  # ideal: hash
                vecino.miembro,
                vecino.fecha_nacimiento,
                id_uv  # <-- agregado
            ))
            db.commit()
        except Exception as e:
            # Detectar columna faltante en tablas MySQL y crearla automáticamente en entorno dev
            msg = str(e)
            if "Unknown column 'fecha_nacimiento'" in msg or "1054" in msg:
                try:
                    print("[DB] columna 'fecha_nacimiento' ausente: intentando agregar columna a 'vecinos'.")
                    cursor.execute("ALTER TABLE vecinos ADD COLUMN fecha_nacimiento INT NULL;")
                    db.commit()
                    # reintentar inserción
                    cursor.execute(sql_vecino, (
                        vecino.nombre,
                        vecino.apellido,
                        vecino.rut,
                        vecino.direccion,
                        vecino.correo,
                        vecino.numero_telefono,
                        vecino.contrasena,
                        vecino.miembro,
                        vecino.fecha_nacimiento,
                        id_uv
                    ))
                    db.commit()
                except Exception as e2:
                    print("[DB] fallo al intentar crear columna fecha_nacimiento o reinsertar:", e2)
                    raise HTTPException(status_code=500, detail="Error en la base de datos (crear fecha_nacimiento).")
            else:
                raise
        id_vecino = cursor.lastrowid

        # Evitar duplicado de usuario por RUT
        cursor.execute("SELECT 1 FROM usuarios WHERE rut = %s", (vecino.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como usuario.")

        # Crear usuario asociado (rol: vecino) incluyendo id_uv
        sql_usuario = """
            INSERT INTO usuarios (id_vecino, nombre, password_hash, rol, rut, id_uv)
            VALUES (%s, %s, %s, %s, %s, %s)
        """  # <-- modificado: agrega id_uv
        cursor.execute(sql_usuario, (
            id_vecino,
            vecino.nombre,
            vecino.contrasena,  # ideal: hash
            "vecino",
            vecino.rut,
            id_uv  # <-- agregado
        ))
        db.commit()
        id_usuario = cursor.lastrowid

        # Traer datos del usuario recién creado (incluye id_uv)
        cursor.execute(
            "SELECT id_usuario, id_vecino, id_uv, rol, rut, nombre FROM usuarios WHERE id_usuario = %s",
            (id_usuario,)
        )  # <-- modificado: incluye id_uv
        usuario = cursor.fetchone()

        return {
            "mensaje": "Vecino y usuario registrados exitosamente",
            "usuario": usuario
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.get("/vecinos/")
def obtener_todos_vecinos():
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM vecinos")
    vecinos = cursor.fetchall()
    cursor.close()
    db.close()
    return vecinos



@app.get("/vecinos/uv/{id_uv}", tags=["CRUD vecinos"])
def obtener_vecinos_por_uv(id_uv: int):
    db = conectar_db()
    if db is None:
        return []
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT * FROM vecinos WHERE id_uv = %s", (id_uv,))
        rows = cur.fetchall() or []
        try:
            print(f"[VECINOS_BY_UV] id_uv={id_uv} count={len(rows)}")
        except Exception:
            pass
        return rows
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass


@app.get("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def obtener_vecino(id_vecino: int):
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM vecinos WHERE id_vecino = %s", (id_vecino,))
    vecino = cursor.fetchone()
    cursor.close()
    db.close()
    if vecino:
        return vecino
    else:
        raise HTTPException(status_code=404, detail="Vecino no encontrado")


@app.put("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def actualizar_vecino(
    id_vecino: int,
    vecino: VecinoUpdate,
    usuario=Depends(obtener_usuario_actual)
):
    # Solo permite si el usuario es admin
    if usuario["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede modificar datos ")
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    campos = vecino.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
    set_clause = ", ".join([f"{k}=%s" for k in campos.keys()])
    sql = f"UPDATE vecinos SET {set_clause} WHERE id_vecino=%s"
    try:
        cursor.execute(sql, (*campos.values(), id_vecino))
        db.commit()
        cursor.execute("SELECT * FROM vecinos WHERE id_vecino=%s", (id_vecino,))
        vecino_actualizado = cursor.fetchone()
        return vecino_actualizado
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        db.close()

@app.delete("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def eliminar_vecino(id_vecino: int):
    db = conectar_db()
    cursor = db.cursor()
    try:
        cursor.execute("DELETE FROM vecinos WHERE id_vecino=%s", (id_vecino,))
        db.commit()
        return {"mensaje": "Vecino eliminado exitosamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        db.close()


# ---------- Login (incluye id_vecino en el token) ----------
@app.post("/login/", tags=["login"])
def login(request: LoginRequest):
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT * FROM usuarios WHERE rut = %s AND password_hash = %s",
            (request.rut, request.contrasena)
        )
        usuario = cursor.fetchone()
        if usuario:
            # Incluye id_usuario como sub, rol/rut e id_uv en el token (útil para filtrado en frontend)
            token = crear_access_token({
                "sub": usuario.get("id_vecino"),
                "rol": usuario["rol"],
                "rut": usuario["rut"],
                "id_uv": usuario.get("id_uv")

            })
            return {
                "access_token": token,
                "token_type": "bearer",
                "id_usuario": usuario["id_usuario"],
                "id_vecino": usuario.get("id_vecino"),
                "id_uv": usuario.get("id_uv"),
                "rol": usuario["rol"],
                "rut": usuario["rut"],
                "nombre": usuario["nombre"]
            }
        else:
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    finally:
        cursor.close()
        db.close()


# ---------- Registro final (tras biometría) ----------
# Si tu frontend ya hace la verificación biométrica, aquí solo se persiste vecino+usuario.
@app.post("/registro/identidad", tags=["Registro"])
def registro_identidad(data: RegistroIdentidad):
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    try:
        # Bloquear RUT duplicado en vecinos
        cursor.execute("SELECT 1 FROM vecinos WHERE rut = %s", (data.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como vecino.")

        # Insertar vecino
        sql_vecino = """
            INSERT INTO vecinos (nombre, apellido, rut, direccion, correo, numero_telefono, contrasena, miembro)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql_vecino, (
            data.nombre,
            data.apellido,
            data.rut,
            data.direccion,
            data.correo,
            data.numero_telefono,
            data.contrasena,   # ideal: hash
            data.miembro
        ))
        id_vecino = cursor.lastrowid

        # Bloquear RUT duplicado en usuarios
        cursor.execute("SELECT 1 FROM usuarios WHERE rut = %s", (data.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como usuario.")

        # Insertar usuario vinculado
        sql_usuario = """
            INSERT INTO usuarios (id_vecino, nombre, password_hash, rol, rut)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(sql_usuario, (
            id_vecino,
            data.nombre,
            data.contrasena,  # ideal: hash
            "vecino",
            data.rut
        ))
        id_usuario = cursor.lastrowid

        db.commit()

        # Devolver payload útil para auto login si quieres
        cursor.execute(
            "SELECT id_usuario, id_vecino, rol, rut, nombre FROM usuarios WHERE id_usuario = %s",
            (id_usuario,)
        )
        usuario = cursor.fetchone()

        return {"ok": True, "id_vecino": id_vecino, "id_usuario": id_usuario, "usuario": usuario}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        db.close()
