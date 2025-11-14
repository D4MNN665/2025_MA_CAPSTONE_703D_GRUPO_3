from models.models import Actividad
from fastapi import HTTPException,APIRouter, Depends, Body, Header
from pydantic import ValidationError, BaseModel
from typing import List, Optional
from datetime import datetime

from conexion import conectar_db
from jwt.deps import get_admin_uv

router = APIRouter(
    prefix="/actividades",
    tags=["CRUD actividades"]
)


#CRUD actividades (eventos)


def iso_to_mysql(fecha_iso: str) -> str:
    # acepta ISO con Z y sin zona
    try:
        fecha_iso = fecha_iso.replace('Z', '')
        dt = datetime.fromisoformat(fecha_iso)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        # si no puede parsear, devuelva tal cual (DB puede rechazarlo)
        return fecha_iso


class ActividadCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    fecha_inicio: str
    fecha_fin: str
    cupo_max: int
    cupo_actual: int
    id_usuario: int

@router.get("", response_model=List[Actividad])
def obtener_actividades():
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor(dictionary=True)
    query = "SELECT id_actividad, titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual FROM actividades"

    try:
        cursor.execute(query)
        resultados = cursor.fetchall()
        # Attach enrolled users for each activity (if the table exists)
        actividades = []
        for row in resultados:
            try:
                cursor.execute(
                    "SELECT usuario_id FROM usuarios_en_actividades WHERE actividad_id = %s",
                    (row["id_actividad"],)
                )
                usuarios = [r["usuario_id"] for r in cursor.fetchall()]
            except Exception:
                usuarios = []
            row["usuarios_enrolados"] = usuarios
            actividades.append(Actividad(**row))
        return actividades
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener actividades: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.get("/{actividad_id}", response_model=Actividad)
def obtener_actividad(actividad_id: int):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor(dictionary=True)
    query = "SELECT id_actividad, titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual FROM actividades WHERE id_actividad = %s"
    
    try:
        cursor.execute(query, (actividad_id,))
        resultado = cursor.fetchone()
        if resultado is None:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        actividad = Actividad(**resultado)
        return actividad
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.post("", response_model=Actividad)
def crear_actividad(payload: dict = Body(...), id_uv: int | None = Depends(get_admin_uv), authorization: str | None = Header(None)):
    # payload -> validate into Actividad (exclude id_uv if present)
    id_uv_body = payload.get("id_uv")
    try:
        actividad_data = ActividadCreate.model_validate({k: v for k, v in payload.items() if k != "id_uv"})
    except ValidationError as ve:
        errores = [err.get('msg') or str(err) for err in ve.errors()]
        raise HTTPException(status_code=422, detail={"mensaje": "Datos inválidos en la solicitud", "errores": errores})

    # Debug: token in header
    try:
        print("[DEBUG] Authorization header (actividades):", authorization)
    except Exception:
        pass

    effective_id_uv = id_uv or id_uv_body
    if effective_id_uv is None:
        raise HTTPException(status_code=401, detail="No se pudo derivar id_uv del token")

    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")

    cursor = cnx.cursor()
    try:
        # Verificar si la tabla tiene columna id_uv
        try:
            cursor.execute(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s AND COLUMN_NAME = 'id_uv'",
                ("actividades",)
            )
            has_id_uv = cursor.fetchone() is not None
        except Exception:
            has_id_uv = False

        print(f"[DEBUG] crear_actividad effective_id_uv={effective_id_uv} has_id_uv={has_id_uv}")

        # Convertir fechas a formato MySQL
        fecha_inicio = iso_to_mysql(actividad_data.fecha_inicio)
        fecha_fin = iso_to_mysql(actividad_data.fecha_fin)

        if has_id_uv:
            query = """
                INSERT INTO actividades (titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual, id_uv)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (
                actividad_data.titulo,
                actividad_data.descripcion,
                fecha_inicio,
                fecha_fin,
                actividad_data.cupo_max,
                actividad_data.cupo_actual,
                effective_id_uv,
            )
        else:
            query = """
                INSERT INTO actividades (titulo, descripcion, fecha_inicio, fecha_fin, cupo_max, cupo_actual)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            values = (
                actividad_data.titulo,
                actividad_data.descripcion,
                fecha_inicio,
                fecha_fin,
                actividad_data.cupo_max,
                actividad_data.cupo_actual,
            )

        cursor.execute(query, values)
        cnx.commit()
        actividad_id = cursor.lastrowid
        # devolver payload similar a frontend expectations
        resp = {"id_actividad": actividad_id, **actividad_data.model_dump(), "fecha_inicio": fecha_inicio, "fecha_fin": fecha_fin}
        return resp
    except HTTPException:
        raise
    except Exception as e:
        cnx.rollback()
        print("Error al crear actividad:", e)
        raise HTTPException(status_code=500, detail=f"Error al crear la actividad: {e}")
    finally:
        try: cursor.close()
        except: pass
        try: cnx.close()
        except: pass


