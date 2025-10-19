import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def obtener_token(rut, contrasena):
    response = client.post("/login", json={"rut": rut, "contrasena": contrasena})
    assert response.status_code == 200
    return response.json()["access_token"]

def test_admin_puede_modificar_datos_sensibles():
    token = obtener_token("20.722.122-8", "147") # Credenciales de admin
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put("/vecinos/68", headers=headers, json={
        "correo": "nuevo_correo@example.com",
    })
    assert response.status_code == 200
    assert response.json()["correo"] == "nuevo_correo@example.com"

def test_vecino_no_puede_modificar_datos_sensibles():
    token = obtener_token("20.820.262-6", "123")  # Usa credenciales reales
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put("/vecinos/69", headers=headers, json={
        "correo": "hackeo@example.com",
    })
    assert response.status_code == 403  # Forbidden