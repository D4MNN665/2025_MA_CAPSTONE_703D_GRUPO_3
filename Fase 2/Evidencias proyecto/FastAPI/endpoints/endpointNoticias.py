from fastapi import APIRouter, HTTPException, Depends, Body, Header
from pydantic import ValidationError
from typing import List
from models.models import Noticia
from conexion import conectar_db
from jwt.deps import get_admin_uv
from .utils import list_by_uv

router = APIRouter(prefix="/noticias", tags=["CRUD Noticias"])

# CRUD Noticias
@router.post("/", response_model=Noticia)
def crear_noticia(payload: dict = Body(...), id_uv: int | None = Depends(get_admin_uv), authorization: str | None = Header(None)):
    id_uv_body = payload.get("id_uv")
    try:
        noticia = Noticia.model_validate({k: v for k, v in payload.items() if k != "id_uv"})
    except ValidationError as ve:
        errores = [err.get('msg') or str(err) for err in ve.errors()]
        raise HTTPException(status_code=422, detail={"mensaje": "Datos inválidos en la solicitud", "errores": errores})

    # Debug
    try:
        print("[DEBUG] Authorization header (noticias):", authorization)
    except Exception:
        pass

    effective_id_uv = id_uv or id_uv_body
    if effective_id_uv is None:
        raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")

    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe el autor
    cursor.execute("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (noticia.autor_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El autor no existe")

    # Comprobar si la tabla noticias tiene columna id_uv
    try:
        cursor.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
            ("noticias",)
        )
        has_id_uv = cursor.fetchone() is not None
    except Exception:
        has_id_uv = False

    if has_id_uv:
        query = """
        INSERT INTO noticias (titulo, contenido, fecha_publicacion, autor_id, id_uv)
        VALUES (%s, %s, %s, %s, %s)
        """
        values = (noticia.titulo, noticia.contenido, noticia.fecha_publicacion, noticia.autor_id, effective_id_uv)
    else:
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
def listar_noticias(id_uv: int | None = Depends(get_admin_uv)):
    # If id_uv can't be derived return []
    if id_uv is None:
        return []
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        result = list_by_uv(cursor, 'noticias', id_uv, join_table='usuarios', join_on='t.autor_id = j.id_usuario', order_by='fecha_publicacion DESC')
        return result
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass


@router.get("/uv/{id_uv}")
def listar_noticias_por_uv(id_uv: int):
    """Listado de noticias filtrado por id_uv (recibe id_uv en el path)."""
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = list_by_uv(cursor, 'noticias', id_uv, join_table='usuarios', join_on='t.autor_id = j.id_usuario', order_by='fecha_publicacion DESC')
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass



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
