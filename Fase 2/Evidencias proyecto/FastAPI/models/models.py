from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


# --------------------
# TABLA VECINOS
# --------------------
class Vecino(BaseModel):
    id_vecino: Optional[int] = None
    nombre: str
    apellido: str
    rut: str
    correo: str
    numero_telefono: Optional[str] = None
    direccion: Optional[str] = None
    miembro: bool = False  # tinyint → bool
    contrasena: Optional[str] = None


# --------------------
# TABLA USUARIOS
# --------------------
class Usuario(BaseModel):
    id_usuario: Optional[int] = None
    id_vecino: int
    nombre: str
    password_hash: str
    rol: Literal["admin", "directivo", "secretario", "tesorero", "vecino"] = "directivo"
    rut: str


# --------------------
# TABLA ACTIVIDADES
# --------------------
class Actividad(BaseModel):
    id_actividad: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    cupo_max: int
    cupo_actual: int = 0


# --------------------
# TABLA CERTIFICADOS
# --------------------
class CertificadoResidencia(BaseModel):
    rut: str
    nombreVecino: str
    nacionalidad: str
    domicilio: str
    tipo_residencia: str
    motivo: str
    id_vecino: int
    
# --------------------
# TABLA RESERVAS
# --------------------
class Reserva(BaseModel):
    id_reserva: Optional[int] = None
    id_vecino: int
    espacio: str
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"


# --------------------
# TABLA PROYECTOS
# --------------------
class Proyecto(BaseModel):
    id_proyecto: Optional[int] = None
    id_vecino: int
    titulo: str
    descripcion: str
    fecha_postulacion: datetime = datetime.now()
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"
    fecha_resolucion: Optional[datetime] = None
    resolucion_email: Optional[str] = None


# --------------------
# TABLA NOTIFICACIONES
# --------------------
class Notificacion(BaseModel):
    id_notificacion: Optional[int] = None
    titulo: str
    mensaje: str
    tipo: Literal["afiche", "email", "whatsapp"]
    fecha_envio: datetime = datetime.now()
    destinatario_id: Optional[int] = None


# --------------------
# TABLA NOTICIAS
# --------------------
class Noticia(BaseModel):
    id_noticia: Optional[int] = None
    titulo: str
    contenido: str
    fecha_publicacion: datetime = datetime.now()
    autor_id: int


# --------------------
# TABLA INSCRIPCIONES
# --------------------
class Inscripcion(BaseModel):
    id_inscripcion: Optional[int] = None
    id_actividad: int
    id_vecino: int
    fecha_inscripcion: datetime = datetime.now()
