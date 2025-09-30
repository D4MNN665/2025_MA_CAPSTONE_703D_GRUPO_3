from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Reserva
from conexion import conectar_db

router = APIRouter(prefix="/reservas", tags=["CRUD Reservas"])


# CRUD reservas
@router.post("/", response_model=Reserva)
def crear_reserva(reserva: Reserva):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    # Validar vecino existente
    cursor.execute("SELECT id_vecino FROM vecinos WHERE id_vecino = %s", (reserva.id_vecino,))
    if cursor.fetchone() is None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="El vecino asociado no existe")

    query = """
    INSERT INTO reservas (id_vecino, espacio, fecha_reserva, estado)
    VALUES (%s, %s, %s, %s)
    """
    values = (
        reserva.id_vecino,
        reserva.espacio,
        reserva.fecha_inicio,
        reserva.fecha_fin,
        reserva.estado
    )
    cursor.execute(query, values)
    conn.commit()

    reserva.id_reserva = cursor.lastrowid
    cursor.close()
    conn.close()
    return reserva


@router.get("/", response_model=List[Reserva])
def listar_reservas():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM reservas ORDER BY fecha_fin DESC")
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
    SET id_vecino=%s, espacio=%s, fecha_reserva=%s, estado=%s
    WHERE id_reserva=%s
    """
    values = (
        reserva.id_vecino,
        reserva.espacio,
        reserva.fecha_inicio,
        reserva.fecha_fin,
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
