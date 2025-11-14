from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Header, Body
from pydantic import ValidationError
from pydantic import BaseModel
from models.models import CertificadoResidencia
from conexion import conectar_db
from jwt.deps import get_admin_uv
from jwt.jwt_utils import verificar_access_token
from .utils import list_by_uv

from fpdf import FPDF
from email.message import EmailMessage
import smtplib
import re
import traceback

router = APIRouter()

from dotenv import load_dotenv
import os

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

@router.post("/certificados/residencia",tags=["CRUD Certificados"])
def emitir_certificado(
    payload: dict = Body(...),
    id_uv: int | None = Depends(get_admin_uv),
    authorization: str | None = Header(None),
):
    # payload: expected to contain the certificado fields and optionally id_uv
    id_uv_body = payload.get("id_uv")
    try:
        certificado = CertificadoResidencia.model_validate({k: v for k, v in payload.items() if k != "id_uv"})
    except ValidationError as ve:
        # return similar structure as earlier UI error
        errores = [err.get('msg') or str(err) for err in ve.errors()]
        raise HTTPException(status_code=422, detail={"mensaje": "Datos inválidos en la solicitud", "errores": errores})

    print("ID VECINO RECIBIDO:", certificado.id_vecino)
    # Debug: print authorization header and token payload to diagnose why id_uv may be None
    try:
        print("[DEBUG] Authorization header:", authorization)
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1]
            try:
                token_payload = verificar_access_token(token)
                print("[DEBUG] verificar_access_token payload:", token_payload)
            except Exception as _e:
                print("[DEBUG] verificar_access_token raised:", _e)
        else:
            print("[DEBUG] No bearer token in authorization header")
    except Exception:
        pass

    # Prefer id_uv from token (id_uv). If missing, allow id_uv_body (from client) as fallback.
    effective_id_uv = id_uv or id_uv_body
    if effective_id_uv is None:
        # neither token nor body provided id_uv -> unauthorized for UV-scoped creation
        raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")
    try:
        conn = conectar_db()
        cursor = conn.cursor(dictionary=True)

        # Validar motivo no vacío
        if not certificado.motivo or not certificado.motivo.strip():
            raise HTTPException(status_code=400, detail="El motivo no puede estar vacío")

        # Validar que el vecino existe
        cursor.execute("SELECT * FROM vecinos WHERE id_vecino = %s", (certificado.id_vecino,))
        vecino = cursor.fetchone()
        if not vecino:
            raise HTTPException(status_code=404, detail="Vecino no encontrado")

    # Comprueba si la columna id_uv existe en la tabla certificados; si no, hace un INSERT sin ella
        try:
            cursor.execute(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
                ("certificados",)
            )
            has_id_uv = cursor.fetchone() is not None
        except Exception:
            # En caso de error en la comprobación, asumir que la columna no existe para evitar romper
            has_id_uv = False

        # Debug: mostrar el id_uv efectivo y si la tabla tiene la columna
        print(f"[DEBUG] effective_id_uv={effective_id_uv} has_id_uv={has_id_uv}")
        if has_id_uv:
            # Si la tabla espera id_uv pero no tenemos valor efectivo, error
            if effective_id_uv is None:
                raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")
            cursor.execute(
                "INSERT INTO certificados (rut, nombreVecino, nacionalidad, domicilio, tipo_residencia, motivo, id_vecino, id_uv) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (certificado.rut, certificado.nombreVecino, certificado.nacionalidad, certificado.domicilio, certificado.tipo_residencia, certificado.motivo, certificado.id_vecino, effective_id_uv)
            )
        else:
            cursor.execute(
                "INSERT INTO certificados (rut, nombreVecino, nacionalidad, domicilio, tipo_residencia, motivo, id_vecino) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (certificado.rut, certificado.nombreVecino, certificado.nacionalidad, certificado.domicilio, certificado.tipo_residencia, certificado.motivo, certificado.id_vecino)
            )
        conn.commit()
        return {"mensaje": "Certificado de residencia emitido con éxito"}
    except HTTPException:
        raise
    except Exception as e:
        print("Error al emitir certificado:", e)
        traceback.print_exc()
        try:
            if 'conn' in locals() and conn:
                conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if 'cursor' in locals() and cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if 'conn' in locals() and conn:
                conn.close()
        except Exception:
            pass
   
@router.get("/certificados/residencia/{rut}",tags=["CRUD Certificados"])
def obtener_certificado(rut: str):
    conn = conectar_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM certificados WHERE rut = %s ORDER BY fecha_solicitud DESC LIMIT 1",
        (rut,)
    )
    certificado = cursor.fetchone()
    cursor.close()
    conn.close()
    if not certificado:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return certificado

