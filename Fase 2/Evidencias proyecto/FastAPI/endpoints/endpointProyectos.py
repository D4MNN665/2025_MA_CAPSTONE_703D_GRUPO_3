from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Proyecto
from conexion import conectar_db

router = APIRouter(prefix="/proyectos", tags=["CRUD Proyectos"])


@router.post("/", response_model=Proyecto)
def crear_proyecto(proyecto: Proyecto):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe el vecino
    cursor.execute("SELECT id_vecino FROM vecinos WHERE id_vecino = %s", (proyecto.id_vecino,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El vecino asociado no existe")

    query = """
    INSERT INTO proyectos (id_vecino, titulo, descripcion, fecha_postulacion, estado, fecha_resolucion, resolucion_email)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        proyecto.id_vecino,
        proyecto.titulo,
        proyecto.descripcion,
        proyecto.fecha_postulacion,
        proyecto.estado,
        proyecto.fecha_resolucion,
        proyecto.resolucion_email,
    )
    cursor.execute(query, values)
    conn.commit()

    proyecto.id_proyecto = cursor.lastrowid
    cursor.close()
    conn.close()
    return proyecto



@router.get("/", response_model=List[Proyecto])
def listar_proyectos():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM proyectos ORDER BY fecha_postulacion DESC")
    result = cursor.fetchall()

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
    SET id_vecino=%s, titulo=%s, descripcion=%s, fecha_postulacion=%s, estado=%s, fecha_resolucion=%s, resolucion_email=%s
    WHERE id_proyecto=%s
    """
    values = (
        proyecto.id_vecino,
        proyecto.titulo,
        proyecto.descripcion,
        proyecto.fecha_postulacion,
        proyecto.estado,
        proyecto.fecha_resolucion,
        proyecto.resolucion_email,
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
