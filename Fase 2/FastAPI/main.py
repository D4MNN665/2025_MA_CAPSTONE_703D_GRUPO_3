from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from pydantic import *
from conexion import conectar_db
from config import configurar_cors
from endpoints import endpointActividades, endpointAdministradores, endpointNoticias, endpointProyectos, endpointReserva, endpointCertificados

#from fastapi.security import OAuth2PasswordBearer 
#from jwt.jwt_utils import create_access_token, verify_token


app = FastAPI(title="API Junta de Vecinos")

#Unificacion de routers
app.router.include_router(endpointActividades.router)
app.router.include_router(endpointAdministradores.router)
app.router.include_router(endpointNoticias.router)
app.router.include_router(endpointProyectos.router)
app.router.include_router(endpointReserva.router)
app.include_router(endpointCertificados.router)

configurar_cors(app)
# ------------------------------------------------------------------------------------------------------------------


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


# ------------------------------------------------------------------------------------------------------------------
@app.get("/")
def read_root():
    return {"message": "API Junta de Vecinos"}

# CRUD Vecinos

# Crear vecino
@app.post("/vecinos/", tags=["CRUD vecinos"])
def crear_vecino(vecino: Vecino):
    db = conectar_db()
    cursor = db.cursor()
    sql = """
        INSERT INTO vecinos (nombre, apellido, rut, direccion, correo, numero_telefono, contrasena, miembro)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    try:
        cursor.execute(sql, (
            vecino.nombre,
            vecino.apellido,
            vecino.rut,
            vecino.direccion,
            vecino.correo,
            vecino.numero_telefono,
            vecino.contrasena,
            vecino.miembro
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        db.close()
    return {"mensaje": "Vecino registrado exitosamente"}

# Leer todos los vecinos que son miembros pendientes


@app.get("/vecinos/")
def obtener_todos_vecinos():
    db = conectar_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM vecinos")
    vecinos = cursor.fetchall()
    cursor.close()
    db.close()
    return vecinos

# Leer vecino por ID


@app.get("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def obtener_vecino(id_vecino: int, vecino: Vecino):
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

# Actualizar vecino


@app.put("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def actualizar_vecino(id_vecino: int, vecino: Vecino):
    db = conectar_db()
    cursor = db.cursor()
    sql = """
        UPDATE vecinos SET nombre=%s, apellido=%s, rut=%s, correo=%s,
        numero_telefono=%s, direccion=%s, miembro=%s WHERE id_vecino=%s
    """
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
    cursor.close()
    db.close()
    return {"mensaje": "Vecino actualizado exitosamente"}

# Eliminar vecino


@app.delete("/vecinos/{id_vecino}", tags=["CRUD vecinos"])
def eliminar_vecino(id_vecino: int):
    db = conectar_db()
    cursor = db.cursor()
    cursor.execute("DELETE FROM vecinos WHERE id_vecino=%s", (id_vecino,))
    db.commit()
    cursor.close()
    db.close()
    return {"mensaje": "Vecino eliminado exitosamente"}
# ------------------------------------------------------------------------------------------------------------------

# Login


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
                "id_vecino": usuario["id_vecino"],
                "rol": usuario["rol"],
                "rut": usuario["rut"],
                "nombre": usuario["nombre"]
            }
        else:
            raise HTTPException(
                status_code=401, detail="Credenciales incorrectas")
    finally:
        cursor.close()
        db.close()
# ------------------------------------------------------------------------------------------------------------------


