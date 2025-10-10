from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
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

# Si usas JWT en otras partes, puedes dejar estos imports (no se usan aquí directamente)
from fastapi.security import OAuth2PasswordBearer  # noqa: F401
from jwt.jwt_utils import create_access_token, verify_token  # noqa: F401


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


# ---------- CRUD Vecinos (crea también usuario) ----------
@app.post("/vecinos/", tags=["CRUD vecinos"])
def crear_vecino(vecino: Vecino):
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    try:
        # Evitar duplicado de RUT en vecinos
        cursor.execute("SELECT 1 FROM vecinos WHERE rut = %s", (vecino.rut,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="El RUT ya está registrado como vecino.")

        # Insertar vecino
        sql_vecino = """
            INSERT INTO vecinos (nombre, apellido, rut, direccion, correo, numero_telefono, contrasena, miembro)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(sql_vecino, (
            vecino.nombre,
            vecino.apellido,
            vecino.rut,
            vecino.direccion,
            vecino.correo,
            vecino.numero_telefono,
            vecino.contrasena,  # ideal: hash
            vecino.miembro
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
def actualizar_vecino(id_vecino: int, vecino: Vecino):
    db = conectar_db()
    cursor = db.cursor()
    sql = """
        UPDATE vecinos SET nombre=%s, apellido=%s, rut=%s, correo=%s,
        numero_telefono=%s, direccion=%s, miembro=%s WHERE id_vecino=%s
    """
    try:
        cursor.execute(sql, (
            vecino.nombre,
            vecino.apellido,
            vecino.rut,
            vecino.correo,
            vecino.numero_telefono,
            vecino.direccion,
            vecino.miembro,
            id_vecino
        ))
        db.commit()
        return {"mensaje": "Vecino actualizado exitosamente"}
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
            return {
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
