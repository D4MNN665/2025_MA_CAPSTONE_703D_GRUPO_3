import os
import requests
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv


load_dotenv()

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

# -------------------------------
# Google Maps Geocoding
# -------------------------------
_GOOGLE_MAPS_KEY = (os.getenv("GOOGLE_MAPS_KEY") or "").strip()

_google_session = requests.Session()
_google_session.headers.update({
    "User-Agent": "JV-Loader/1.0 (+jorge-dev-demo)"
})

def geocode_google(direccion: str, comuna: str = "Maipú", pais: str = "Chile", timeout_sec: float = 8.0):
    """
    Geocodifica con Google Maps (dirección -> lat/lon).
    Devuelve dict con: lat, lon, display_name, source='google'
    Si no hay clave o falla, devuelve None.
    timeout_sec: límite por request.
    """
    if not _GOOGLE_MAPS_KEY:
        print("[GOOGLE] Falta GOOGLE_MAPS_KEY")
        return None

    try:
        # limpiamos espacios extra y evitamos repetir comuna/pais
        q = f"{(direccion or '').strip()}, {comuna}, {pais}".strip(", ")

        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {
            "address": q,
            # región para sesgo a Chile
            "region": "cl",
            # componentes para sesgo fuerte a Maipú/Chile
            # Nota: 'administrative_area' no siempre matchea; 'locality' Maipú ayuda bastante
            "components": "country:CL|locality:Maipú",
            "key": _GOOGLE_MAPS_KEY,
        }

        r = _google_session.get(url, params=params, timeout=timeout_sec)  # ⬅️ usa timeout paramétrico
        r.raise_for_status()
        data = r.json()

        if data.get("status") == "OK" and data.get("results"):
            # Tomamos el 1º resultado; si quieres, filtra por 'types'
            res0 = data["results"][0]
            loc = res0["geometry"]["location"]
            return {
                "lat": float(loc["lat"]),
                "lon": float(loc["lng"]),
                "display_name": res0.get("formatted_address", q),
                "source": "google",
            }

        print("[GOOGLE] sin resultados:", data.get("status"), data.get("error_message"))
        return None

    except Exception as e:
        print("[GOOGLE] error:", e)
        return None
