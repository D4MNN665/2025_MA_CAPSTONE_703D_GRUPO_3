from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from fastapi.security import OAuth2PasswordBearer
from fastapi import HTTPException, status, Depends
import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# oauth2 helper for FastAPI dependencies (tokenUrl matches /login endpoint)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

def crear_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    # use timezone-aware UTC expiry
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verificar_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        # keep compatibility with existing callers that expect None on invalid token
        return None


def Obtener_usuario_actual_JWT(token: str = Depends(oauth2_scheme)):
    """Dependency for FastAPI endpoints: validates token and returns payload or raises 401.

    This mirrors the helper used in the other project version and is safe to call from
    endpoints that want an explicit 401 when no/invalid token is provided.
    """
    payload = verificar_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
        )
    return payload