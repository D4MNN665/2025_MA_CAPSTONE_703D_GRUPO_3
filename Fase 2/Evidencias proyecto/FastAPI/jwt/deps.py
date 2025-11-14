"""Dependencias JWT y utilidades de token.

Contiene helpers ligeros que no dependen de la aplicación FastAPI para evitar
import cycles entre `main.py` y los routers en `endpoints/`.
"""
from fastapi import Depends, Header, HTTPException, status
from conexion import conectar_db
from .jwt_utils import verificar_access_token


def get_bearer_token(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta encabezado Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1]


def get_current_user(token: str = Depends(get_bearer_token)) -> dict:
    payload = verificar_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sin 'sub'")
    db = conectar_db()
    if db is None:
        raise HTTPException(status_code=500, detail="No hay conexión a la base de datos")
    cur = db.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id_usuario, rol, id_uv, rut, nombre FROM usuarios WHERE id_usuario=%s",
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        user["id_uv_from_token"] = payload.get("id_uv")
        user["rol_from_token"] = payload.get("rol")
        return user
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass


def get_admin_uv(authorization: str | None = Header(None)) -> int | None:
    """Deriva id_uv del usuario actual de forma tolerante.

    - Si no hay Authorization o el token es inválido, devuelve None (no 401).
    - Intenta primero id_uv en el token; si no, recurre a la BD (usuarios → vecinos por id_vecino o rut).
    - En cualquier error de BD o formato, devuelve None.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        payload = verificar_access_token(token)
        if not payload:
            return None
    except Exception:
        return None

    uv_claim = payload.get("id_uv")
    if uv_claim is not None:
        try:
            return int(uv_claim)
        except Exception:
            return None

    user_id = payload.get("sub")
    if not user_id:
        return None
    db = conectar_db()
    if db is None:
        return None
    cur = db.cursor(dictionary=True)
    try:
        cur.execute("SELECT id_uv, id_vecino, rut FROM usuarios WHERE id_usuario = %s", (user_id,))
        row = cur.fetchone() or {}
        if row.get("id_uv") is not None:
            return int(row["id_uv"])
        if row.get("id_vecino") is not None:
            cur.execute("SELECT id_uv FROM vecinos WHERE id_vecino = %s", (row["id_vecino"],))
            v = cur.fetchone()
            if v and v.get("id_uv") is not None:
                return int(v["id_uv"])
        rut = row.get("rut") or payload.get("rut")
        if rut:
            cur.execute("SELECT id_uv FROM vecinos WHERE rut = %s LIMIT 1", (rut,))
            v2 = cur.fetchone()
            if v2 and v2.get("id_uv") is not None:
                return int(v2["id_uv"])
        return None
    except Exception:
        return None
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass
