import sys
import os
from urllib import response
from datetime import datetime, timedelta
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_crear_actividad_sin_hacer_login():
    fecha_inicio = (datetime.now() + timedelta(days=2)).replace(microsecond=0).isoformat()
    fecha_fin = (datetime.now() + timedelta(days=2, hours=1)).replace(microsecond=0).isoformat()
    actividad = {
        "titulo": "Clase de yoga",
        "descripcion": "Clase de yoga para principiantes",
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "cupo_max": 20,
        "cupo_actual": 0,
        "id_usuario": None 
    }
    response = client.post("/actividades/", json=actividad)
    assert response.status_code == 422 # Unprocessable Entity debido a la falta de autenticación

def test_crear_actividad_logeado():
    response = client.post("/login/", json={"rut": "20.722.122-8", "contrasena": "147"})
    assert response.status_code == 200
    token = response.json().get("access_token")
    assert token is not None

    headers = {"Authorization": f"Bearer {token}"}
    fecha_inicio = (datetime.now() + timedelta(days=3)).replace(microsecond=0).isoformat()
    fecha_fin = (datetime.now() + timedelta(days=3, hours=1)).replace(microsecond=0).isoformat()
    actividad = {
        "titulo": "Clase de yoga",
        "descripcion": "Clase de yoga para principiantes",
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "cupo_max": 20,
        "cupo_actual": 1,
        "id_usuario": response.json().get("id_usuario")  
    }
    response = client.post("/actividades/", json=actividad, headers=headers)
    print("ACTIVIDAD:", response.status_code, response.json())
    assert response.status_code == 200 or response.status_code == 201