from fastapi import APIRouter, HTTPException
from typing import List
from models.models import Usuario
from conexion import conectar_db

router = APIRouter(prefix="/usuarios", tags=["CRUD Usuarios"])


# CRUD usuarios

@router.get("/", response_model=List[Usuario])
def listar_usuarios():
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM usuarios")
    result = cursor.fetchall()

    cursor.close()
    conn.close()
    return result

@router.get("/{usuario_id}", response_model=Usuario)
def obtener_usuario(usuario_id: int):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT * FROM usuarios WHERE id_usuario = %s", (usuario_id,))
    usuario = cursor.fetchone()

    cursor.close()
    conn.close()

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario



@router.put("/{usuario_id}", response_model=Usuario)
def actualizar_usuario(usuario_id: int, usuario: Usuario):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)

    query = """
    UPDATE usuarios
    SET id_vecino=%s, nombre=%s, password_hash=%s, rol=%s, rut=%s
    WHERE id_usuario=%s
    """
    values = (usuario.id_vecino, usuario.nombre, usuario.password_hash, usuario.rol, usuario.rut, usuario_id)

    cursor.execute(query, values)
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    cursor.close()
    conn.close()

    usuario.id_usuario = usuario_id
    return usuario



@router.delete("/{usuario_id}")
def eliminar_usuario(usuario_id: int):
    conn = conectar_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM usuarios WHERE id_usuario = %s", (usuario_id,))
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    cursor.close()
    conn.close()

    return {"message": f"Usuario {usuario_id} eliminado correctamente"}


@router.put("/{user_id}/rol")
def actualizar_rol(user_id: int, rol: str):
    conn = conectar_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET rol=%s WHERE id_usuario=%s", (rol, user_id))
    conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    cursor.close()
    conn.close()
    return {"mensaje": "Rol actualizado"}