from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Proyecto, ProyectoCrear
from conexion import conectar_db

from datetime import datetime

router = APIRouter(prefix="/proyectos", tags=["CRUD Proyectos"])

@router.post("/", response_model=Proyecto)
def crear_proyecto(proyecto: ProyectoCrear):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe el vecino
    cursor.execute("SELECT id_vecino FROM vecinos WHERE id_vecino = %s", (proyecto.id_vecino,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El vecino asociado no existe")

    query = """
    INSERT INTO proyectos (id_vecino, titulo, descripcion, fecha_postulacion, estado, tipo_proyecto, ubicacion)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        proyecto.id_vecino,
        proyecto.titulo,
        proyecto.descripcion,
        proyecto.fecha_postulacion,
        proyecto.estado,
        proyecto.tipo_proyecto,
        proyecto.ubicacion,
    )
    cursor.execute(query, values)
    conn.commit()

    id_proyecto = cursor.lastrowid
    cursor.close()
    conn.close()
    
    proyecto_creado = Proyecto(
        id_proyecto=id_proyecto,
        id_vecino=proyecto.id_vecino,
        titulo=proyecto.titulo,
        descripcion=proyecto.descripcion,
        fecha_postulacion=proyecto.fecha_postulacion,
        estado=proyecto.estado,
        tipo_proyecto=proyecto.tipo_proyecto,
        ubicacion=proyecto.ubicacion,
    )
    return proyecto_creado

@router.get("/", response_model=List[Proyecto])
def listar_proyectos():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM proyectos ORDER BY fecha_postulacion DESC")
    result = cursor.fetchall()

    # Convertir fecha_postulacion a string si es datetime
    for proyecto in result:
        if isinstance(proyecto.get("fecha_postulacion"), (datetime, )):
            proyecto["fecha_postulacion"] = proyecto["fecha_postulacion"].strftime("%Y-%m-%d")
        # Si tienes fecha_resolucion y puede ser None o datetime:
        if "fecha_resolucion" in proyecto and isinstance(proyecto["fecha_resolucion"], (datetime, )):
            proyecto["fecha_resolucion"] = proyecto["fecha_resolucion"].strftime("%Y-%m-%d")

    cursor.close()
    conn.close()
    return result

@router.get("/{proyecto_id}", response_model=Proyecto)
def obtener_proyecto(proyecto_id: int):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM proyectos WHERE id_proyecto = %s", (proyecto_id,))
    proyecto = cursor.fetchone()

    cursor.close()
    conn.close()

    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return proyecto

@router.put("/{proyecto_id}", response_model=Proyecto)
def actualizar_proyecto(proyecto_id: int, proyecto: Proyecto):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe
    cursor.execute("SELECT id_proyecto FROM proyectos WHERE id_proyecto = %s", (proyecto_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    query = """
    UPDATE proyectos
    SET id_vecino=%s, titulo=%s, descripcion=%s, fecha_postulacion=%s, estado=%s, tipo_proyecto=%s, ubicacion=%s
    WHERE id_proyecto=%s
    """
    values = (
        proyecto.id_vecino,
        proyecto.titulo,
        proyecto.descripcion,
        proyecto.fecha_postulacion,
        proyecto.estado,
        proyecto.tipo_proyecto,
        proyecto.ubicacion,
        proyecto_id,
    )
    cursor.execute(query, values)
    conn.commit()

    cursor.close()
    conn.close()

    proyecto.id_proyecto = proyecto_id
    return proyecto

@router.delete("/{proyecto_id}")
def eliminar_proyecto(proyecto_id: int):
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM proyectos WHERE id_proyecto = %s", (proyecto_id,))
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    cursor.close()
    conn.close()

    return {"message": f"Proyecto {proyecto_id} eliminado correctamente"}