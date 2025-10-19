from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Proyecto, ProyectoCrear
from conexion import conectar_db

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