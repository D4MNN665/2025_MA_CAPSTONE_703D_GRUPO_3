from jose import jwt, JWTError, ExpiredSignatureError
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime, timedelta, timezone
import os 
from fastapi import HTTPException, status, Depends
from dotenv import load_dotenv 

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")  # Ajusta el endpoint si es diferente

def crear_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    try:
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al crear el token: {str(e)}")

def verificar_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="El token ha expirado")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    except Exception as e: 
        raise HTTPException(status_code=500, detail=f"Error al verificar el token: {str(e)}")

def Obtener_usuario_actual_JWT(token: str = Depends(oauth2_scheme)):
    payload = verificar_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
        )
    return payload
