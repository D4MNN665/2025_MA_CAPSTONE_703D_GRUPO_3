from models.models import Actividad
from fastapi import HTTPException,APIRouter
from typing import List

from conexion import conectar_db

router = APIRouter(
    prefix="/actividades",
    tags=["CRUD actividades"]
)


#CRUD actividades (eventos)

@router.get("/actividades", response_model=List[Actividad])
def obtener_actividades():
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor(dictionary=True)
    query = "SELECT id_actividad, titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual FROM actividades"
    
    try:
        cursor.execute(query)
        resultados = cursor.fetchall()
        actividades = [Actividad(**row) for row in resultados]
        return actividades
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener actividades: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.get("/actividades/{actividad_id}", response_model=Actividad)
def obtener_actividad(actividad_id: int):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor(dictionary=True)
    query = "SELECT id_actividad, titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual FROM actividades WHERE id_actividad = %s"
    
    try:
        cursor.execute(query, (actividad_id,))
        resultado = cursor.fetchone()
        if resultado is None:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        actividad = Actividad(**resultado)
        return actividad
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.post("/actividades", response_model=Actividad)
def crear_actividad(actividad: Actividad):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor()
    query = """
        INSERT INTO actividades (titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    
    try:
        cursor.execute(query, (
            actividad.titulo,
            actividad.descripcion,
            actividad.fecha_inicio,
            actividad.fecha_fin,
            actividad.cupo_max,
            actividad.cupo_actual
        ))
        cnx.commit()
        actividad.id_actividad = cursor.lastrowid
        return actividad
    except Exception as e:
        cnx.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.put("/actividades/{actividad_id}", response_model=Actividad)
def actualizar_actividad(actividad_id: int, actividad: Actividad):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor()
    query = """
        UPDATE actividades
        SET titulo = %s, descripcion = %s, fecha_inicio = %s, fecha_fin = %s, cupo_max = %s, cupo_actual = %s
        WHERE id_actividad = %s
    """
    
    try:
        cursor.execute(query, (
            actividad.titulo,
            actividad.descripcion,
            actividad.fecha_inicio,
            actividad.fecha_fin,
            actividad.cupo_max,
            actividad.cupo_actual,
            actividad_id
        ))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        cnx.commit()
        actividad.id_actividad = actividad_id
        return actividad
    except Exception as e:
        cnx.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.delete("/actividades/{actividad_id}")
def eliminar_actividad(actividad_id: int):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor()
    query = "DELETE FROM actividades WHERE id_actividad = %s"
    
    try:
        cursor.execute(query, (actividad_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        cnx.commit()
        return {"detail": "Actividad eliminada correctamente"}
    except Exception as e:
        cnx.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()


