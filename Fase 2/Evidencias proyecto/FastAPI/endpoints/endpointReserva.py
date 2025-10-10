from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Reserva, ReservaCreate
from conexion import conectar_db
from datetime import datetime

def formatear_fecha(dt):
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            dt = datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")
    return dt.strftime("%d/%m/%Y")  # Solo día/mes/año

router = APIRouter(prefix="/reservas", tags=["CRUD Reservas"])

@router.post("/", response_model=Reserva)
def crear_reserva(reserva: ReservaCreate):
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
    fecha_inicio_dt = datetime.fromisoformat(reserva.fecha_inicio.replace("Z", "+00:00"))

    query = """
    INSERT INTO reservas (id_vecino, nombreSector, fecha_inicio, estado)
    VALUES (%s, %s, %s, %s)
    """
    values = (
        reserva.id_vecino,
        reserva.nombreSector,
        fecha_inicio_dt.strftime("%Y-%m-%d %H:%M:%S"),
        reserva.estado
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
def listar_reservas():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.*, v.nombre, v.apellido
        FROM reservas r
        JOIN vecinos v ON r.id_vecino = v.id_vecino
        ORDER BY r.fecha_inicio DESC
    """)
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    # Formatear fechas y agregar nombre completo
    for r in result:
        r["fecha_inicio"] = formatear_fecha(r["fecha_inicio"])
        r["nombre_completo"] = f"{r['nombre']} {r['apellido']}"
    return result

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

    fecha_inicio_dt = datetime.fromisoformat(reserva.fecha_inicio.replace("Z", "+00:00"))

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