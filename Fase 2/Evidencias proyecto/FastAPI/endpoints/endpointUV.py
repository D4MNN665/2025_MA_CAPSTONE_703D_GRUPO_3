from fastapi import APIRouter, HTTPException, Query
from conexion import conectar_db, geocode_google
import os
import requests
import traceback
import math
import json
import re
import time  # ⬅️ agregado

# ---------------------------------------------------------
# Router PÚBLICO del módulo
# ---------------------------------------------------------
router = APIRouter(prefix="/uv", tags=["Unidades Vecinales"])

# BBOX aprox. Maipú (minLon, minLat, maxLon, maxLat)
MAIPU_BBOX = (-70.873, -33.625, -70.683, -33.455)

# Claves opcionales (para fallbacks)
GEOAPIFY_KEY = os.getenv("GEOAPIFY_KEY", "")
OPENCAGE_KEY = os.getenv("OPENCAGE_KEY", "")


# ========= Helpers comunes =========
def in_bbox(lat: float, lon: float, bbox) -> bool:
    minLon, minLat, maxLon, maxLat = bbox
    return (minLat <= lat <= maxLat) and (minLon <= lon <= maxLon)


def split_address(direccion: str):
    """
    Trata de separar "calle" y "número".
    Soporta:
      - 'Las Naciones 857'
      - 'Las Naciones N° 857' / 'No. 857' / 'Nº 857'
    Si no detecta número, devuelve (direccion_limpia, None)
    """
    s = (direccion or "").strip().strip(",")
    # 'Calle 123A'
    m = re.match(r"^\s*([A-Za-zÁÉÍÓÚÑáéíóúüÜ0-9\.\s]+?)\s+(\d+[A-Za-z\-\/]?)\s*$", s)
    if m:
        street = m.group(1).strip().strip(",")
        number = m.group(2).strip()
        return street, number
    # 'Calle N° 123'
    m = re.match(r"^\s*(.+?)\s*(?:Nº|N°|No\.?)\s*(\d+[A-Za-z\-\/]?)\s*$", s, re.I)
    if m:
        street = m.group(1).strip().strip(",")
        number = m.group(2).strip()
        return street, number
    return s, None


# ========= Geocoders (fallbacks) =========
def geocode_nominatim(direccion: str, comuna: str, pais: str, timeout_sec: float = 6.0):
    headers = {"User-Agent": "JV-Loader/1.0 (dev@example.com)", "Accept-Language": "es"}
    url = "https://nominatim.openstreetmap.org/search"

    street, number = split_address(direccion)

    # (1) estructurado
    if number:
        try:
            params = {
                "street": f"{number} {street}",
                "city": comuna,
                "country": pais,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 5,
                "polygon_geojson": 0,
            }
            r = requests.get(url, params=params, headers=headers, timeout=timeout_sec)  # ⬅️ timeout dinámico
            r.raise_for_status()
            items = r.json() or []

            def is_house(i):
                t = (i.get("type") or "").lower()
                at = (i.get("addresstype") or "").lower()
                addr = i.get("address") or {}
                return (
                    t in ("house", "building")
                    or at in ("house", "building")
                    or bool(addr.get("house_number"))
                )

            candidates = [i for i in items if is_house(i)]
            if candidates:
                best = max(candidates, key=lambda i: float(i.get("importance", 0) or 0))
                return {
                    "lat": float(best["lat"]),
                    "lon": float(best["lon"]),
                    "display_name": best.get("display_name", ""),
                    "source": "nominatim(structured)",
                }
        except Exception:
            pass

    # (2) libre
    base_variants = [
        f"{direccion}, {comuna}, {pais}",
        f"{direccion}, {comuna}, Región Metropolitana de Santiago, {pais}",
        f"{direccion}, {pais}",
        f"{street}, {comuna}, {pais}",
        f"{street}, Maipu, {pais}",
        f"{street}, Maipú, {pais}",
    ]
    for q in base_variants:
        try:
            params = {
                "q": q,
                "format": "jsonv2",
                "addressdetails": 1,
                "limit": 5,
                "countrycodes": "cl",
                "polygon_geojson": 0,
            }
            r = requests.get(url, params=params, headers=headers, timeout=timeout_sec)  # ⬅️ timeout dinámico
            r.raise_for_status()
            items = r.json() or []
            if not items:
                continue
            best = max(
                items,
                key=lambda i: (
                    {"house": 3, "building": 2, "address": 2, "residential": 1}.get(
                        (i.get("type") or ""), 0
                    ),
                    float(i.get("importance", 0) or 0),
                ),
            )
            return {
                "lat": float(best["lat"]),
                "lon": float(best["lon"]),
                "display_name": best.get("display_name", ""),
                "source": "nominatim",
            }
        except Exception:
            pass

    return None


