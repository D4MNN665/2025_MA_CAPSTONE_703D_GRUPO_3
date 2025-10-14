// src/pages/registro.jsx
import React, { useRef, useState, useEffect } from "react";
import "../App.css";
import Webcam from "react-webcam";
import axios from "axios";
import * as faceapi from "face-api.js";
import { Modal, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-cpu";
import jsQR from "jsqr"; // <--- librería para decodificar QR desde ImageData

// =============================
// Config
// =============================
const API_BASE = "http://localhost:8000";
const FACEAPI_MODELS_URL = "/models";

// =============================
// Carga TFJS + face-api.js
// =============================
let faceApiReady = false;
async function ensureFaceApiLoaded() {
  if (faceApiReady) return;
  try {
    await tf.setBackend("webgl");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  await faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODELS_URL);
  faceApiReady = true;
}

// =============================
// Utilidades
// =============================
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
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

function cropFromBoxSafe(imgOrCanvas, box, paddingRatio = 0.35) {
  if (
    !box ||
    typeof box.x !== "number" ||
    typeof box.y !== "number" ||
    typeof box.width !== "number" ||
    typeof box.height !== "number" ||
    isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height) ||
    box.x === null || box.y === null || box.width === null || box.height === null ||
    box.width <= 1 || box.height <= 1
  ) {
    return null;
  }

  const w = imgOrCanvas.width || imgOrCanvas.naturalWidth || 0;
  const h = imgOrCanvas.height || imgOrCanvas.naturalHeight || 0;
  if (w <= 1 || h <= 1) return null;

  const { x, y, width, height } = box;
  const padX = width * paddingRatio;
  const padY = height * paddingRatio;
  const sx = Math.max(0, x - padX);
  const sy = Math.max(0, y - padY);
  const sw = Math.min(w - sx, width + padX * 2);
  const sh = Math.min(h - sy, height + padY * 2);
  if (!sw || !sh || sw <= 1 || sh <= 1) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgOrCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

async function ensureVideoReady(videoEl, timeoutMs = 4000) {
  const t0 = Date.now();
  while (
    (!videoEl ||
      videoEl.readyState !== 4 ||
      !videoEl.videoWidth ||
      !videoEl.videoHeight) &&
    Date.now() - t0 < timeoutMs
  ) {
    await new Promise((r) => setTimeout(r, 50));
  }
  if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    throw new Error("Video no está listo (sin dimensiones).");
  }
}

