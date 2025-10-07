// src/pages/registro.jsx
import React, { useRef, useState, useEffect } from "react";
import "../App.css";
import Webcam from "react-webcam";
import axios from "axios";
import * as faceapi from "face-api.js";
import { Modal, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

// Backend
const API_BASE = "http://localhost:8000";
// Modelos de face-api.js (ponlos en /public/models)
const FACEAPI_MODELS_URL = "/models";

// -----------------------------
// Helpers FaceAPI
// -----------------------------
let faceApiReady = false;

async function ensureFaceApiLoaded() {
  if (faceApiReady) return;
  await faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODELS_URL);
  faceApiReady = true;
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function dataURLtoFile(dataUrl, filename) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

function cropFromBox(img, box, paddingRatio = 0.35) {
  const { x, y, width, height } = box;
  const padX = width * paddingRatio;
  const padY = height * paddingRatio;

  const sx = Math.max(0, x - padX);
  const sy = Math.max(0, y - padY);
  const sw = Math.min(img.width - sx, width + padX * 2);
  const sh = Math.min(img.height - sy, height + padY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

async function cropFaceFromImageFile(file) {
  await ensureFaceApiLoaded();
  const img = await fileToImage(file);

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

  const detection = await faceapi
    .detectSingleFace(img, options)
    .withFaceLandmarks();

  if (!detection) {
    return { file, previewUrl: URL.createObjectURL(file), cropped: false };
  }

  const box = detection.detection.box;
  const canvas = cropFromBox(img, box, 0.35);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92)
  );
  const croppedFile = new File([blob], `id_front_cropped.jpg`, {
    type: "image/jpeg",
  });

  return {
    file: croppedFile,
    previewUrl: URL.createObjectURL(croppedFile),
    cropped: true,
  };
}

async function cropFaceFromDataUrl(dataUrl) {
  await ensureFaceApiLoaded();
  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = await new Promise((res, rej) => {
    img.onload = () => res(true);
    img.onerror = rej;
    img.src = dataUrl;
  });

  if (!loaded)
    return { dataUrl, file: dataURLtoFile(dataUrl, "selfie.jpg"), cropped: false };

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });

  const detection = await faceapi
    .detectSingleFace(img, options)
    .withFaceLandmarks();

  if (!detection) {
    return { dataUrl, file: dataURLtoFile(dataUrl, "selfie.jpg"), cropped: false };
  }

  const box = detection.detection.box;
  const canvas = cropFromBox(img, box, 0.25);
  const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const file = dataURLtoFile(croppedDataUrl, "selfie_cropped.jpg");

  return { dataUrl: croppedDataUrl, file, cropped: true };
}

