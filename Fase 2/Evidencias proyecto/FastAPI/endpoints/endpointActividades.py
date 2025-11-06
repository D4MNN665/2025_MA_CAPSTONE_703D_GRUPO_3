from fastapi import APIRouter, HTTPException, Body
from typing import List
from conexion import conectar_db
from datetime import datetime
from pydantic import BaseModel, field_validator, Field
from typing import Optional, Literal



def iso_to_mysql(fecha_iso):
    fecha_iso = fecha_iso.replace('Z', '')
    dt = datetime.fromisoformat(fecha_iso)
    return dt.strftime('%Y-%m-%d %H:%M:%S')

class ActividadCreate(BaseModel):
    titulo: str
    descripcion: str
    fecha_inicio: str
    fecha_fin: str
    cupo_max: int
    cupo_actual: int
    id_usuario: int  

class Actividad(BaseModel):
    id_actividad: int
    titulo: str
    descripcion: str
    fecha_inicio: str
    fecha_fin: str
    cupo_max: int
    cupo_actual: int
    id_usuario: int
    usuarios_enrolados: list[int] = []

router = APIRouter(
    prefix="/actividades",
    tags=["CRUD actividades"]
)

# Listar actividades
@router.get("", response_model=List[Actividad])
def listar_actividades():
    cnx = conectar_db()
    cursor = cnx.cursor(dictionary=True)
    cursor.execute("SELECT * FROM actividades")
    actividades = cursor.fetchall()
    for act in actividades:
        cursor.execute(
            "SELECT usuario_id FROM usuarios_en_actividades WHERE actividad_id = %s",
            (act["id_actividad"],)
        )
        act["usuarios_enrolados"] = [row["usuario_id"] for row in cursor.fetchall()]
    cursor.close()
    cnx.close()
    # Convierte fechas a string si es necesario
    for act in actividades:
        if isinstance(act["fecha_inicio"], datetime):
            act["fecha_inicio"] = act["fecha_inicio"].strftime('%Y-%m-%d %H:%M:%S')
        if isinstance(act["fecha_fin"], datetime):
            act["fecha_fin"] = act["fecha_fin"].strftime('%Y-%m-%d %H:%M:%S')
    return actividades

# Crear actividad
@router.post("", response_model=Actividad)
def crear_actividad(actividad: ActividadCreate):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    cursor = cnx.cursor()
    query = """
        INSERT INTO actividades (titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual, id_usuario)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    # Convierte las fechas al formato MySQL
    fecha_inicio = iso_to_mysql(actividad.fecha_inicio)
    fecha_fin = iso_to_mysql(actividad.fecha_fin)
    cursor.execute(query, (
        actividad.titulo,
        actividad.descripcion,
        fecha_inicio,
        fecha_fin,
        actividad.cupo_max,
        actividad.cupo_actual,
        actividad.id_usuario
    ))
    cnx.commit()
    actividad_id = cursor.lastrowid
    cursor.close()
    cnx.close()
    return {
        "id_actividad": actividad_id,
        **actividad.dict(),
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin
    }

# Enrolar usuario a actividad
@router.post("/{id_actividad}/enrolar")
def enrolar_usuario(id_actividad: int, usuario_id: int = Body(..., embed=True)):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    cursor = cnx.cursor()
    try:
        # Verifica si el usuario ya está enrolado
        cursor.execute(
            "SELECT id FROM usuarios_en_actividades WHERE usuario_id = %s AND actividad_id = %s",
            (usuario_id, id_actividad)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El usuario ya está enrolado en esta actividad")
        # Enrola al usuario
        cursor.execute(
            "INSERT INTO usuarios_en_actividades (usuario_id, actividad_id) VALUES (%s, %s)",
            (usuario_id, id_actividad)
        )
        # Actualiza el cupo_actual
        cursor.execute(
            "UPDATE actividades SET cupo_actual = cupo_actual + 1 WHERE id_actividad = %s",
            (id_actividad,)
        )
        cnx.commit()
        return {"detail": "Usuario enrolado correctamente"}
    except HTTPException as he:
        cnx.rollback()
        raise he
    except Exception as e:
        cnx.rollback()
        print("Error al enrolar usuario:", e)
        raise HTTPException(status_code=500, detail="Error interno al enrolar usuario")
    finally:
        cursor.close()
        cnx.close()