// Captura estable desde el <video> (evita 0x0 del getScreenshot)
function safeCaptureFromVideo(videoEl, quality = 0.92) {
  if (!videoEl || videoEl.readyState !== 4 || !videoEl.videoWidth || !videoEl.videoHeight) {
    return null;
  }
  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// =============================
// Liveness helpers (sin parpadeo)
// =============================
// yaw: nariz vs centro de ojos (normalizado)
function yawFromEyesNose(leftEye, rightEye, noseTip) {
  const eyeCenter = {
    x: (leftEye[0].x + rightEye[3].x) / 2,
    y: (leftEye[0].y + rightEye[3].y) / 2,
  };
  const interocular = dist(leftEye[0], rightEye[3]) || 1;
  return (noseTip.x - eyeCenter.x) / interocular; // <0 izq, >0 der
}

// boca abierta (MAR)
function mouthMAR(mouth) {
  const A = dist(mouth[13], mouth[19]);
  const B = dist(mouth[14], mouth[18]);
  const C = dist(mouth[15], mouth[17]);
  const D = dist(mouth[12], mouth[16]) || 1;
  return (A + B + C) / (3.0 * D);
}

// asimetría como proxy 3D (anti-foto)
function yawAsymmetry(lm) {
  const jaw = lm.getJawOutline();
  const nose = lm.getNose();
  const noseTip =
    nose?.[3] || nose?.[4] || nose?.[Math.floor((nose?.length || 1) / 2)];
  if (!jaw || jaw.length < 17 || !noseTip) return 0;
  const leftJaw = jaw[3];
  const rightJaw = jaw[13];
  const dL = dist(noseTip, leftJaw);
  const dR = dist(noseTip, rightJaw);
  const base = dist(leftJaw, rightJaw) || 1;
  return (dL - dR) / base; // negativo: izq, positivo: der
}

// Umbrales
const YAW_LEFT_THRESHOLD = -0.1;
const YAW_RIGHT_THRESHOLD = 0.1;
const MAR_OPEN_THRESHOLD = 0.6;
const FRAMES_REQUIRED = 4;
const SMOOTHING_WINDOW = 8;
const ASYM_DELTA_MIN = 0.08;
const WEBCAM_MIRRORED = false; // cambia a true si tu preview está espejada

// =============================
// RUT helpers (normalización y comparación)
// =============================
function normalizeRut(rut) {
  if (!rut) return "";
  // quitar puntos y espacios, y pasar DV a mayúscula
  let s = rut.replace(/[.\s]/g, "").toUpperCase();

  // si viene con prefijos raros (p.ej. "RUT:"), limpia
  s = s.replace(/^RUT:*/i, "").replace(/^CL:/i, "");

  // si no tiene guion, lo agregamos antes del último carácter (DV)
  if (!s.includes("-") && s.length > 1) {
    s = `${s.slice(0, -1)}-${s.slice(-1)}`;
  }
  return s;
}

function rutCore(rut) {
  const s = normalizeRut(rut);
  const [num = "", dv = ""] = s.split("-");
  return `${num}${dv}`;
}

function rutEquals(a, b) {
  if (!a || !b) return false;
  return rutCore(a) === rutCore(b);
}

// =============================
// FUNCIONES QR
// =============================

// Intentos de parse flexibles:
// - JSON directo
// - vCard (simple parser para FN, N, BDAY)
// - heurística regex para RUT y fechas
function parseVCard(vcardText) {
  const lines = vcardText.split(/\r?\n/);
  const out = {};
  for (const l of lines) {
    const [k, ...rest] = l.split(":");
    if (!k) continue;
    const key = k.toUpperCase();
    const val = rest.join(":");
    if (key.startsWith("FN")) out.fullname = val;
    if (key.startsWith("N")) out.n = val;
    if (key.startsWith("BDAY")) out.birthday = val;
  }
  if (out.fullname && !out.n) {
    const parts = out.fullname.split(" ");
    out.nombre = parts[0];
    out.apellido = parts.slice(1).join(" ");
  } else if (out.n) {
    const p = out.n.split(";");
    out.apellido = p[0];
    out.nombre = p[1];
  }
  return out;
}

function parsePossibleRut(text) {
  // busca formatos como 12.345.678-5 o 12345678-5
  const m = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*-[0-9Kk]|[0-9]{7,8}-[0-9Kk])/);
  if (m) return m[0];
  return null;
}

