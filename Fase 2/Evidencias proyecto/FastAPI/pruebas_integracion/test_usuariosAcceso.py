import sys
import os
import random

from datetime import date, timedelta
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))) # Agrega la carpeta FastAPI al sys.path
from main import app

from fastapi.testclient import TestClient

client = TestClient(app)

def generar_rut_valido():
    # Genera un número de 7 u 8 dígitos
    cuerpo = random.randint(10_000_000, 25_000_000)
    s = 1
    m = 0
    num = cuerpo
    while num > 0:
        s = (s + num % 10 * (9 - m % 6)) % 11
        m += 1
        num //= 10
    dv = 'K' if s == 0 else str(s - 1)
    # Formatea el RUT con puntos y guion
    rut_num = f"{cuerpo:,}".replace(",", ".")
    return f"{rut_num}-{dv}"

# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO MAYOR DE 14 AÑOS PUEDE INSCRIBIRSE
def test_inscripcion_vecino_mayor_14():
    rut = generar_rut_valido()
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
    assert response.status_code == 201 or response.status_code == 200  # OK y Created {'detail': 'Vecino registrado exitosamente.'}

# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO MENOR DE 14 AÑOS NO PUEDE INSCRIBIRSE
def test_inscripcion_vecino_menor_14():
    v_rut = generar_rut_valido()
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
    assert response.status_code == 400 # Bad Request {'detail': 'El vecino debe ser mayor de 14 años.'}

# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO PUEDE INICIAR SESION CON CREDENCIALES CORRECTAS
def test_login_vecino_correcto():
    response = client.post("/login", json={
        "rut": "20.722.122-8",
        "contrasena": "147"
    })
    print(response.status_code, response.json())
    if response.status_code != 200:
        print("Login failed:", response.content)
    else:
        print("Login successful:", response.json())
    
    assert response.status_code == 200 #OK 

# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO NO PUEDE INICIAR SESION CON CREDENCIALES INCORRECTAS
def test_login_vecino_incorrecto():
    response = client.post("/login", json={
        "rut": "20.722.122-8",
        "contrasena": "123"
    })
    print(response.status_code, response.json())
    if response.status_code != 200:
        print("Login failed:", response.content)
    else:
        print("Login successful:", response.json())

    assert response.status_code == 401 # Unauthorized 
# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO NO PUEDE INICIAR SESION SI NO ESTA REGISTRADO
def test_login_vecino_no_existe():
    v_rut = f"{random.randint(10000000, 99999999)}-0"
    response = client.post("/login", json={
        "rut": v_rut,
        "contrasena": "123"
    })
    print(response.status_code, response.json())
    if response.status_code != 200:
        print("Login failed:", response.content)
    else:
        print("Login successful:", response.json())

    assert response.status_code == 401 # Unauthorized 
# PRUEBAS DE INTEGRACION SEGUN EL REQUERIMIENTO QUE UN VECINO NO PUEDE REGISTRARSE CON RUT O CORREO YA EXISTENTE
def test_registro_duplicado():
    rut = "20.722.122-8"
    correo = f"{rut}@gmail.com"
    fecha_nacimiento = int((date.today() - timedelta(days=15*365)).strftime("%Y%m%d")) # Calcula la fecha actual pero 15 años atrás
    response = client.post("/vecinos/", json={
        "nombre": "test",
        "apellido": "duplicado",
        "rut": rut,
        "correo": correo,
        "fecha_nacimiento": fecha_nacimiento,
        "numero_telefono": "912345678",
        "direccion": "Calle falsa 123",
        "contrasena": "123",
        "miembro": True
    })
    print(response.status_code, response.json())
    assert response.status_code == 409 # Conflict {'detail': 'El RUT o correo ya están registrados.'} respuesta del front end

def test_validador_rut_invalido():
    rut="12345678-9" # RUT inválido
    response = client.post("/vecinos/", json={
        "nombre": "test",
        "apellido": "validacion",
        "rut": rut,
        "correo": "test.validacion@gmail.com",
        "fecha_nacimiento": 20000101,
        "numero_telefono": "912345680",
        "direccion": "Calle falsa 123",
        "contrasena": "123",
        "miembro": True
    })
    print(response.status_code, response.json())
    assert response.status_code == 422 # Unprocessable Entity {'detail': 'RUT inválido.'} respuesta del front end