# Enrolar usuario a actividad
@router.post("/{id_actividad}/enrolar")
def enrolar_usuario(id_actividad: int, usuario_id: int = Body(..., embed=True)):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    cursor = cnx.cursor()
    try:
        # Verifica si el usuario ya está enrolado
        cursor.execute(
            "SELECT id FROM usuarios_en_actividades WHERE usuario_id = %s AND actividad_id = %s",
            (usuario_id, id_actividad)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El usuario ya está enrolado en esta actividad")
        # Enrola al usuario
        cursor.execute(
            "INSERT INTO usuarios_en_actividades (usuario_id, actividad_id) VALUES (%s, %s)",
            (usuario_id, id_actividad)
        )
        # Actualiza el cupo_actual
        cursor.execute(
            "UPDATE actividades SET cupo_actual = cupo_actual + 1 WHERE id_actividad = %s",
            (id_actividad,)
        )
        cnx.commit()
        return {"detail": "Usuario enrolado correctamente"}
    except HTTPException as he:
        cnx.rollback()
        raise he
    except Exception as e:
        cnx.rollback()
        print("Error al enrolar usuario:", e)
        raise HTTPException(status_code=500, detail="Error interno al enrolar usuario")
    finally:
        cursor.close()
        cnx.close()

@router.put("/{actividad_id}", response_model=Actividad)
def actualizar_actividad(actividad_id: int, actividad: Actividad):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor()
    query = """
        UPDATE actividades
        SET titulo = %s, descripcion = %s, fecha_inicio = %s, fecha_fin = %s, cupo_max = %s, cupo_actual = %s
        WHERE id_actividad = %s
    """
    
    try:
        cursor.execute(query, (
            actividad.titulo,
            actividad.descripcion,
            actividad.fecha_inicio,
            actividad.fecha_fin,
            actividad.cupo_max,
            actividad.cupo_actual,
            actividad_id
        ))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        cnx.commit()
        actividad.id_actividad = actividad_id
        return actividad
    except Exception as e:
        cnx.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.delete("/{actividad_id}")
def eliminar_actividad(actividad_id: int):
    cnx = conectar_db()
    if cnx is None:
        raise HTTPException(status_code=500, detail="Error al conectar a la base de datos")
    
    cursor = cnx.cursor()
    query = "DELETE FROM actividades WHERE id_actividad = %s"
    
    try:
        cursor.execute(query, (actividad_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Actividad no encontrada")
        cnx.commit()
        return {"detail": "Actividad eliminada correctamente"}
    except Exception as e:
        cnx.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar la actividad: {e}")
    finally:
        cursor.close()
        cnx.close()

@router.get("/uv/{id_uv}")
def listar_actividades_por_uv(id_uv: int):
    conn = conectar_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT * FROM actividades WHERE id_uv = %s
            ORDER BY fecha_inicio DESC
        """, (id_uv,))
        rows = cursor.fetchall()
        return rows
    finally:
        try: cursor.close()
        except: pass
        try: conn.close()
        except: pass