// -----------------------------
// Componente
// -----------------------------
const Registro = () => {
  // Form
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    rut: "",
    correo: "",
    telefono: "",
    direccion: "",
    password: "",
    password2: "",
  });

  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);

  // Modal / Webcam
  const [showVerify, setShowVerify] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null); // { match, score(confidence), distance, threshold, error? }
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  // Pre-cargar modelos
  useEffect(() => {
    ensureFaceApiLoaded().catch(console.error);
  }, []);

  // Detener cámara al cerrar
  const stopCamera = () => {
    try {
      const video = webcamRef.current?.video;
      const stream = video?.srcObject;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
  };

  const handleCloseVerify = () => {
    stopCamera();
    setShowVerify(false);
    setCapturedSelfie(null);
    setCompareResult(null);
    setComparing(false);
  };

  // Handlers
  const onChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  // Carnet (frente): recorte automático
  const onFileFront = async (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      setIdFrontFile(null);
      setIdFrontPreview(null);
      return;
    }

    try {
      const { file, previewUrl, cropped } = await cropFaceFromImageFile(f);
      setIdFrontFile(file);
      setIdFrontPreview(previewUrl);
      if (cropped) console.log("✅ Rostro recortado del carnet.");
      else console.log("⚠️ No se detectó rostro, usando imagen completa.");
    } catch (err) {
      console.error(err);
      setIdFrontFile(f);
      setIdFrontPreview(URL.createObjectURL(f));
    }
  };

  // Carnet (reverso): sin recorte
  const onFileBack = (e) => {
    const f = e.target.files?.[0];
    setIdBackFile(f || null);
    setIdBackPreview(f ? URL.createObjectURL(f) : null);
  };

  // Enviar → abrir modal biometría
  const onSubmit = (e) => {
    e.preventDefault();
    if (!idFrontFile) return alert("Sube el carnet (frente) para verificar.");
    if (form.password !== form.password2)
      return alert("Las contraseñas no coinciden.");
    setShowVerify(true);
  };

  // Capturar selfie
  const captureSelfie = async () => {
    const imageSrc = webcamRef.current?.getScreenshot(); // base64
    if (!imageSrc) return;

    try {
      const { dataUrl, cropped } = await cropFaceFromDataUrl(imageSrc);
      setCapturedSelfie(dataUrl);
      if (cropped) console.log("✅ Selfie recortada automáticamente.");
      else console.log("⚠️ No se detectó rostro en la selfie.");
    } catch (e) {
      console.error(e);
      setCapturedSelfie(imageSrc);
    }
  };

  // Comparar rostros (carnet frente + selfie)
  const compareFaces = async () => {
    if (!idFrontFile || !capturedSelfie) {
      alert("Falta la foto del carnet (frente) o la selfie.");
      return;
    }

    setComparing(true);
    setCompareResult(null);

    try {
      const selfieFile = dataURLtoFile(capturedSelfie, "selfie.jpg");

      const fd = new FormData();
      fd.append("id_front", idFrontFile);
      fd.append("selfie", selfieFile);

      const { data } = await axios.post(`${API_BASE}/biometria/verificar`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 60000,
      });

      // Backend devuelve: { match, confidence, distance, threshold }
      const score =
        typeof data.confidence === "number" ? data.confidence : 0;

      setCompareResult({
        match: Boolean(data.match),
        score, // 0..1
        distance: data.distance,
        threshold: data.threshold,
        error: data.error,
      });
    } catch (err) {
      console.error(
        "compareFaces error:",
        err?.response?.status,
        err?.response?.data || err.message
      );
      setCompareResult({
        match: false,
        score: 0,
        error:
          err?.response?.status === 404
            ? "Ruta /biometria/verificar no encontrada (revisa /docs)."
            : "No se pudo verificar la identidad",
      });
    } finally {
      setComparing(false);
    }
  };

  // Enviar registro definitivo (JSON → /vecinos/)
  const finalizarRegistro = async () => {
    try {
      const payload = {
        nombre: form.nombre,
        apellido: form.apellido,
        rut: form.rut,
        correo: form.correo,
        numero_telefono: form.telefono,
        direccion: form.direccion,
        contrasena: form.password,
        miembro: 0,
      };

      const resp = await axios.post(`${API_BASE}/vecinos/`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      });

      if (resp.status >= 200 && resp.status < 300) {
        const usuario = resp.data.usuario;
        if (usuario) {
          localStorage.setItem("user", JSON.stringify(usuario));
        }
        alert("Registro enviado con éxito. ¡Gracias!");
        handleCloseVerify();
        setForm({
          nombre: "",
          apellido: "",
          rut: "",
          correo: "",
          telefono: "",
          direccion: "",
          password: "",
          password2: "",
        });
        setIdFrontFile(null);
        setIdBackFile(null);
        setIdFrontPreview(null);
        setIdBackPreview(null);
        navigate("/");
      } else {
        throw new Error("Respuesta inesperada del servidor");
      }
    } catch (e) {
      console.error(
        "finalizarRegistro error:",
        e?.response?.status,
        e?.response?.data || e.message
      );
      alert("No se pudo completar el registro.");
    }
  };

  // Umbral mínimo de confianza (ajústalo a gusto)
  const minConfidence = 0.45; // prueba 0.40–0.60
  const canConfirm =
    Boolean(compareResult?.match) &&
    (compareResult?.score ?? 0) >= minConfidence;

  return (
    <div className="registro-container">
      <div className="registro-card">
        <h2 className="text-center mb-4">Registro y Verificación de Identidad</h2>

        <form onSubmit={onSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Nombre *</label>
              <input
                name="nombre"
                value={form.nombre}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: Bruno"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Apellido *</label>
              <input
                name="apellido"
                value={form.apellido}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: Becerril"
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label>RUT *</label>
              <input
                name="rut"
                value={form.rut}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: 12.345.678-9"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Correo *</label>
              <input
                name="correo"
                type="email"
                value={form.correo}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: bruno@email.com"
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Teléfono *</label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: +56 9 1234 5678"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Dirección *</label>
              <input
                name="direccion"
                value={form.direccion}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Ej: Av. Principal 1234"
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Contraseña *</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Repetir contraseña *</label>
              <input
                name="password2"
                type="password"
                value={form.password2}
                onChange={onChange}
                className="form-control"
                required
                placeholder="Repite la contraseña"
              />
            </div>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Carnet (frente) *</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={onFileFront}
                required
              />
              {idFrontPreview && (
                <>
                  <small className="text-muted d-block mt-1">Vista previa:</small>
                  <img
                    alt="Frente"
                    src={idFrontPreview}
                    className="img-fluid rounded mt-1"
                  />
                </>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label>Carnet (reverso)</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={onFileBack}
              />
              {idBackPreview && (
                <>
                  <small className="text-muted d-block mt-1">Vista previa:</small>
                  <img
                    alt="Reverso"
                    src={idBackPreview}
                    className="img-fluid rounded mt-1"
                  />
                </>
              )}
            </div>
          </div>

          <div className="text-center mt-4">
            <button type="submit" className="btn btn-primary px-5">
              Enviar registro
            </button>
          </div>
        </form>
      </div>

      {/* ===== Modal de verificación biométrica ===== */}
      <Modal
        show={showVerify}
        onHide={handleCloseVerify}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>Verificación de identidad</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <h6 className="mb-2">Foto del carnet (frente)</h6>
              {idFrontPreview ? (
                <img
                  src={idFrontPreview}
                  alt="Carnet frente"
                  className="img-fluid rounded border"
                />
              ) : (
                <div className="border rounded p-3 text-muted text-center">
                  Sin imagen
                </div>
              )}
            </div>
            <div className="col-md-6">
              <h6 className="mb-2">Selfie en vivo</h6>
              {!capturedSelfie ? (
                <div className="position-relative">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user" }}
                    className="w-100 rounded border"
                  />
                  <Button
                    variant="primary"
                    className="mt-3 w-100"
                    onClick={captureSelfie}
                  >
                    Tomar foto
                  </Button>
                </div>
              ) : (
                <div>
                  <img
                    src={capturedSelfie}
                    alt="Selfie"
                    className="img-fluid rounded border"
                  />
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => setCapturedSelfie(null)}
                    >
                      Repetir
                    </Button>
                    <Button
                      variant="success"
                      onClick={compareFaces}
                      disabled={comparing}
                    >
                      {comparing ? (
                        <>
                          <Spinner
                            size="sm"
                            animation="border"
                            className="me-2"
                          />
                          Comparando...
                        </>
                      ) : (
                        "Comparar rostros"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resultado */}
          {compareResult && (
            <div className={`alert mt-4 ${compareResult.match ? "alert-success" : "alert-danger"}`}>
              {compareResult.error
                ? compareResult.error
                : compareResult.match
                ? `Identidad verificada ✅ (confianza ${(compareResult.score * 100).toFixed(1)}%)`
                : `No coincide ❌ (confianza ${(compareResult.score * 100).toFixed(1)}%)`}

              {/* Datos útiles para depurar */}
              {(compareResult.distance !== undefined || compareResult.threshold !== undefined) && (
                <small className="text-muted d-block mt-2">
                  distance: {compareResult.distance?.toFixed(4)} | threshold: {compareResult.threshold?.toFixed(4)}
                </small>
              )}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseVerify}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={finalizarRegistro}
            disabled={!canConfirm}
            title={
              !compareResult?.match
                ? "Primero verifica tu identidad"
                : (compareResult?.score ?? 0) < minConfidence
                ? `Confianza insuficiente (mínimo ${(minConfidence * 100).toFixed(0)}%)`
                : undefined
            }
          >
            Confirmar y enviar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Registro;
