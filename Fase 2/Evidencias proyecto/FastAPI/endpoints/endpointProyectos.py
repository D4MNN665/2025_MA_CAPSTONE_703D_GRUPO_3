from fastapi import APIRouter, HTTPException, Depends, Body, Header
from pydantic import ValidationError
from typing import List
from models.models import Proyecto, ProyectoCrear
from conexion import conectar_db
from jwt.deps import get_admin_uv
from .utils import list_by_uv

from fastapi import BackgroundTasks
from email.message import EmailMessage
import smtplib
import os

from dotenv import load_dotenv
load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

from datetime import datetime

router = APIRouter(prefix="/proyectos", tags=["CRUD Proyectos"])

@router.post("/", response_model=Proyecto)
def crear_proyecto(payload: dict = Body(...), id_uv: int | None = Depends(get_admin_uv), authorization: str | None = Header(None)):
    id_uv_body = payload.get("id_uv")
    print(id_uv_body)
    try:
        proyecto = ProyectoCrear.model_validate({k: v for k, v in payload.items() if k != "id_uv"})
    except ValidationError as ve:
        errores = [err.get('msg') or str(err) for err in ve.errors()]
        raise HTTPException(status_code=422, detail={"mensaje": "Datos inválidos en la solicitud", "errores": errores})

    # Debug
    try:
        print("[DEBUG] Authorization header (proyectos):", authorization)
    except Exception:
        pass

    effective_id_uv = id_uv or id_uv_body
    if effective_id_uv is None:
        raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")

    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verificar si existe el vecino
    cursor.execute("SELECT id_vecino FROM vecinos WHERE id_vecino = %s", (proyecto.id_vecino,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El vecino asociado no existe")

    # Comprobar si la tabla proyectos tiene columna id_uv
    try:
        cursor.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
            ("proyectos",)
        )
        has_id_uv = cursor.fetchone() is not None
    except Exception:
        has_id_uv = False

    if has_id_uv:
        query = """
        INSERT INTO proyectos (id_vecino, titulo, descripcion, fecha_postulacion, estado, tipo_proyecto, ubicacion, id_uv)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            proyecto.id_vecino,
            proyecto.titulo,
            proyecto.descripcion,
            proyecto.fecha_postulacion,
            proyecto.estado,
            proyecto.tipo_proyecto,
            proyecto.ubicacion,
            effective_id_uv,
        )
    else:
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
def listar_proyectos(id_uv: int | None = Depends(get_admin_uv)):
    if id_uv is None:
        return []
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        result = list_by_uv(cursor, 'proyectos', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_postulacion DESC')
        return result
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

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


@router.get("/uv/{id_uv}")
def listar_proyectos_por_uv(id_uv: int):
    """Listado de proyectos filtrado por id_uv (recibe id_uv en el path)."""
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = list_by_uv(cursor, 'proyectos', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_postulacion DESC')
        # formatear fechas si es necesario
        from datetime import datetime as _dt
        for p in rows:
            if isinstance(p.get('fecha_postulacion'), (_dt,)):
                p['fecha_postulacion'] = p['fecha_postulacion'].strftime('%Y-%m-%d')
            if 'fecha_resolucion' in p and isinstance(p.get('fecha_resolucion'), (_dt,)):
                p['fecha_resolucion'] = p['fecha_resolucion'].strftime('%Y-%m-%d')
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

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

from pydantic import BaseModel

class EstadoProyecto(BaseModel):
    estado: str  # "aprobado" o "rechazado"
    razon: str = None  # Solo para rechazo

@router.put("/{proyecto_id}/estado", response_model=Proyecto)
def actualizar_estado_proyecto(proyecto_id: int, estado_data: EstadoProyecto, background_tasks: BackgroundTasks):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Verifica si existe el proyecto
    cursor.execute("SELECT * FROM proyectos WHERE id_proyecto = %s", (proyecto_id,))
    proyecto = cursor.fetchone()
    if not proyecto:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Actualiza el estado, la fecha de resolución y la razón de rechazo si corresponde
    if estado_data.estado == "rechazado":
        cursor.execute(
            "UPDATE proyectos SET estado = %s, fecha_resolucion = NOW(), razon_rechazo = %s WHERE id_proyecto = %s",
            (estado_data.estado, estado_data.razon, proyecto_id)
        )
    else:
        cursor.execute(
            "UPDATE proyectos SET estado = %s, fecha_resolucion = NOW(), razon_rechazo = NULL WHERE id_proyecto = %s",
            (estado_data.estado, proyecto_id)
        )
    conn.commit()

    # Obtén los datos actualizados del proyecto
    cursor.execute("SELECT * FROM proyectos WHERE id_proyecto = %s", (proyecto_id,))
    proyecto_actualizado = cursor.fetchone()

    # Busca el correo y nombre del vecino responsable
    cursor.execute(
        "SELECT v.correo, v.nombre, v.apellido FROM vecinos v JOIN proyectos p ON v.id_vecino = p.id_vecino WHERE p.id_proyecto = %s",
        (proyecto_id,)
    )
    vecino = cursor.fetchone()
    cursor.close()
    conn.close()

    if vecino and vecino["correo"]:
        nombre_completo = f"{vecino['nombre']} {vecino['apellido']}"
        background_tasks.add_task(
            enviar_correo_estado_proyecto,
            vecino["correo"],
            nombre_completo,
            proyecto_actualizado["titulo"],
            estado_data.estado,
            estado_data.razon
        )

    # Devuelve el proyecto actualizado usando tu modelo
    return Proyecto(
        id_proyecto=proyecto_actualizado["id_proyecto"],
        id_vecino=proyecto_actualizado["id_vecino"],
        titulo=proyecto_actualizado["titulo"],
        descripcion=proyecto_actualizado["descripcion"],
        fecha_postulacion=str(proyecto_actualizado["fecha_postulacion"]),
        estado=proyecto_actualizado["estado"],
        tipo_proyecto=proyecto_actualizado["tipo_proyecto"],
        ubicacion=proyecto_actualizado["ubicacion"],
        fecha_resolucion=str(proyecto_actualizado["fecha_resolucion"]) if proyecto_actualizado["fecha_resolucion"] else None,
        razon_rechazo=proyecto_actualizado["razon_rechazo"]
    )

def enviar_correo_estado_proyecto(correo_destino, nombre_vecino, titulo_proyecto, estado, razon=None):
    remitente = EMAIL_USER
    password = EMAIL_PASS
    print("EMAIL_USER:", EMAIL_USER)
    print("EMAIL_PASS:", EMAIL_PASS)
    if estado == "rechazado":
        asunto = "Proyecto Rechazado"
        cuerpo = f"Estimado/a {nombre_vecino},\n\nSu proyecto '{titulo_proyecto}' ha sido rechazado.\nMotivo: {razon}\n\nAtentamente,\nJunta de Vecinos"
    else:
        asunto = "Proyecto Aprobado"
        cuerpo = f"Estimado/a {nombre_vecino},\n\nSu proyecto '{titulo_proyecto}' ha sido aprobado.\n\nAtentamente,\nJunta de Vecinos"

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = remitente
    msg["To"] = correo_destino
    msg.set_content(cuerpo)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(remitente, password)
            smtp.send_message(msg)
        print(f"Correo de notificación enviado a {correo_destino}")
    except Exception as e:
        print(f"Error al enviar correo de notificación: {e}")