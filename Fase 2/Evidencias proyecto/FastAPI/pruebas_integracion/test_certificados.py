import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))) # Agrega la carpeta FastAPI al sys.path

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_emitir_certificado_campos_obligatorios():
    # Falta el campo 'rut'
    certificado_incompleto = {
        "nombreVecino": "Benjamin Valenzuela",
        "nacionalidad": "Chilena",
        "domicilio": "av. rinconada 262",
        "tipo_residencia": "Propietario",
        "motivo": "Trámite",
        "id_vecino": 1
    }
    response = client.post("/certificados/residencia", json=certificado_incompleto)
    assert response.status_code == 422  # Unprocessable Entity


    # Esta prueba verifica que la API responde con un error 422 cuando faltan campos obligatorios lo cual es cierto

def test_actualizar_estado_certificado_campos_obligatorios():
    # Falta el campo 'estado'
    estado_incompleto = {
        "razon": "Falta documentación"
    }
    response = client.put("/certificados/residencia/1", json=estado_incompleto)
    assert response.status_code == 422  # Unprocessable Entity

    # Esta prueba verifica que la API responde con un error 422 cuando faltan campos obligatorios lo cual es cierto