def geocode_geoapify(direccion: str, comuna: str, pais: str, timeout_sec: float = 5.0):
    if not GEOAPIFY_KEY:
        return None
    url = "https://api.geoapify.com/v1/geocode/search"
    params = {
        "text": f"{direccion}, {comuna}, {pais}",
        "format": "json",
        "apiKey": GEOAPIFY_KEY,
        "filter": f"countrycode:cl|city:{comuna}",
        "limit": 5,
    }
    minLon, minLat, maxLon, maxLat = MAIPU_BBOX
    params["bias"] = f"rect:{minLon},{minLat},{maxLon},{maxLat}"
    r = requests.get(url, params=params, timeout=timeout_sec)  # ⬅️ timeout dinámico
    r.raise_for_status()
    data = r.json()
    feats = data.get("results") or []
    if not feats:
        return None
    best = feats[0]
    return {
        "lat": float(best["lat"]),
        "lon": float(best["lon"]),
        "display_name": best.get("formatted", ""),
        "source": "geoapify",
    }


def geocode_opencage(direccion: str, comuna: str, pais: str, timeout_sec: float = 5.0):
    if not OPENCAGE_KEY:
        return None
    url = "https://api.opencagedata.com/geocode/v1/json"
    params = {
        "q": f"{direccion}, {comuna}, {pais}",
        "key": OPENCAGE_KEY,
        "countrycode": "cl",
        "limit": 5,
        "no_annotations": 1,
    }
    r = requests.get(url, params=params, timeout=timeout_sec)  # ⬅️ timeout dinámico
    r.raise_for_status()
    res = r.json()
    items = res.get("results") or []
    if not items:
        return None
    best = items[0]
    lat = best["geometry"]["lat"]
    lon = best["geometry"]["lng"]
    return {
        "lat": float(lat),
        "lon": float(lon),
        "display_name": best.get("formatted", ""),
        "source": "opencage",
    }


def geocode_best(direccion: str, comuna: str, pais: str, timeout_ms: int = 12000):
    """
    PRIORIDAD:
      1) Google (si hay clave)
      2) Nominatim
      3) Geoapify
      4) OpenCage

    Respeta un presupuesto total de tiempo (timeout_ms).
    """
    deadline = time.time() + max(timeout_ms, 2000) / 1000.0

    def left(default_sec: float):
        t = deadline - time.time()
        return max(1.0, min(default_sec, t))

    # 1) Google
    google_outside = None
    try:
        g = geocode_google(direccion, comuna, pais, timeout_sec=left(6.0))
        if g:
            # si está dentro del bbox, retornamos ya
            if in_bbox(g["lat"], g["lon"], MAIPU_BBOX):
                return g
            google_outside = g
    except Exception:
        pass

    # 2-4) Fallbacks con presupuesto restante
    for fn, def_sec in ((geocode_nominatim, 5.0), (geocode_geoapify, 4.0), (geocode_opencage, 4.0)):
        try:
            g = fn(direccion, comuna, pais, timeout_sec=left(def_sec))
            if not g:
                continue
            if in_bbox(g["lat"], g["lon"], MAIPU_BBOX):
                return g
            if not google_outside:
                google_outside = g
        except Exception:
            continue

    # si nada cayó dentro del bbox, devolvemos el mejor fuera
    return google_outside


# ========= Distancias (Haversine) =========
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def min_vertex_distance(gj_str, p_lat, p_lon):
    try:
        gjson = json.loads(gj_str or "{}")
    except Exception:
        return float("inf")
    t = gjson.get("type")
    if t not in ("Polygon", "MultiPolygon"):
        return float("inf")
    dmin = float("inf")
    if t == "Polygon":
        for ring in gjson.get("coordinates", []):
            for lonv, latv in ring:
                dmin = min(dmin, haversine_m(p_lat, p_lon, latv, lonv))
    else:
        for poly in gjson.get("coordinates", []):
            for ring in poly:
                for lonv, latv in ring:
                    dmin = min(dmin, haversine_m(p_lat, p_lon, latv, lonv))
    return dmin


