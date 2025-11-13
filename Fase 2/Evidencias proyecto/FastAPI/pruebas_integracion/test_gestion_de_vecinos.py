import sys
import os
from urllib import response
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def obtener_token(rut, contrasena): # 
    response = client.post("/login", json={"rut": rut, "contrasena": contrasena})
    #print("Status code:", response.status_code)
    #print("Response text:", response.text)
    assert response.status_code == 200  # OK
    token = response.json()["access_token"]
    return token

def test_admin_puede_modificar_datos_sensibles():
    token = obtener_token("20.722.122-8", "147") # Credenciales de admin
    headers = {"Authorization": f"Bearer {token}"}
    id_vecino = 88 
    response = client.put(f"/vecinos/{id_vecino}", headers=headers, json={
        "correo": "nuevo_correo@gmail.com",
    })
    assert response.status_code == 200 # OK
    #print("Status code:", response.status_code)
    #print("Response text:", response.text)
    assert response.json()["correo"] == "nuevo_correo@gmail.com"

def test_vecino_no_puede_modificar_datos_sensibles():
    token = obtener_token("20.820.262-6", "123")  # Credenciales de vecino
    headers = {"Authorization": f"Bearer {token}"}
    id_vecino = 88 
    response = client.put(f"/vecinos/{id_vecino}", headers=headers, json={
        "correo": "sebastianpalma@gmail.com",
    })
    assert response.status_code == 403  # Forbidden
    #print("Status code:", response.status_code)
    #print("Response text:", response.text)