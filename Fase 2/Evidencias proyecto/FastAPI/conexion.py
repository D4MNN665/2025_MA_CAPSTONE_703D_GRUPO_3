import mysql.connector
from mysql.connector import Error

def conectar_db():
    try:
        cnx = mysql.connector.connect(
            host="127.0.0.1",
            port=3306,
            user="root",
            password="1234",
            database="bd_sut",
            autocommit=False,
            connection_timeout=5
        )
        if cnx.is_connected():
            return cnx
    except Error as err:
        print(f"[DB] Error al conectar: {err}")
    return None