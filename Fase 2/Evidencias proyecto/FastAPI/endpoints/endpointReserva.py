from fastapi import APIRouter, HTTPException, Depends, Body, Header
from pydantic import ValidationError
from typing import List
from models.models import Reserva, ReservaCreate
from conexion import conectar_db
from jwt.deps import get_admin_uv
from .utils import list_by_uv
from datetime import datetime

def formatear_fecha(dt):
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            return dt.strftime("%d-%m-%Y")
        except Exception:
            return dt.replace("/", "-")
    return dt.strftime("%d-%m-%Y")

def parsear_fecha(fecha_str):
    # Intenta ISO primero
    try:
        return datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
    except Exception:
        pass
    # Intenta DD-MM-YYYY
    try:
        return datetime.strptime(fecha_str, "%d-%m-%Y")
    except Exception:
        pass
    # Intenta DD/MM/YYYY
    try:
        return datetime.strptime(fecha_str, "%d/%m/%Y")
    except Exception:
        pass
    raise ValueError(f"Formato de fecha no soportado: {fecha_str}")


router = APIRouter(prefix="/reservas", tags=["CRUD Reservas"])

@router.post("/", response_model=Reserva)
def crear_reserva(payload: dict = Body(...), id_uv: int | None = Depends(get_admin_uv), authorization: str | None = Header(None)):
    id_uv_body = payload.get("id_uv")
    try:
        reserva = ReservaCreate.model_validate({k: v for k, v in payload.items() if k != "id_uv"})
    except ValidationError as ve:
        errores = [err.get('msg') or str(err) for err in ve.errors()]
        raise HTTPException(status_code=422, detail={"mensaje": "Datos inválidos en la solicitud", "errores": errores})

    # Debug
    try:
        print("[DEBUG] Authorization header (reservas):", authorization)
    except Exception:
        pass

    effective_id_uv = id_uv or id_uv_body
    if effective_id_uv is None:
        raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")

    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Validar vecino existente
    cursor.execute("SELECT id_vecino FROM vecinos WHERE id_vecino = %s", (reserva.id_vecino,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El vecino asociado no existe")

    # Validar duplicidad por usuario
    cursor.execute(
        "SELECT * FROM reservas WHERE id_vecino = %s AND nombreSector = %s AND DATE(fecha_inicio) = DATE(%s)",
        (reserva.id_vecino, reserva.nombreSector, reserva.fecha_inicio)
    )
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Ya tienes una reserva para este sector y fecha.")

    # Limitar reservas pendientes o aprobadas por usuario
    cursor.execute(
        "SELECT COUNT(*) as total FROM reservas WHERE id_vecino = %s AND estado IN ('pendiente', 'aprobado')",
        (reserva.id_vecino,)
    )
    if cursor.fetchone()["total"] >= 2:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="No puedes tener más de 2 reservas activas.")

    # Validar si ya existe una reserva para el mismo sector y fecha (por cualquier persona)
    cursor.execute(
        "SELECT * FROM reservas WHERE nombreSector = %s AND DATE(fecha_inicio) = DATE(%s)",
        (reserva.nombreSector, reserva.fecha_inicio)
    )
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Ya existe una reserva para este sector y fecha.")

    # Convertir fecha_inicio a datetime para MySQL
    fecha_inicio_dt = parsear_fecha(reserva.fecha_inicio)

    # Comprobar si la tabla reservas tiene columna id_uv
    try:
        cursor.execute(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
            ("reservas",)
        )
        has_id_uv = cursor.fetchone() is not None
    except Exception:
        has_id_uv = False

    print(f"[DEBUG] crear_reserva effective_id_uv={effective_id_uv} has_id_uv={has_id_uv}")

    if has_id_uv:
        query = """
        INSERT INTO reservas (id_vecino, nombreSector, fecha_inicio, estado, id_uv)
        VALUES (%s, %s, %s, %s, %s)
        """
        values = (
            reserva.id_vecino,
            reserva.nombreSector,
            fecha_inicio_dt.strftime("%Y-%m-%d %H:%M:%S"),
            reserva.estado,
            effective_id_uv,
        )
    else:
        query = """
        INSERT INTO reservas (id_vecino, nombreSector, fecha_inicio, estado)
        VALUES (%s, %s, %s, %s)
        """
        values = (
            reserva.id_vecino,
            reserva.nombreSector,
            fecha_inicio_dt.strftime("%Y-%m-%d %H:%M:%S"),
            reserva.estado,
        )

    cursor.execute(query, values)
    conn.commit()
    id_reserva = cursor.lastrowid

    cursor.close()
    conn.close()

    return Reserva(
        id_reserva=id_reserva,
        id_vecino=reserva.id_vecino,
        nombreSector=reserva.nombreSector,
        fecha_inicio=formatear_fecha(fecha_inicio_dt),
        estado=reserva.estado
    )

@router.get("/", response_model=List[Reserva])
def listar_reservas(id_uv: int | None = Depends(get_admin_uv)):
    if id_uv is None:
        return []
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        result = list_by_uv(cursor, 'reservas', id_uv, join_table='vecinos', join_on='t.id_vecino = j.id_vecino', order_by='r.fecha_inicio DESC')
        # list_by_uv returns rows as dicts; for reservas we may want to add nombre_completo as before
        for r in result:
            if 'nombre' in r and 'apellido' in r:
                r['nombre_completo'] = f"{r.get('nombre')} {r.get('apellido')}"
        return result
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass
    cursor.close()
    conn.close()
    # Formatear fechas y agregar nombre completo
    for r in result:
        r["fecha_inicio"] = formatear_fecha(r["fecha_inicio"])
        r["nombre_completo"] = f"{r['nombre']} {r['apellido']}"
    return result


@router.get("/uv/{id_uv}")
def listar_reservas_por_uv(id_uv: int):
    """Listado público/administrativo de reservas por id_uv (igual que /reservas pero recibe id_uv por path)."""
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.*, v.nombre, v.apellido
            FROM reservas r
            JOIN vecinos v ON r.id_vecino = v.id_vecino
            WHERE r.id_uv = %s
            ORDER BY r.fecha_inicio DESC
        """, (id_uv,))
        rows = cursor.fetchall()
        for r in rows:
            r['nombre_completo'] = f"{r.get('nombre', '')} {r.get('apellido', '')}".strip()
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

@router.get("/{reserva_id}", response_model=Reserva)
def obtener_reserva(reserva_id: int):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM reservas WHERE id_reserva = %s", (reserva_id,))
    reserva = cursor.fetchone()
    cursor.close()
    conn.close()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    reserva["fecha_inicio"] = formatear_fecha(reserva["fecha_inicio"])
    return reserva

@router.put("/{reserva_id}", response_model=Reserva)
def actualizar_reserva(reserva_id: int, reserva: ReservaCreate):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id_reserva FROM reservas WHERE id_reserva = %s", (reserva_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    fecha_inicio_dt = parsear_fecha(reserva.fecha_inicio)

    query = """
    UPDATE reservas
    SET id_vecino=%s, nombreSector=%s, fecha_inicio=%s, estado=%s
    WHERE id_reserva=%s
    """
    values = (
        reserva.id_vecino,
        reserva.nombreSector,
        fecha_inicio_dt.strftime("%Y-%m-%d %H:%M:%S"),
        reserva.estado,
        reserva_id
    )
    cursor.execute(query, values)
    conn.commit()
    cursor.close()
    conn.close()
    return Reserva(
        id_reserva=reserva_id,
        id_vecino=reserva.id_vecino,
        nombreSector=reserva.nombreSector,
        fecha_inicio=formatear_fecha(fecha_inicio_dt),
        estado=reserva.estado
    )

@router.delete("/{reserva_id}")
def eliminar_reserva(reserva_id: int):
    conn = conectar_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reservas WHERE id_reserva = %s", (reserva_id,))
    conn.commit()
    if cursor.rowcount == 0:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    cursor.close()
    conn.close()
    return {"message": f"Reserva {reserva_id} eliminada correctamente"}