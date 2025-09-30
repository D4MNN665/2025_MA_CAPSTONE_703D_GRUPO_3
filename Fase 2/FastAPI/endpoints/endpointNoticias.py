from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Noticia
from conexion import conectar_db

router = APIRouter(prefix="/noticias", tags=["CRUD Noticias"])

# CRUD Noticias
@router.post("/", response_model=Noticia)
def crear_noticia(noticia: Noticia):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe el autor
    cursor.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (noticia.autor_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El autor no existe")

    query = """
    INSERT INTO noticias (titulo, contenido, fecha_publicacion, autor_id)
    VALUES (%s, %s, %s, %s)
    """
    values = (noticia.titulo, noticia.contenido, noticia.fecha_publicacion, noticia.autor_id)
    cursor.execute(query, values)
    conn.commit()

    noticia.id_noticia = cursor.lastrowid
    cursor.close()
    conn.close()
    return noticia


@router.get("/", response_model=List[Noticia])
def listar_noticias():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM noticias ORDER BY fecha_publicacion DESC")
    result = cursor.fetchall()

    cursor.close()
    conn.close()
    return result



@router.get("/{noticia_id}", response_model=Noticia)
def obtener_noticia(noticia_id: int):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM noticias WHERE id_noticia = %s", (noticia_id,))
    noticia = cursor.fetchone()

    cursor.close()
    conn.close()

    if not noticia:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")
    return noticia



@router.put("/{noticia_id}", response_model=Noticia)
def actualizar_noticia(noticia_id: int, noticia: Noticia):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe la noticia
    cursor.execute("SELECT id_noticia FROM noticias WHERE id_noticia = %s", (noticia_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Noticia no encontrada")

    query = """
    UPDATE noticias
    SET titulo=%s, contenido=%s, fecha_publicacion=%s, autor_id=%s
    WHERE id_noticia=%s
    """
    values = (noticia.titulo, noticia.contenido, noticia.fecha_publicacion, noticia.autor_id, noticia_id)
    cursor.execute(query, values)
    conn.commit()

    cursor.close()
    conn.close()

    noticia.id_noticia = noticia_id
    return noticia


@router.delete("/{noticia_id}")
def eliminar_noticia(noticia_id: int):
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM noticias WHERE id_noticia = %s", (noticia_id,))
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Noticia no encontrada")

    cursor.close()
    conn.close()

    return {"message": f"Noticia {noticia_id} eliminada correctamente"}
