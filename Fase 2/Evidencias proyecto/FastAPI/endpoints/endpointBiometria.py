# endpoints/endpointBiometria.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from deepface import DeepFace
import tempfile, shutil, os

router = APIRouter(prefix="/biometria", tags=["biometria"])

@router.post("/verificar")
async def verificar_identidad(
    id_front: UploadFile = File(...),
    selfie: UploadFile = File(...)
):
    tmp_front = None
    tmp_selfie = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f1:
            shutil.copyfileobj(id_front.file, f1)
            tmp_front = f1.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as f2:
            shutil.copyfileobj(selfie.file, f2)
            tmp_selfie = f2.name

        # Modelo y detector recomendados
        result = DeepFace.verify(
            img1_path=tmp_front,
            img2_path=tmp_selfie,
            model_name="ArcFace",            # mejor separabilidad
            detector_backend="retinaface",   # detector más robusto
            distance_metric="cosine",
            enforce_detection=True           # exige detección real
        )
        # Regla correcta: match si distance <= threshold
        distance = float(result.get("distance", 1.0))
        threshold = float(result.get("threshold", 0.4))  # DeepFace devuelve uno específico
        match = distance <= threshold

        # Confianza normalizada 0..1 (aprox) según umbral
        # 1.0 cuando distance = 0 ; 0.5 cuando distance = threshold ; 0 si distance >= 2*threshold
        confidence = max(0.0, min(1.0, 1.0 - (distance/threshold)/2.0))

        return {
            "match": bool(match),
            "distance": distance,
            "threshold": threshold,
            "confidence": confidence
        }

    except Exception as e:
        # Si no detecta rostro con enforce_detection=True, caerá aquí
        raise HTTPException(status_code=422, detail=f"No se pudo detectar rostros válidos: {e}")
    finally:
        for p in (tmp_front, tmp_selfie):
            try:
                if p and os.path.exists(p):
                    os.remove(p)
            except:
                pass