from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Reserva, ReservaCreate
from conexion import conectar_db

router = APIRouter(prefix="/reservas", tags=["CRUD Reservas"])

# CRUD reservas
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
    if cursor.fetchone()["total"] >= 2:  # Cambia el numero segun la política
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


    query = """
    INSERT INTO reservas (id_vecino, nombreSector, fecha_inicio, estado)
    VALUES (%s, %s, %s, %s)
    """
    values = (
        reserva.id_vecino,
        reserva.nombreSector,
        reserva.fecha_inicio,
        reserva.estado
    )
    cursor.execute(query, values)
    conn.commit()

    id_reserva = cursor.lastrowid  # Obtener el id generado

    cursor.close()
    conn.close()

    # Crear y retornar un objeto Reserva (no ReservaCreate)
    return Reserva(
        id_reserva=id_reserva,
        id_vecino=reserva.id_vecino,
        nombreSector=reserva.nombreSector,
        fecha_inicio=reserva.fecha_inicio,
        estado=reserva.estado
    )

@router.get("/", response_model=List[Reserva])
def listar_reservas():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM reservas ORDER BY fecha_inicio DESC")
    result = cursor.fetchall()

    cursor.close()
    conn.close()
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
    return reserva

@router.put("/{reserva_id}", response_model=Reserva)
def actualizar_reserva(reserva_id: int, reserva: Reserva):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Validar existencia
    cursor.execute("SELECT id_reserva FROM reservas WHERE id_reserva = %s", (reserva_id,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Reserva no encontrada")

    query = """
    UPDATE reservas
    SET id_vecino=%s, nombreSector=%s, fecha_inicio=%s, estado=%s
    WHERE id_reserva=%s
    """
    values = (
        reserva.id_vecino,
        reserva.nombreSector,
        reserva.fecha_inicio,
        reserva.estado,
        reserva_id
    )
    cursor.execute(query, values)
    conn.commit()

    cursor.close()
    conn.close()

    reserva.id_reserva = reserva_id
    return reserva

@router.delete("/{reserva_id}")
def eliminar_reserva(reserva_id: int):
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM reservas WHERE id_reserva = %s", (reserva_id,))
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    
    cursor.close()
    conn.close()

    return {"message": f"Reserva {reserva_id} eliminada correctamente"}