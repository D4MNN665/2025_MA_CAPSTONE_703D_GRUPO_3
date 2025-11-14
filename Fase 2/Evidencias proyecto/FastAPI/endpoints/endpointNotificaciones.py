from fastapi import APIRouter, Depends, Body, HTTPException
from typing import List
from pydantic import BaseModel
from conexion import conectar_db
from jwt.deps import get_admin_uv
from .utils import list_by_uv
import os
from dotenv import load_dotenv
from email.mime.text import MIMEText
import smtplib
# Cargar variables de entorno
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

router = APIRouter(prefix="/notificaciones", tags=["CRUD Notificaciones"])


@router.get("/", tags=["CRUD Notificaciones"])
def listar_notificaciones(id_uv: int | None = Depends(get_admin_uv)):
    if id_uv is None:
        return []
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        # Prefer id_uv in notificaciones, else join vecinos via id_vecino
        result = list_by_uv(cursor, 'notificaciones', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_envio DESC')
        return result
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass


@router.get("/uv/{id_uv}")
def listar_notificaciones_por_uv(id_uv: int):
    """Listado de notificaciones filtrado por id_uv (recibe id_uv en el path)."""
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = list_by_uv(cursor, 'notificaciones', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_envio DESC')
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass



class NotificacionEnvio(BaseModel):
    segmento: str
    mensaje: str
    id_actividad: int | None = None
    id_reserva: int | None = None

def enviar_email(destinatarios: list[str], mensaje: str):
    remitente = os.environ.get("EMAIL_USER")
    password = os.environ.get("EMAIL_PASS")
    smtp_server = "smtp.gmail.com"
    smtp_port = 587

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(remitente, password)
        for destinatario in destinatarios:
            msg = MIMEText(mensaje)
            msg["Subject"] = "AVISO IMPORTANTE"
            msg["From"] = remitente
            msg["To"] = destinatario
            server.sendmail(remitente, destinatario, msg.as_string())

@router.post("/Notificar")
def Notificar(data: NotificacionEnvio = Body(...)):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    destinatarios = []

    if data.segmento == "todos_los_funcionarios":
        cursor.execute("""
            SELECT v.correo FROM usuarios u
            JOIN vecinos v ON u.id_vecino = v.id_vecino
            WHERE u.rol = 'admin'
        """)
        destinatarios = [row["correo"] for row in cursor.fetchall()]
    elif data.segmento == "inscritos_actividades":
        if not data.id_actividad:
            raise HTTPException(status_code=400, detail="Falta id_actividad")
        cursor.execute("""
            SELECT v.correo
            FROM usuarios_en_actividades ua
            JOIN usuarios u ON ua.usuario_id = u.id_usuario
            JOIN vecinos v ON u.id_vecino = v.id_vecino
            WHERE ua.actividad_id = %s
        """, (data.id_actividad,))
        destinatarios = [row["correo"] for row in cursor.fetchall()]
    elif data.segmento == "inscritos_reservas":
        if not data.id_reserva:
            raise HTTPException(status_code=400, detail="Falta id_reserva")
        cursor.execute("""
            SELECT v.correo FROM reservas r
            JOIN vecinos v ON r.id_vecino = v.id_vecino
            WHERE r.id_reserva = %s
        """, (data.id_reserva,))
        destinatarios = [row["correo"] for row in cursor.fetchall()]
    else:
        raise HTTPException(status_code=400, detail="Segmento no soportado")

    cursor.close()
    conn.close()

    if not destinatarios:
        raise HTTPException(status_code=404, detail="No se encontraron destinatarios")

    enviar_email(destinatarios, data.mensaje)
    return {"ok": True, "enviados": len(destinatarios)}