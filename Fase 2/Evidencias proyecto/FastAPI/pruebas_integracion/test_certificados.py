import sys
import os
sys.path.insert(0, os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..')))
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_emitir_certificados_vecino():  # Prueba OK
    response = client.post("/certificados/residencia", json={
            "rut": "12.345.678-9",
            "nombreVecino": "Sebastian",
            "nacionalidad": "Chilena",
            "domicilio": "Clotario blest 1234",
            "tipo_residencia": "propietario",
            "motivo": "Motivo 1",
            "id_vecino": 18
    })
    assert response.status_code == 200  # Verifica que la solicitud fue exitosa


def test_emitir_certificados_sin_motivo():
    response = client.post("/certificados/residencia", json={
        "rut": "12.345.678-9",
        "nombreVecino": "Sebastian",
        "nacionalidad": "Chilena",
        "domicilio": "Clotario blest 1234",
        "tipo_residencia": "propietario",
        "motivo": "",
        "id_vecino": 18
    })
    # El código correcto es 422 por validación Pydantic
    assert response.status_code == 422

def test_emitir_certificados_vecino_inexistente():  # Prueba vecino no existente
    response = client.post("/certificados/residencia", json={
        "rut": "12.345.678-9",
        "nombreVecino": "Sebastian",
        "nacionalidad": "Chilena",
        "domicilio": "Clotario blest 1234",
        "tipo_residencia": "propietario",
        "motivo": "Motivo 1",
        "id_vecino": 9999,
    })
    # El código correcto es 404 por vecino no encontrado
    assert response.status_code == 404

def test_emitir_certificado_sin_campos():  # Prueba sin campos obligatorios
    response = client.post("/certificados/residencia", json={
        "rut": "",
        "nombreVecino": "",
        "nacionalidad": "",
        "domicilio": "",
        "tipo_residencia": "",
        "motivo": "",
        "id_vecino": None
    })
    # El código correcto es 422 por validación Pydantic
    assert response.status_code == 422

