import mysql.connector
from mysql.connector import errorcode


def conectar_db():
    try:
        cnx = mysql.connector.connect(
            user='root',
            password='1234',
            host='localhost',
            database='bd_sut'
        )
        print("cnx lista")
        return cnx
    except mysql.connector.Error as err:
        print(f"Error al conectar a la base de datos: {err}")
        return None