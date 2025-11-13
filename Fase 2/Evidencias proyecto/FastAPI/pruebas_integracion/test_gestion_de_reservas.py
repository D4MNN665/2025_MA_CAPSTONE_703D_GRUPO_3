import sys
import os
from urllib import response
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_crear_reserva_sin_login():
    nueva_reserva = {
        "id_vecino": 1,
        "fecha": "2024-10-15",
        "hora_inicio": "10:00",
        "hora_fin": "12:00",
        "descripcion": "Reunión de vecinos"
    }
    response = client.post("/reservas/", json=nueva_reserva)
    assert response.status_code == 401 # Unauthorized
    datos_respuesta = response.json()

def test_crear_reserva_logeado():
    response = client.post("/login/", json={"rut": "20.722.122-8", "contrasena": "147"})
    #print("LOGIN:", response.status_code, response.json())  
    assert response.status_code == 200
    token = response.json().get("access_token")
    assert token is not None 

    headers = {"Authorization": f"Bearer {token}"}
    nueva_reserva = {
        "id_vecino": response.json().get("id_vecino"),
        "nombreSector": "Salón Comunal",
        "fecha_inicio": "2024-10-15",
        "estado": "pendiente"
    }
    response = client.post("/reservas/", json=nueva_reserva, headers=headers)
    #print("RESERVA:", response.status_code, response.json())  
    assert response.status_code == 200 or response.status_code == 201 # Created