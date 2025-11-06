from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError
from fastapi.exceptions import RequestValidationError

from pydantic import BaseModel, EmailStr, field_validator
from conexion import conectar_db
from config import configurar_cors
from endpoints import (
    endpointActividades,
    endpointAdministradores,
    endpointNoticias,
    endpointProyectos,
    endpointReserva,
    endpointBiometria,
    endpointCertificados,   
)
from datetime import date
from fastapi import Depends, Header
from jwt.jwt_utils import crear_access_token , verificar_access_token

# from fastapi.security import OAuth2PasswordBearer | No se usa por ahora


app = FastAPI(title="API Junta de Vecinos")


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

configurar_cors(app)



def obtener_usuario_actual(authorization: str = Header(...)):
    # Recibe el header 'Authorization' de la solicitud HTTP.
    # El valor esperado es: "Bearer <token_jwt>"

    if not authorization.startswith("Bearer "):
        # Si el header no comienza con 'Bearer ', el token no es válido.
        raise HTTPException(status_code=401, detail="Token inválido")

    # Extrae el token JWT quitando el prefijo 'Bearer '
    token = authorization.split(" ")[1]

    # Llama a la función que valida el token y obtiene el payload (datos del usuario)
    payload = verificar_access_token(token)

    if not payload:
        # Si el token es inválido o expiró, retorna error 401 (no autorizado)
        raise HTTPException(status_code=401, detail="Token inválido")

    # Si todo está bien, retorna el payload (información del usuario autenticado)
    return payload



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
    return {"API Junta de Vecinos"}

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

        # Insertar vecino (ahora incluye fecha_nacimiento)
        sql_vecino = """
            INSERT INTO vecinos (nombre, apellido, rut, direccion, correo, numero_telefono, contrasena, miembro, fecha_nacimiento)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql_vecino, (
            vecino.nombre,
            vecino.apellido,
            vecino.rut,
            vecino.direccion,
            vecino.correo,
            vecino.numero_telefono,
            vecino.contrasena,  # ideal: hash
            vecino.miembro,
            vecino.fecha_nacimiento
        ))
        db.commit()
        id_vecino = cursor.lastrowid

        # Evitar duplicado de usuario por RUT
        cursor.execute("SELECT 1 FROM usuarios WHERE rut = %s", (vecino.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como usuario.")

        # Crear usuario asociado (rol: vecino)
        sql_usuario = """
            INSERT INTO usuarios (id_vecino, nombre, password_hash, rol, rut)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(sql_usuario, (
            id_vecino,
            vecino.nombre,
            vecino.contrasena,  # ideal: hash
            "vecino",
            vecino.rut
        ))
        db.commit()
        id_usuario = cursor.lastrowid

        # Traer datos del usuario recién creado (incluye id_vecino como en CER)
        cursor.execute(
            "SELECT id_usuario, id_vecino, rol, rut, nombre FROM usuarios WHERE id_usuario = %s",
            (id_usuario,)
        )
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
    usuario=Depends(obtener_usuario_actual) # primero se ejecuta esta funcion antes que el endpoint
):
    # Solo permite si el usuario es admin
    if usuario["rol"] != "admin":
        raise HTTPException(status_code=403, detail="Solo el admin puede modificar datos ")
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    campos = vecino.model_dump(exclude_unset=True)
    if not campos:
        raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar")
     # Verifica que el vecino existe antes de actualizar
    cursor.execute("SELECT * FROM vecinos WHERE id_vecino=%s", (id_vecino,))
    if not cursor.fetchone():
        cursor.close()
        db.close()
        raise HTTPException(status_code=404, detail="Vecino no encontrado")

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


# ---------- Login (incluye id_vecino como en CER) ----------
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
            token = crear_access_token({"rut": usuario["rut"], "rol": usuario["rol"]})
            return {
                "access_token": token,
                "token_type": "bearer",
                "id_usuario": usuario["id_usuario"],
                "id_vecino": usuario.get("id_vecino"),  # 👈 agregado
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
