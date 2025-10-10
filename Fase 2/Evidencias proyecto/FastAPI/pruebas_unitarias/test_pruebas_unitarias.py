import pytest
from models.models import Usuario, Vecino
from pydantic import ValidationError



def test_vecino_tipo_dato_incorrecto():
    # 'id_vecino' debe ser int
    with pytest.raises(ValueError) as excinfo:
        Vecino(id_vecino="uno", nombre="Benjamin", apellido="Valenzuela", rut="12345678-9", correo="asd@b.com")
    print(excinfo.value)

def test_usuario_campos_obligatorios():
    # Falta 'nombre'
    with pytest.raises(ValidationError) as excinfo:
        Usuario(id_usuario=1, id_vecino=1, password_hash="asd", rol="admin", rut="12345678-9")
    print(excinfo.value)
#---------------------------------------------------------------------------------------------------------------------------
def test_usuario_rol_valido():
    u = Usuario(id_usuario=1, id_vecino=1, nombre="Sebastian", password_hash="123", rol="admin", rut="12345678-9")
    assert u.rol == "admin"
#---------------------------------------------------------------------------------------------------------------------------
def test_usuario_rol_invalido():
    with pytest.raises(ValueError) as excinfo:
        Usuario(id_usuario=1, id_vecino=1, nombre="Admin", password_hash="hash", rol="estoycansado", rut="12345678-9")
    print(excinfo.value)



# pytest -s para ver el log de los errores al ejecutar las 
# pytest -v 