# ========= Endpoints =========
@router.get("/assign", summary="Geocodifica una dirección y asigna UV")
def assign_uv(
    direccion: str = Query(..., description="Ej: 'Las Naciones 857'"),
    comuna: str = Query("Maipú"),
    pais: str = Query("Chile"),
    timeout_ms: int = Query(12000, ge=2000, le=60000),  # ⬅️ nuevo: presupuesto total geocoder
):
    """
    1) Geocodifica con presupuesto de tiempo total.
    2) Si el punto cae dentro de una UV => esa UV.
    3) Si no, devuelve la UV más cercana por distancia a vértices (Haversine).
    """
    try:
        print(">>> /uv/assign", {"direccion": direccion, "comuna": comuna, "pais": pais, "timeout_ms": timeout_ms})

        g = geocode_best(direccion, comuna, pais, timeout_ms=timeout_ms)  # ⬅️ usar presupuesto
        if not g:
            raise HTTPException(status_code=404, detail="Dirección no encontrada")

        lat = float(g["lat"])
        lon = float(g["lon"])
        print(f">>> GEOCODED lat={lat}, lon={lon}, src={g.get('source')}")

        db = conectar_db()
        if db is None:
            raise HTTPException(status_code=500, detail="No se pudo conectar a la base de datos")
        cur = db.cursor(dictionary=True)
        try:
            # 1) Contención exacta con SRID nativo de la tabla
            cur.execute(
                """
                SELECT id_uv, nombre
                FROM juntas_vecinos
                WHERE ST_Contains(
                    geom,
                    ST_GeomFromText(CONCAT('POINT(', %s, ' ', %s, ')'), ST_SRID(geom))
                )
                LIMIT 1
                """,
                (lon, lat),
            )
            row = cur.fetchone()
            if row:
                return {
                    "ok": True,
                    "geocoding": {**g},
                    "uv": {
                        "id_uv": row["id_uv"],
                        "nombre": row["nombre"],
                        "inside": True,
                        "dist_m": 0.0,
                    },
                    "edge": False,
                }

            # 2) Más cercana por distancia mínima a vértices (Haversine)
            cur.execute("""SELECT id_uv, nombre, ST_AsGeoJSON(geom) AS gj FROM juntas_vecinos""")
            polys = cur.fetchall() or []
            if not polys:
                raise HTTPException(status_code=404, detail="No hay UV cargadas")

            best_row, best_d = None, float("inf")
            for r in polys:
                d = min_vertex_distance(r["gj"], lat, lon)
                if d < best_d:
                    best_d, best_row = d, r

            return {
                "ok": True,
                "geocoding": {**g},
                "uv": {
                    "id_uv": best_row["id_uv"],
                    "nombre": best_row["nombre"],
                    "inside": False,
                    "dist_m": float(best_d),
                },
                "edge": float(best_d) < 30.0,
            }
        finally:
            try:
                cur.close()
            except Exception:
                pass
            try:
                db.close()
            except Exception:
                pass

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")


@router.get("/by_point", summary="Devuelve UV que contiene el punto o la más cercana")
def uv_by_point(lat: float = Query(...), lon: float = Query(...)):
    db = conectar_db()
    if db is None:
        raise HTTPException(status_code=500, detail="No se pudo conectar a la base de datos")
    cur = db.cursor(dictionary=True)
    try:
        wkt = f"POINT({lon} {lat})"
        # 1) Contención exacta en SRID nativo
        cur.execute(
            """
            SELECT id_uv, nombre
            FROM juntas_vecinos
            WHERE ST_Contains(geom, ST_GeomFromText(%s, ST_SRID(geom)))
            LIMIT 1
            """,
            (wkt,),
        )
        row = cur.fetchone()
        if row:
            return {
                "ok": True,
                "uv": {"id_uv": row["id_uv"], "nombre": row["nombre"], "inside": True, "dist_m": 0.0},
                "edge": False,
            }

        # 2) Más cercana por vértices (Haversine)
        cur.execute("""SELECT id_uv, nombre, ST_AsGeoJSON(geom) AS gj FROM juntas_vecinos""")
        polys = cur.fetchall() or []
        if not polys:
            raise HTTPException(status_code=404, detail="No hay UV cargadas")

        best_row, best_d = None, float("inf")
        for r in polys:
            d = min_vertex_distance(r["gj"], lat, lon)
            if d < best_d:
                best_d, best_row = d, r

        return {
            "ok": True,
            "uv": {"id_uv": best_row["id_uv"], "nombre": best_row["nombre"], "inside": False, "dist_m": float(best_d)},
            "edge": float(best_d) < 30.0,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            cur.close()
        except Exception:
            pass
        try:
            db.close()
        except Exception:
            pass