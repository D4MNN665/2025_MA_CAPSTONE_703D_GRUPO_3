import sys
import os
import random

from datetime import date, timedelta
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))) # Agrega la carpeta FastAPI al sys.path

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO MAYOR DE 14 AÑOS PUEDE INSCRIBIRSE
def test_inscripcion_vecino_mayor_14():
    rut = f"{random.randint(10000000, 99999999)}-0"
    print(rut)
    correo = f"{rut}@gmail.com"
    fecha_nacimiento = int((date.today() - timedelta(days=15*365)).strftime("%Y%m%d")) # Calcula la fecha actual pero 15 años atrás
    response = client.post("/vecinos/", json={
        "nombre": "test",
        "apellido": "mayor_14",
        "rut": rut,
        "correo": correo,
        "fecha_nacimiento": fecha_nacimiento,
        "numero_telefono": "912345678",
        "direccion": "Calle falsa 123",
        "contrasena": "123",
        "miembro": True
    })
    print(response.status_code, response.json())
    assert response.status_code == 200 or response.status_code == 201

# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO MENOR DE 14 AÑOS NO PUEDE INSCRIBIRSE
def test_inscripcion_vecino_menor_14():
    v_rut = f"{random.randint(10000000, 99999999)}-0"
    print(v_rut)
    correo = f"{v_rut}@gmail.com"

    fecha_nacimiento = int((date.today() - timedelta(days=13*365)).strftime("%Y%m%d")) # Calcula la fecha actual pero 13 años atrás
    response = client.post("/vecinos/", json={
        "nombre": "test",
        "apellido": "menor_14",
        "rut": v_rut,
        "correo": correo,
        "fecha_nacimiento": fecha_nacimiento,
        "numero_telefono": "912345679",
        "direccion": "Calle falsa 123",
        "contrasena": "123",
        "miembro": True
    })
    print(response.status_code, response.json())
    assert response.status_code == 400 or response.status_code == 422