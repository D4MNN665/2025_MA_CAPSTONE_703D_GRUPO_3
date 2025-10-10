from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


# --------------------
# TABLA VECINOS
# --------------------
class Vecino(BaseModel):
    id_vecino: int
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
    id_usuario: int
    id_vecino: int
    nombre: str
    password_hash: str
    rol: Literal["admin", "directivo", "secretario", "tesorero", "vecino"] = "directivo"
    rut: str


# --------------------
# TABLA ACTIVIDADES
# --------------------
class Actividad(BaseModel):
    id_actividad: int
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    cupo_max: int
    cupo_actual: int = 0
    razon_rechazo: Optional[str] = None  



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
    razon_rechazo: Optional[str] = None  

    
# --------------------
# TABLA RESERVAS
# --------------------
class ReservaCreate(BaseModel): #  models para crear reservas ( sin id_reserva porque la bd se encarga automaticamente)
    id_vecino: int
    nombreSector: str
    fecha_inicio: str
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"

class Reserva(BaseModel): # models para consultar reservas ( con id_reserva)
    id_vecino: int
    id_reserva: int
    nombreSector: str
    fecha_inicio: str
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"
    nombre_completo: Optional[str] = None

# --------------------
# TABLA PROYECTOS
# --------------------
class Proyecto(BaseModel):
    id_proyecto: int
    id_vecino: int
    titulo: str
    descripcion: str
    fecha_postulacion: str
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"
    tipo_proyecto: str
    ubicacion: str
    fecha_resolucion: Optional[str] = None
    razon_rechazo: Optional[str] = None  


class ProyectoCrear(BaseModel):
    id_vecino: int
    titulo: str
    descripcion: str
    fecha_postulacion: str
    estado: Literal["pendiente", "aprobado", "rechazado"] = "pendiente"
    tipo_proyecto: str
    ubicacion: str


# --------------------
# TABLA NOTIFICACIONES
# --------------------
class Notificacion(BaseModel):
    id_notificacion: int
    titulo: str
    mensaje: str
    tipo: Literal["afiche", "email", "whatsapp"]
    fecha_envio: datetime = datetime.now()
    destinatario_id: int


# --------------------
# TABLA NOTICIAS
# --------------------
class Noticia(BaseModel):
    id_noticia: int
    titulo: str
    contenido: str
    fecha_publicacion: datetime = datetime.now()
    autor_id: int


# --------------------
# TABLA INSCRIPCIONES
# --------------------
class Inscripcion(BaseModel):
    id_inscripcion: int
    id_actividad: int
    id_vecino: int
    fecha_inscripcion: datetime = datetime.now()