function parsePossibleDate(text) {
  // formatos ISO yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[0];
  const dmy = text.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
  if (dmy) {
    const s = dmy[0];
    // convertir a ISO yyyy-mm-dd
    const parts = s.split(/[\/-]/);
    const dd = parts[0], mm = parts[1], yyyy = parts[2];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function calcAgeFromISO(isoDate) {
  try {
    const b = new Date(isoDate);
    if (isNaN(b.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}

// Calcula la edad a partir de la fecha de nacimiento (yyyy-mm-dd)
function calcAgeFromBirthdate(birthdate) {
  if (!birthdate) return "";
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

// Decodifica QR desde un File (imagen)
// devuelve {raw, parsed: {rut,nombre,apellido,birthdate,age,...}} o null si no hay QR
async function decodeQRFromFile(file) {
  try {
    const img = await fileToImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
    if (!code) return null;
    const raw = code.data;
    const parsed = {};

    // 1️⃣ Caso especial: QR de Registro Civil (URL con parámetros RUN y serial)
    if (raw.includes("registrocivil.cl/docstatus")) {
      try {
        const url = new URL(raw);
        const run = url.searchParams.get("RUN");
        const serial = url.searchParams.get("serial");
        const type = url.searchParams.get("type");
        if (run) parsed.rut = run;
        if (serial) parsed.serial = serial;
        if (type) parsed.tipo_doc = type;
      } catch (e) {
        console.warn("No se pudo parsear la URL del Registro Civil:", e);
      }
    }

    // 2️⃣ Fallbacks (por si en el futuro cambian el formato)
    if (!parsed.rut) {
      const m = raw.match(/RUN=([0-9\-Kk]+)/);
      if (m) parsed.rut = m[1];
    }
    if (!parsed.serial) {
      const m = raw.match(/serial=(\w+)/);
      if (m) parsed.serial = m[1];
    }
    if (!parsed.tipo_doc) {
      const m = raw.match(/type=([A-Za-z]+)/);
      if (m) parsed.tipo_doc = m[1];
    }

    // 3️⃣ Intenta parsear RUT y fecha si es texto libre
    if (!parsed.rut) {
      const r = parsePossibleRut(raw);
      if (r) parsed.rut = r;
    }
    if (!parsed.birthdate) {
      const d = parsePossibleDate(raw);
      if (d) parsed.birthdate = d;
    }
    if (parsed.birthdate && !parsed.age) {
      const a = calcAgeFromISO(parsed.birthdate);
      if (a !== null) parsed.age = a;
    }

    return { raw, parsed };
  } catch (e) {
    console.error("decodeQRFromFile error:", e);
    return null;
  }
}

// =============================
// Componente
// =============================
const Registro = () => {
  // Formulario
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    rut: "",
    correo: "",
    telefono: "",
    direccion: "",
    password: "",
    password2: "",
    birthdate: "", // nuevo campo
    age: "",       // nuevo campo
  });

  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);

  // QR result (no se muestra al usuario, pero lo usamos para validar)
  const [qrRaw, setQrRaw] = useState(null);
  const [qrParsed, setQrParsed] = useState(null);
  const [qrDetecting, setQrDetecting] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Modal / Webcam
  const [showVerify, setShowVerify] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  // Liveness (multi-reto)
  const [challenges, setChallenges] = useState([]); // ["left","right","mouth"]
  const [step, setStep] = useState(0);
  const [challengeOK, setChallengeOK] = useState(false);
  const rafIdRef = useRef(null);

  // Timer liveness
  const [timeLeft, setTimeLeft] = useState(30);
  const [expired, setExpired]   = useState(false);

  // Debug (no visibles en UI)
  const [dbgYaw, setDbgYaw] = useState(0);
  const [dbgMar, setDbgMar] = useState(0);
  const [dbgConsec, setDbgConsec] = useState(0);

  // Buffers/contadores
  const yawBufferRef = useRef([]);
  const consecRef = useRef(0);
  const asymStartRef = useRef(null);
  const asymPeakRef = useRef(null);

  // Forzar reinicio de Webcam
  const [webcamKey, setWebcamKey] = useState(0);

  // Token de sesión para invalidar frames/promesas de sesiones anteriores
  const sessionRef = useRef(0);

  // nuevo: estado para modal de advertencia de webcam
  const [showWebcamModal, setShowWebcamModal] = useState(true);

  useEffect(() => {
    ensureFaceApiLoaded().catch(console.error);
  }, []);

  const stopCamera = () => {
    try {
      const video = webcamRef.current?.video;
      const stream = video?.srcObject;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
  };

  const hardStopLoop = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const handleCloseVerify = () => {
    hardStopLoop();
    stopCamera();
    sessionRef.current += 1; // invalida cualquier frame pendiente
    setShowVerify(false);
    setMediaReady(false);
    setCapturedSelfie(null);
    setCompareResult(null);
    setChallenges([]);
    setStep(0);
    setChallengeOK(false);
    setTimeLeft(30);
    setExpired(false);
    setWebcamKey((k) => k + 1); // reinicia webcam
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      // Si cambia birthdate, recalcula age
      if (name === "birthdate") {
        const age = calcAgeFromBirthdate(value);
        return { ...f, birthdate: value, age };
      }
      return { ...f, [name]: value };
    });
  };

  // =============================
  // Manejo archivos carnet (frente / reverso)
  // =============================
  const onFileFront = async (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      setIdFrontFile(null);
      setIdFrontPreview(null);
      return;
    }
    try {
      await ensureFaceApiLoaded();
      const img = await fileToImage(f);
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.45,
      });
      const detection = await faceapi
        .detectSingleFace(img, options)
        .withFaceLandmarks();

      const box = detection && detection.detection && detection.detection.box;
      if (
        !box ||
        typeof box.x !== "number" ||
        typeof box.y !== "number" ||
        typeof box.width !== "number" ||
        typeof box.height !== "number" ||
        isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height) ||
        box.width <= 1 || box.height <= 1
      ) {
        setIdFrontFile(f);
        setIdFrontPreview(URL.createObjectURL(f));
        return;
      }

      const canvas = cropFromBoxSafe(img, box, 0.35);
      if (!canvas) {
        setIdFrontFile(f);
        setIdFrontPreview(URL.createObjectURL(f));
        return;
      }
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      const croppedFile = new File([blob], "id_front_cropped.jpg", {
        type: "image/jpeg",
      });
      setIdFrontFile(croppedFile);
      setIdFrontPreview(URL.createObjectURL(croppedFile));
    } catch {
      setIdFrontFile(f);
      setIdFrontPreview(URL.createObjectURL(f));
    }
  };

  // nuevo: al cargar el reverso intentamos decodificar QR
  const onFileBack = async (e) => {
    const f = e.target.files?.[0];
    setIdBackFile(f || null);
    setIdBackPreview(f ? URL.createObjectURL(f) : null);

    if (!f) {
      setQrRaw(null);
      setQrParsed(null);
      setQrError(null);
      return;
    }

    setQrDetecting(true);
    setQrError(null);
    setQrRaw(null);
    setQrParsed(null);
    try {
      const res = await decodeQRFromFile(f);
      if (!res) {
        setQrError("No se detectó QR en la imagen.");
      } else {
        setQrRaw(res.raw);
        setQrParsed(res.parsed);
        // si encontramos datos que podemos mapear al formulario, autocompleta
        const p = res.parsed || {};
        setForm((prev) => {
          const next = { ...prev };
          if (p.rut && !prev.rut) next.rut = p.rut;
          // nombres: p.nombre / p.apellido / p.fullname / p.nombreCompleto
          if (p.nombre && !prev.nombre) next.nombre = p.nombre;
          if (p.apellido && !prev.apellido) next.apellido = p.apellido;
          if (!prev.nombre && p.fullname) {
            const parts = p.fullname.split(" ");
            next.nombre = parts[0] || "";
            next.apellido = parts.slice(1).join(" ") || "";
          }
          if (p.birthdate && !prev.birthdate) {
            next.birthdate = p.birthdate;
            next.age = calcAgeFromBirthdate(p.birthdate);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Error detectando QR:", err);
      setQrError("Error detectando QR (ver consola).");
    } finally {
      setQrDetecting(false);
    }
  };

  // =============================
  // Resto: liveness / capture / compare (igual que tu código)
  // =============================

  // Secuencia sin parpadeo
  function pickSequence() {
    const pool = ["left", "right", "mouth"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool; // 3 retos
  }

  // Enviar → abrir modal biometría
  const onSubmit = (e) => {
    e.preventDefault();
    if (!idFrontFile) return alert("Sube el carnet (frente) para verificar.");
    if (form.password !== form.password2)
      return alert("Las contraseñas no coinciden.");
    if (!form.birthdate || !form.age) {
      return alert("Debes ingresar tu fecha de nacimiento.");
    }
    if (parseInt(form.age, 10) < 14) {
      return alert("Debes tener al menos 14 años para crear una cuenta.");
    }

    // ✅ Validación solicitada: si hay RUT en el QR, debe coincidir con el ingresado
    if (qrParsed?.rut) {
      if (!rutEquals(form.rut, qrParsed.rut)) {
        return alert("El RUT ingresado no coincide con el RUT del QR del carnet. Verifica ambos.");
      }
    }

    setCapturedSelfie(null);
    setCompareResult(null);
    setChallengeOK(false);
    setChallenges(pickSequence());
    setStep(0);

    setTimeLeft(30);
    setExpired(false);

    sessionRef.current += 1; // nueva sesión
    setShowVerify(true);
  };

  // Cronómetro
  useEffect(() => {
    if (!showVerify || challengeOK || expired) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setExpired(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showVerify, challengeOK, expired]);

  // Reintentar liveness
  const retryLiveness = () => {
    hardStopLoop();
    setCapturedSelfie(null);
    setCompareResult(null);
    setChallengeOK(false);
    setChallenges(pickSequence());
    setStep(0);
    setTimeLeft(30);
    setExpired(false);
    setMediaReady(false);
    yawBufferRef.current = [];
    consecRef.current = 0;
    asymStartRef.current = null;
    asymPeakRef.current = null;
    sessionRef.current += 1; // invalida promesas/frames viejos
    setWebcamKey((k) => k + 1);
  };

  // Bucle de liveness
  useEffect(() => {
    if (!showVerify || !mediaReady || !webcamRef.current?.video) return;

    let running = true;
    const thisSession = sessionRef.current;

    (async () => {
      try {
        await ensureFaceApiLoaded();
        const v = webcamRef.current.video;
        await ensureVideoReady(v);

        const options = new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.3,
        });

        yawBufferRef.current = [];
        consecRef.current = 0;
        asymStartRef.current = null;
        asymPeakRef.current = null;
        setDbgConsec(0);

        const loop = async () => {
          if (!running) return;

          // si la sesión cambió, aborta silenciosamente
          if (thisSession !== sessionRef.current) {
            running = false;
            hardStopLoop();
            return;
          }

          if (expired || !showVerify || !webcamRef.current?.video) {
            running = false;
            hardStopLoop();
            return;
          }

          if (!v || v.readyState !== 4 || !v.videoWidth || !v.videoHeight) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          try {
            let det = null;
            try {
              det = await faceapi
                .detectSingleFace(v, options)
                .withFaceLandmarks();
            } catch (err) {
              rafIdRef.current = requestAnimationFrame(loop);
              return;
            }

            const box = det && det.detection && det.detection.detection?.box || det?.detection?.box;
            const landmarksOk = det?.landmarks && det.landmarks;

            if (!landmarksOk || !box ||
                typeof box.x !== "number" || typeof box.y !== "number" ||
                typeof box.width !== "number" || typeof box.height !== "number" ||
                isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height) ||
                box.width <= 1 || box.height <= 1) {
              setDbgYaw(0);
              setDbgMar(0);
              setDbgConsec(0);
              rafIdRef.current = requestAnimationFrame(loop);
              return;
            }

            if (!challengeOK && challenges.length > 0) {
              const lm = det.landmarks;
              const leftEye = lm.getLeftEye();
              const rightEye = lm.getRightEye();
              const mouth = lm.getMouth();
              const nose = lm.getNose();
              const noseTip =
                nose?.[3] || nose?.[4] || nose?.[Math.floor((nose?.length || 1) / 2)];

              if (
                leftEye?.length === 6 &&
                rightEye?.length === 6 &&
                mouth?.length >= 20 &&
                noseTip
              ) {
                const yawRaw = yawFromEyesNose(leftEye, rightEye, noseTip);
                const yawAdj = WEBCAM_MIRRORED ? -yawRaw : yawRaw;

                const buf = yawBufferRef.current;
                buf.push(yawAdj);
                if (buf.length > 8) buf.shift();
                const yawSmooth = buf.reduce((a, b) => a + b, 0) / buf.length;

                const mar = mouthMAR(mouth);
                setDbgYaw(yawSmooth);
                setDbgMar(mar);

                const asymNow = yawAsymmetry(lm);

                let hit = false;
                const cur = challenges[step];

                if (cur === "left") {
                  if (asymStartRef.current === null) asymStartRef.current = asymNow;
                  if (asymPeakRef.current === null || asymNow < asymPeakRef.current) {
                    asymPeakRef.current = asymNow;
                  }
                  const delta = Math.abs(asymPeakRef.current - asymStartRef.current);
                  hit = yawSmooth < YAW_LEFT_THRESHOLD && delta > ASYM_DELTA_MIN;
                } else if (cur === "right") {
                  if (asymStartRef.current === null) asymStartRef.current = asymNow;
                  if (asymPeakRef.current === null || asymNow > asymPeakRef.current) {
                    asymPeakRef.current = asymNow;
                  }
                  const delta = Math.abs(asymPeakRef.current - asymStartRef.current);
                  hit = yawSmooth > YAW_RIGHT_THRESHOLD && delta > ASYM_DELTA_MIN;
                } else if (cur === "mouth") {
                  hit = mar > MAR_OPEN_THRESHOLD;
                }

                if (hit) {
                  consecRef.current += 1;
                  setDbgConsec(consecRef.current);
                  if (consecRef.current >= FRAMES_REQUIRED) {
                    const next = step + 1;
                    if (next < challenges.length) {
                      setStep(next);
                      yawBufferRef.current = [];
                      consecRef.current = 0;
                      setDbgConsec(0);
                      asymStartRef.current = null;
                      asymPeakRef.current = null;
                    } else {
                      setChallengeOK(true);
                      running = false;
                      hardStopLoop();
                      return;
                    }
                  }
                } else if (consecRef.current !== 0) {
                  consecRef.current = 0;
                  setDbgConsec(0);
                }
              }
            }
          } catch {
            // ignora frame con error
          }

          rafIdRef.current = requestAnimationFrame(loop);
        };

        loop();
      } catch (e) {
        console.error("liveness setup error:", e);
      }
    })();

    return () => {
      hardStopLoop();
    };
  }, [showVerify, mediaReady, challenges, step, challengeOK, expired]);

  // Capturar selfie (solo luego del liveness)
  const captureSelfie = async () => {
    if (expired || !showVerify) {
      alert("Se acabó el tiempo o el reto ya no está activo. Pulsa Reintentar para volver a intentarlo.");
      return;
    }
    if (!challengeOK) {
      alert("Primero supera los retos.");
      return;
    }

    hardStopLoop();

    const video = webcamRef.current?.video;
    try {
      await ensureVideoReady(video, 5000);
    } catch {
      alert("La cámara aún no está lista. Intenta de nuevo en 1–2 segundos.");
      return;
    }

    const imageSrc = safeCaptureFromVideo(video, 0.92);
    if (!imageSrc) {
      alert("No se pudo capturar la foto. Intenta de nuevo.");
      return;
    }

    try {
      await ensureFaceApiLoaded();

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
        img.src = imageSrc;
      });

      if (!img.naturalWidth || !img.naturalHeight) {
        alert("La imagen capturada está vacía. Repite la toma.");
        return;
      }

      const inCanvas = document.createElement("canvas");
      inCanvas.width = img.naturalWidth;
      inCanvas.height = img.naturalHeight;
      inCanvas.getContext("2d").drawImage(img, 0, 0);

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 384,
        scoreThreshold: 0.35,
      });

      let detection = null;
      try {
        detection = await faceapi
          .detectSingleFace(inCanvas, options)
          .withFaceLandmarks();
      } catch (err) {
        console.warn("detectSingleFace lanzó excepción. Guardo sin recortar:", err);
        setCapturedSelfie(imageSrc);
        return;
      }

      const box = detection && detection.detection && detection.detection.box;
      if (
        !box ||
        typeof box.x !== "number" ||
        typeof box.y !== "number" ||
        typeof box.width !== "number" ||
        typeof box.height !== "number" ||
        isNaN(box.x) || isNaN(box.y) || isNaN(box.width) || isNaN(box.height) ||
        box.width <= 1 || box.height <= 1
      ) {
        console.warn("Box inválido. Guardo sin recortar.");
        setCapturedSelfie(imageSrc);
        return;
      }

      const croppedCanvas = cropFromBoxSafe(inCanvas, box, 0.25);
      if (!croppedCanvas) {
        console.warn("Recorte 0x0. Guardo sin recortar.");
        setCapturedSelfie(imageSrc);
        return;
      }

      const croppedDataUrl = croppedCanvas.toDataURL("image/jpeg", 0.92);
      setCapturedSelfie(croppedDataUrl);
    } catch (e) {
      console.error(e);
      setCapturedSelfie(imageSrc); // fallback
    }
  };

  // Comparar rostro carnet vs selfie
  const compareFaces = async () => {
    if (!idFrontFile || !capturedSelfie)
      return alert("Falta carnet o selfie.");
    if (expired) return alert("Se acabó el tiempo. Pulsa Reintentar.");
    if (!challengeOK) return alert("Primero supera los retos.");

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

      const score = typeof data.confidence === "number" ? data.confidence : 0;
      setCompareResult({
        match: Boolean(data.match),
        score,
        distance: data.distance,
        threshold: data.threshold,
        error: data.error,
      });
    } catch (err) {
      setCompareResult({
        match: false,
        score: 0,
        error: "No se pudo verificar la identidad",
      });
    } finally {
      setComparing(false);
    }
  };

  // Envío de registro
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
        if (usuario) localStorage.setItem("user", JSON.stringify(usuario));
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
          birthdate: "",
          age: "",
        });
        setIdFrontFile(null);
        setIdBackFile(null);
        setIdFrontPreview(null);
        setIdBackPreview(null);
        navigate("/");
      } else {
        throw new Error("Respuesta inesperada del servidor");
      }
    } catch {
      alert("No se pudo completar el registro.");
    }
  };

  const minConfidence = 0.45;
  const canConfirm =
    Boolean(compareResult?.match) &&
    (compareResult?.score ?? 0) >= minConfidence;

  // =============================
  // JSX
  // =============================
  return (
    <div className="registro-container">
      {/* Modal de advertencia de webcam */}
      <Modal
        show={showWebcamModal}
        onHide={() => setShowWebcamModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header>
          <Modal.Title>Atención</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Para realizar el registro es necesario contar con una cámara web.<br />
          Si tu dispositivo no tiene webcam, no podrás completar el registro de usuario.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowWebcamModal(false)}>
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

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
                placeholder="Ej: Juan"
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
                placeholder="Ej: Pérez"
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
                placeholder="Ej: correo@ejemplo.com"
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
                placeholder="Ej: +56912345678"
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
                placeholder="Ej: Calle 123, Ciudad"
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
                placeholder="Contraseña"
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
              <label>Fecha de nacimiento *</label>
              <input
                name="birthdate"
                type="date"
                value={form.birthdate}
                onChange={onChange}
                className="form-control"
                required
                placeholder="aaaa-mm-dd"
              />
            </div>
            <div className="col-md-6 mb-3">
              <label>Edad</label>
              <input
                name="age"
                type="number"
                value={form.age}
                className="form-control"
                readOnly
                disabled
                placeholder="Edad calculada"
              />
            </div>
          </div>

          {/* ARCHIVOS: frente / reverso */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Carnet (frente) *</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={onFileFront}
                required
                placeholder="Selecciona imagen del frente"
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
              <label>Carnet (reverso) - QR</label>
              <input
                type="file"
                className="form-control"
                accept="image/*"
                onChange={onFileBack}
                placeholder="Selecciona imagen del reverso"
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
              {/* No mostramos datos del QR al usuario */}
              {qrDetecting && <small className="text-muted d-block mt-2">Procesando reverso…</small>}
              {qrError && <div className="text-danger small mt-2">No se pudo leer el QR.</div>}
            </div>
          </div>

          <div className="text-center mt-4">
            <button type="submit" className="btn btn-primary px-5">
              Enviar registro
            </button>
          </div>
        </form>
      </div>

      {/* Modal de verificación biométrica (igual que antes) */}
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

              {/* Estado del reto + contador */}
              {!challengeOK && challenges.length > 0 && !expired && (
                <div className="alert alert-warning mb-2 d-flex justify-content-between align-items-center">
                  <span>
                    {challenges[step] === "left"  && "Reto: gira tu rostro a la IZQUIERDA."}
                    {challenges[step] === "right" && "Reto: gira tu rostro a la DERECHA."}
                    {challenges[step] === "mouth" && "Reto: abre la boca."}
                  </span>
                  <span className="badge bg-secondary">⏱️ {timeLeft}s</span>
                </div>
              )}

              {expired && !challengeOK && (
                <div className="alert alert-danger mb-2 d-flex justify-content-between align-items-center">
                  <span>Se acabó el tiempo para completar el reto.</span>
                  <Button size="sm" variant="outline-light" onClick={retryLiveness}>
                    Reintentar
                  </Button>
                </div>
              )}

              {challengeOK && (
                <div className="alert alert-success mb-2">Liveness superado ✅</div>
              )}

              {!capturedSelfie ? (
                <div className="position-relative">
                  <Webcam
                    key={webcamKey}
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ width: 640, height: 480, facingMode: "user" }}
                    className="w-100 rounded border"
                    onUserMedia={() => setMediaReady(true)}
                    onUserMediaError={(err) => {
                      console.error("Cam error:", err);
                      alert("No pude acceder a la cámara. Revisa permisos del navegador.");
                    }}
                  />
                  <Button
                    variant="primary"
                    className="mt-3 w-100"
                    onClick={captureSelfie}
                    disabled={!challengeOK || !mediaReady || expired}
                    title={
                      expired
                        ? "Se acabó el tiempo. Pulsa Reintentar."
                        : !challengeOK
                          ? "Primero supera los retos de movimiento"
                          : !mediaReady
                            ? "Cámara inicializando…"
                            : undefined
                    }
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
                      disabled={comparing || !challengeOK || expired}
                      title={
                        expired
                          ? "Se acabó el tiempo. Pulsa Reintentar."
                          : !challengeOK
                            ? "Primero supera el liveness"
                            : undefined
                      }
                    >
                      {comparing ? (
                        <>
                          <Spinner size="sm" animation="border" className="me-2" />
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

          {compareResult && (
            <div
              className={`alert mt-4 ${
                compareResult.match ? "alert-success" : "alert-danger"
              }`}
            >
              {compareResult.error
                ? compareResult.error
                : compareResult.match
                ? `Identidad verificada ✅ (confianza ${(compareResult.score * 100).toFixed(1)}%)`
                : `No coincide ❌ (confianza ${(compareResult.score * 100).toFixed(1)}%)`}
              {(compareResult.distance !== undefined ||
                compareResult.threshold !== undefined) && (
                <small className="text-muted d-block mt-2">
                  distance: {compareResult.distance?.toFixed(4)} | threshold:{" "}
                  {compareResult.threshold?.toFixed(4)}
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
                ? "Confianza insuficiente"
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