@router.get("/certificados/residencia",tags=["CRUD Certificados"])
def listar_certificados(id_uv: int | None = Depends(get_admin_uv)):
    """Lista certificados. Si el token no permite derivar id_uv devuelve lista vacía.
    Si id_uv está presente, filtra por la UV correspondiente (mediante join con vecinos si es necesario).
    """
    # Use central helper
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        certificados = list_by_uv(cursor, 'certificados', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_solicitud DESC')
        return certificados
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass


@router.get("/certificados/uv/{id_uv}", tags=["CRUD Certificados"])
def listar_certificados_por_uv(id_uv: int):
    """Listado de certificados filtrado por id_uv (recibe id_uv en el path)."""
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = list_by_uv(cursor, 'certificados', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='fecha_solicitud DESC')
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

class EstadoCertificado(BaseModel):
    estado: str
    razon: str = None  # Para la razón de rechazo

@router.put("/certificados/residencia/{id_certificado}",tags=["CRUD Certificados"])
def actualizar_estado_certificado(id_certificado: int, estado_data: EstadoCertificado, background_tasks: BackgroundTasks):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    # Si es rechazo, actualiza también la razón
    if estado_data.estado == "rechazado":
        cursor.execute(
            "UPDATE certificados SET estado = %s, razon_rechazo = %s WHERE id_certificado = %s",
            (estado_data.estado, estado_data.razon, id_certificado)
        )
    else:
        cursor.execute(
            "UPDATE certificados SET estado = %s WHERE id_certificado = %s",
            (estado_data.estado, id_certificado)
        )
    conn.commit()

    # Si es rechazo, busca el correo y envía el email
    if estado_data.estado == "rechazado":
        cursor.execute("SELECT id_vecino FROM certificados WHERE id_certificado = %s", (id_certificado,))
        cert = cursor.fetchone()
        if cert:
            cursor.execute("SELECT correo FROM vecinos WHERE id_vecino = %s", (cert["id_vecino"],))
            vecino = cursor.fetchone()
            if vecino and vecino["correo"]:
                background_tasks.add_task(enviar_correo_rechazo, vecino["correo"], estado_data.razon)
    cursor.close()
    conn.close()
    return {"mensaje": "Estado actualizado"}

def enviar_correo_rechazo(correo_destino, razon):
    remitente = EMAIL_USER
    password = EMAIL_PASS
    asunto = "Solicitud de Certificado Rechazada"
    cuerpo = f"Estimado/a,\n\nSu solicitud de certificado ha sido rechazada por la siguiente razón:\n\n{razon}\n\nAtentamente,\nJunta de Vecinos"

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = remitente
    msg["To"] = correo_destino
    msg.set_content(cuerpo)

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(remitente, password)
            smtp.send_message(msg)
        print(f"Correo de rechazo enviado a {correo_destino}")
    except Exception as e:
        print(f"Error al enviar correo de rechazo: {e}")

@router.post("/certificados/enviar_pdf/{id_certificado}",tags=["CRUD Certificados"])
def enviar_pdf_certificado(id_certificado: int, background_tasks: BackgroundTasks):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM certificados WHERE id_certificado = %s", (id_certificado,))
    certificado = cursor.fetchone()
    cursor.close()
    conn.close()
    if not certificado:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT correo FROM vecinos WHERE id_vecino = %s", (certificado["id_vecino"],))
    vecino = cursor.fetchone()
    cursor.close()
    conn.close()
    if not vecino or not vecino["correo"]:
        raise HTTPException(status_code=404, detail="Correo del vecino no encontrado")

    background_tasks.add_task(generar_y_enviar_pdf, certificado, vecino["correo"])
    return {"mensaje": "El PDF se está generando y enviando al correo."}

def generar_y_enviar_pdf(certificado, correo_destino):
    pdf = FPDF()
    pdf.add_page()

    # Título principal
    pdf.set_font("Arial", "B", 16)
    pdf.cell(0, 10, "Junta de Vecinos - Unidad Territorial", ln=True, align="C")
    pdf.ln(5)

    # Subtítulo
    pdf.set_font("Arial", "B", 14)
    pdf.cell(0, 10, "Certificado de Residencia", ln=True, align="C")
    pdf.ln(10)

    # Texto introductorio
    pdf.set_font("Arial", "", 12)
    pdf.multi_cell(0, 8,
        "Por medio del presente, la Junta de Vecinos certifica que el siguiente vecino reside en nuestra unidad territorial y cumple con los requisitos para la emisión de este documento.\n"
    )
    pdf.ln(5)

    # Datos del certificado
    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Nombre:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['nombreVecino'].upper(), ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "RUT:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['rut'], ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Domicilio:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['domicilio'].upper(), ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Tipo de residencia:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['tipo_residencia'].upper(), ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Nacionalidad:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['nacionalidad'].upper(), ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Motivo:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, certificado['motivo'], ln=True)

    pdf.set_font("Arial", "B", 12)
    pdf.cell(50, 8, "Fecha de solicitud:", 0, 0)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, str(certificado['fecha_solicitud']), ln=True)

    pdf.ln(15)
    pdf.set_font("Arial", "I", 11)
    pdf.multi_cell(
        0,
        8,
        "Este certificado es emitido a solicitud del interesado para los fines que estime convenientes.\n\nAtentamente,\nEquipo Administrativo\nJunta de Vecinos - Unidad Territorial"
    )

    # Línea para firma
    pdf.ln(20)
    pdf.set_font("Arial", "", 12)
    pdf.cell(0, 8, "_________________________", ln=True, align="R")
    pdf.cell(0, 8, "Firma y Timbre", ln=True, align="R")

    nombre = certificado['nombreVecino']
    nombre_archivo = re.sub(r'[^\w\s-]', '', nombre).strip().replace(' ', '_')
    pdf_output = f"certificado_{nombre_archivo}.pdf"
    pdf.output(pdf_output)

    # 2. Enviar el PDF por correo
    remitente = EMAIL_USER
    password = EMAIL_PASS
    asunto = "Certificado de Residencia"
    cuerpo = "Adjuntamos su certificado de residencia solicitado."

    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = remitente
    msg["To"] = correo_destino
    msg.set_content(cuerpo)

    try:
        with open(pdf_output, "rb") as f:
            file_data = f.read()
            file_name = pdf_output
        msg.add_attachment(file_data, maintype="application", subtype="pdf", filename=file_name)

        print(f"Enviando correo a {correo_destino} desde {remitente}...")
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(remitente, password)
            smtp.send_message(msg)
        print("Correo enviado exitosamente.")
    except Exception as e:
        print(f"Error al enviar correo: {e}")
    finally:
        if os.path.exists(pdf_output):
            os.remove(pdf_output)