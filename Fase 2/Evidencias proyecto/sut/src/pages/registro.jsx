// src/pages/registro.jsx
import React, { useRef, useState, useEffect } from "react";
import "../App.css";
import Webcam from "react-webcam";
import axios from "axios";
import * as faceapi from "face-api.js";
import { Modal, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import * as tf from "@tensorflow/tfjs";
import jsQR from "jsqr";

// =============================
// Config
// =============================
const API_BASE = "http://127.0.0.1:8000";
const FACEAPI_MODELS_URL = "/models";

// Evitar detecciones simultáneas (loop vs captura)
window.__suspendFaceApi = false;

// =============================
// Carga TFJS + face-api.js (dinámica - sin imports duplicados)
// =============================
let faceApiReady = false;
async function ensureFaceApiLoaded() {
  if (window.__tf_inited && window.__faceapi_inited) return;
  if (faceApiReady) return;

  try {
    if (!window.__tf_inited) {
      try {
        await import("@tensorflow/tfjs-backend-webgl");
        await tf.setBackend("webgl");
      } catch {
        await import("@tensorflow/tfjs-backend-cpu");
        await tf.setBackend("cpu");
      }
      await tf.ready();
      window.__tf_inited = true;
    }

    if (!window.__faceapi_inited) {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACEAPI_MODELS_URL),
      ]);
      window.__faceapi_inited = true;
    }

    faceApiReady = true;
  } catch (e) {
    console.error("TFJS/face-api init error:", e);
  }
}

// =============================
// Utilidades varias
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
    isNaN(box.x) ||
    isNaN(box.y) ||
    isNaN(box.width) ||
    isNaN(box.height) ||
    box.width <= 1 ||
    box.height <= 1
  ) return null;

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
      videoEl.readyState < 2 ||
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
function safeCaptureFromVideo(videoEl, quality = 0.92) {
  if (
    !videoEl ||
    videoEl.readyState < 2 ||
    !videoEl.videoWidth ||
    !videoEl.videoHeight
  ) return null;
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(videoEl, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// --- Helpers de validación de caja de face-api ---
function isRenderable(el) {
  if (!el) return false;
  const w = el.videoWidth ?? el.naturalWidth ?? el.width ?? 0;
  const h = el.videoHeight ?? el.naturalHeight ?? el.height ?? 0;
  return Number.isFinite(w) && Number.isFinite(h) && w > 1 && h > 1;
}
function isValidBox(box) {
  return (
    !!box &&
    typeof box.x === "number" &&
    typeof box.y === "number" &&
    typeof box.width === "number" &&
    typeof box.height === "number" &&
    !Number.isNaN(box.x) &&
    !Number.isNaN(box.y) &&
    !Number.isNaN(box.width) &&
    !Number.isNaN(box.height) &&
    box.width > 1 &&
    box.height > 1
  );
}
function getValidBox(det) {
  const raw =
    det?.box ||
    det?.detection?.box ||
    det?.detection?.detection?.box ||
    det?.alignedRect?.box ||
    null;

  const box = raw
    ? {
        x: Number(raw.x),
        y: Number(raw.y),
        width: Number(raw.width),
        height: Number(raw.height),
      }
    : null;

  return isValidBox(box) ? box : null;
}

// =============================
// Liveness helpers
// =============================
function yawFromEyesNose(leftEye, rightEye, noseTip) {
  const eyeCenter = {
    x: (leftEye[0].x + rightEye[3].x) / 2,
    y: (leftEye[0].y + rightEye[3].y) / 2,
  };
  const interocular = dist(leftEye[0], rightEye[3]) || 1;
  return (noseTip.x - eyeCenter.x) / interocular;
}
function mouthMAR(mouth) {
  const A = dist(mouth[13], mouth[19]),
    B = dist(mouth[14], mouth[18]),
    C = dist(mouth[15], mouth[17]);
  const D = dist(mouth[12], mouth[16]) || 1;
  return (A + B + C) / (3.0 * D);
}
function yawAsymmetry(lm) {
  const jaw = lm.getJawOutline(),
    nose = lm.getNose();
  const noseTip = nose?.[3] || nose?.[4] || nose?.[Math.floor((nose?.length || 1) / 2)];
  if (!jaw || jaw.length < 17 || !noseTip) return 0;
  const leftJaw = jaw[3], rightJaw = jaw[13];
  const dL = dist(noseTip, leftJaw), dR = dist(noseTip, rightJaw);
  const base = dist(leftJaw, rightJaw) || 1;
  return (dL - dR) / base;
}
const YAW_LEFT_THRESHOLD = -0.1;
const YAW_RIGHT_THRESHOLD = 0.1;
const MAR_OPEN_THRESHOLD = 0.35;
const WEBCAM_MIRRORED = false;

// =============================
// RUT helpers
// =============================
function normalizeRut(rut) {
  if (!rut) return "";
  let s = rut.replace(/[.\s]/g, "").toUpperCase();
  s = s.replace(/^RUT:*/i, "").replace(/^CL:/i, "");
  if (!s.includes("-") && s.length > 1) s = `${s.slice(0, -1)}-${s.slice(-1)}`;
  return s;
}
function rutCore(rut) {
  const s = normalizeRut(rut);
  const [num = "", dv = ""] = s.split("-");
  return `${num}${dv}`;
}
function rutEquals(a, b) {
  return !!a && !!b && rutCore(a) === rutCore(b);
}

// =============================
// QR helpers
// =============================
function parsePossibleRut(text) {
  const m = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*-[0-9Kk]|[0-9]{7,8}-[0-9Kk])/);
  return m ? m[0] : null;
}
function parsePossibleDate(text) {
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[0];
  const dmy = text.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
  if (dmy) {
    const [dd, mm, yyyy] = dmy[0].split(/[\/-]/);
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}
function calcAgeFromISO(isoDate) {
  try {
    const b = new Date(isoDate);
    if (isNaN(b.getTime())) return null;
    const t = new Date();
    let age = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
    return age;
  } catch {
    return null;
  }
}
function calcAgeFromBirthdate(birthdate) {
  if (!birthdate) return "";
  const b = new Date(birthdate);
  if (isNaN(b.getTime())) return "";
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
}
async function decodeQRFromFile(file) {
  try {
    const img = await fileToImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, {
      inversionAttempts: "attemptBoth",
    });
    if (!code) return null;
    const raw = code.data;
    const parsed = {};

    if (raw.includes("registrocivil.cl/docstatus")) {
      try {
        const url = new URL(raw);
        const run = url.searchParams.get("RUN");
        const serial = url.searchParams.get("serial");
        const type = url.searchParams.get("type");
        if (run) parsed.rut = run;
        if (serial) parsed.serial = serial;
        if (type) parsed.tipo_doc = type;
      } catch {}
    }
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
  const [form, setForm] = useState({
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

  // Estados UV / geocoding
  const [uvInfo, setUvInfo] = useState(null);
  const [uvEdge, setUvEdge] = useState(false);
  const [uvMsg, setUvMsg] = useState("");
  const [geo, setGeo] = useState({ lat: null, lon: null });
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const geoTimerRef = useRef(null);
  const lastQueryRef = useRef("");
  const [touched, setTouched] = useState({ direccion: false });
  const abortRef = useRef(null);

  // Archivos carnet
  const [idFrontFile, setIdFrontFile] = useState(null);
  const [idBackFile, setIdBackFile] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);

  // QR
  const [qrRaw, setQrRaw] = useState(null);
  const [qrParsed, setQrParsed] = useState(null);
  const [qrDetecting, setQrDetecting] = useState(false);
  const [qrError, setQrError] = useState(null);

  // Webcam / biometría
  const [showVerify, setShowVerify] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [capturedSelfie, setCapturedSelfie] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const webcamRef = useRef(null);
  const navigate = useNavigate();

  const [challenges, setChallenges] = useState([]);
  const [step, setStep] = useState(0);
  const [challengeOK, setChallengeOK] = useState(false);
  const rafIdRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(30);
  const [expired, setExpired] = useState(false);

  const [webcamKey, setWebcamKey] = useState(0);
  const sessionRef = useRef(0);
  const [showWebcamModal, setShowWebcamModal] = useState(true);

  useEffect(() => {
    ensureFaceApiLoaded().catch(console.error);
  }, []);

  // =============================
  // Asignación UV automática
  // =============================
  const buildEnrichedAddress = (dir) => {
    const base = (dir || "").trim();
    return base ? `${base}, Maipú, Chile` : "";
  };

  useEffect(() => {
    const dir = (form.direccion || "").trim();

    const direccionReady = dir.length >= 5;
    if (!touched.direccion || !direccionReady) {
      setUvInfo(null);
      setUvEdge(false);
      setUvMsg("");
      return;
    }

    const enriched = `${dir}, Maipú, Chile`;

    if (enriched === lastQueryRef.current) return;
    lastQueryRef.current = enriched;

    if (geoTimerRef.current) clearTimeout(geoTimerRef.current);

    geoTimerRef.current = setTimeout(async () => {
      try { abortRef.current?.abort(); } catch {}
      abortRef.current = new AbortController();

      setGeoLoading(true);
      setGeoError(null);
      setUvMsg("");

      try {
        const { data } = await axios.get(`${API_BASE}/uv/assign`, {
          params: { direccion: enriched, comuna: "Maipú", pais: "Chile", timeout_ms: 20000 },
          timeout: 30000,
          signal: abortRef.current.signal,
        });

        const lat = Number(data?.geocoding?.lat);
        const lon = Number(data?.geocoding?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setGeo({ lat, lon });
        } else {
          setGeo({ lat: null, lon: null });
        }

        const uv = data?.uv;
        const edge = Boolean(data?.edge);
        setUvInfo(uv || null);
        setUvEdge(edge);

        setUvMsg(
          uv?.id_uv
            ? edge
              ? `Estás cerca del límite: asignado a ${uv.nombre} (UV ${uv.id_uv})`
              : `Quedaste asignado a: ${uv.nombre} (UV ${uv.id_uv}) ✅`
            : ""
        );
      } catch (err) {
        if (axios.isCancel?.(err) || err?.code === "ERR_CANCELED") return;
        setGeoError("No se pudo asignar una UV a esta dirección.");
        setUvInfo(null);
        setUvEdge(false);
        setUvMsg("");
      } finally {
        setGeoLoading(false);
      }
    }, 700);

    return () => clearTimeout(geoTimerRef.current);
  }, [form.direccion, touched.direccion]);

  // =============================
  // Handlers de formulario
  // =============================
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => {
      if (name === "birthdate") {
        const age = calcAgeFromBirthdate(value);
        return { ...f, birthdate: value, age };
      }
      return { ...f, [name]: value };
    });
  };
  const onBlur = (e) => {
    const { name } = e.target;
    setTouched((t) => ({ ...t, [name]: true }));
  };

  // =============================
  // Manejo archivos carnet
  // =============================
  const onFileFront = async (e) => {
    const f = e.target.files?.[0];
    if (!f) { setIdFrontFile(null); setIdFrontPreview(null); return; }
    try {
      await ensureFaceApiLoaded();
      const img = await fileToImage(f);
      // Defensive: if image has no usable dimensions, fallback to raw preview
      if (!isRenderable(img)) {
        console.warn("onFileFront: loaded image not renderable, using raw preview", img);
        setIdFrontFile(f);
        setIdFrontPreview(URL.createObjectURL(f));
        return;
      }
      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
      let detection = null;
      try {
        detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks();
      } catch (err) {
        console.error("faceapi detection error (id front):", err);
        setIdFrontFile(f);
        setIdFrontPreview(URL.createObjectURL(f));
        return;
      }
      const box = getValidBox(detection);
      if (!box) { setIdFrontFile(f); setIdFrontPreview(URL.createObjectURL(f)); return; }
      const canvas = cropFromBoxSafe(img, box, 0.35);
      if (!canvas) { setIdFrontFile(f); setIdFrontPreview(URL.createObjectURL(f)); return; }
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      const croppedFile = new File([blob], "id_front_cropped.jpg", { type: "image/jpeg" });
      setIdFrontFile(croppedFile);
      setIdFrontPreview(URL.createObjectURL(croppedFile));
    } catch {
      setIdFrontFile(f);
      setIdFrontPreview(URL.createObjectURL(f));
    }
  };

  const onFileBack = async (e) => {
    const f = e.target.files?.[0];
    setIdBackFile(f || null);
    setIdBackPreview(f ? URL.createObjectURL(f) : null);
    if (!f) { setQrRaw(null); setQrParsed(null); setQrError(null); return; }

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
        const p = res.parsed || {};
        setForm((prev) => {
          const next = { ...prev };
          if (p.rut && !prev.rut) next.rut = p.rut;
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
  // Biometría
  // =============================
  function pickSequence() {
    const pool = ["left", "right", "mouth"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  const onSubmit = (e) => {
    e.preventDefault();
    if (!idFrontFile) return alert("Sube el carnet (frente) para verificar.");
    if (form.password !== form.password2) return alert("Las contraseñas no coinciden.");
    if (!form.birthdate || !form.age) return alert("Debes ingresar tu fecha de nacimiento.");
    if (parseInt(form.age, 10) < 14) return alert("Debes tener al menos 14 años para crear una cuenta.");
    if (qrParsed?.rut && !rutEquals(form.rut, qrParsed.rut)) {
      return alert("El RUT ingresado no coincide con el RUT del QR del carnet. Verifica ambos.");
    }
    setCapturedSelfie(null);
    setCompareResult(null);
    setChallengeOK(false);
    setChallenges(pickSequence());
    setStep(0);
    setTimeLeft(30);
    setExpired(false);
    sessionRef.current += 1;
    setShowVerify(true);
  };

  useEffect(() => {
    if (!showVerify || challengeOK || expired) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(id); setExpired(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [showVerify, challengeOK, expired]);

  const hardStopLoop = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };
  const stopCamera = () => {
    try {
      const video = webcamRef.current?.video;
      const stream = video?.srcObject;
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
  };
  const handleCloseVerify = () => {
    hardStopLoop();
    stopCamera();
    sessionRef.current += 1;
    setShowVerify(false);
    setMediaReady(false);
    setCapturedSelfie(null);
    setCompareResult(null);
    setChallenges([]);
    setStep(0);
    setChallengeOK(false);
    setTimeLeft(30);
    setExpired(false);
    setWebcamKey((k) => k + 1);
  };

  const retryLiveness = () => {
    hardStopLoop();
    window.__suspendFaceApi = true;
    setCapturedSelfie(null);
    setCompareResult(null);
    setChallengeOK(false);
    setChallenges(pickSequence());
    setStep(0);
    setTimeLeft(30);
    setExpired(false);
    setMediaReady(false);
    sessionRef.current += 1;
    setWebcamKey((k) => k + 1);
    setTimeout(() => { window.__suspendFaceApi = false; }, 200);
  };

  // Nuevo: repetir sólo la selfie sin tocar retos
  const repeatSelfie = () => {
    hardStopLoop();
    window.__suspendFaceApi = true; // suspende detecciones mientras se remonta la webcam
    setCapturedSelfie(null);
    setMediaReady(false);
    setWebcamKey((k) => k + 1); // fuerza remount del <Webcam/>
    setTimeout(() => { window.__suspendFaceApi = false; }, 250);
  };

  // Loop de liveness
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
          scoreThreshold: 0.25,
        });

        const loop = async () => {
          if (!running) return;

          // suspenso por otra rutina
          if (window.__suspendFaceApi) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          // cancelación/cambios
          if (thisSession !== sessionRef.current || expired || !showVerify) {
            running = false;
            hardStopLoop();
            return;
          }

          const vid = webcamRef.current?.video;
          const track = vid?.srcObject?.getVideoTracks?.()[0];
          if (
            !vid ||
            vid.readyState < 2 ||
            !vid.videoWidth ||
            !vid.videoHeight ||
            !track ||
            track.readyState !== "live"
          ) {
            rafIdRef.current = requestAnimationFrame(loop);
            return;
          }

          try {
            const pre = await faceapi.detectSingleFace(vid, options);
            if (!pre || !getValidBox(pre)) {
              rafIdRef.current = requestAnimationFrame(loop);
              return;
            }

            const det = await faceapi
              .detectSingleFace(vid, options)
              .withFaceLandmarks();

            const box = getValidBox(det);
            const landmarksOk = !!det?.landmarks;
            if (!landmarksOk || !box) {
              rafIdRef.current = requestAnimationFrame(loop);
              return;
            }

            if (!challengeOK && challenges.length > 0) {
              const lm = det.landmarks;
              const leftEye = lm.getLeftEye(),
                rightEye = lm.getRightEye();
              const mouth = lm.getMouth(),
                nose = lm.getNose();
              const noseTip = nose?.[3] || nose?.[4] || nose?.[Math.floor((nose?.length || 1) / 2)];

              if (leftEye?.length === 6 && rightEye?.length === 6 && mouth?.length >= 20 && noseTip) {
                const yawRaw = yawFromEyesNose(leftEye, rightEye, noseTip);
                const yawAdj = WEBCAM_MIRRORED ? -yawRaw : yawRaw;
                const mar = mouthMAR(mouth);

                let hit = false;
                const cur = challenges[step];
                if (cur === "left") hit = yawAdj < YAW_LEFT_THRESHOLD;
                else if (cur === "right") hit = yawAdj > YAW_RIGHT_THRESHOLD;
                else if (cur === "mouth") hit = mar > MAR_OPEN_THRESHOLD;

                if (hit) {
                  const next = step + 1;
                  if (next < challenges.length) setStep(next);
                  else {
                    setChallengeOK(true);
                    running = false;
                    hardStopLoop();
                    return;
                  }
                }
              }
            }
          } catch (e) {
            // swallow frame errors
          }

          rafIdRef.current = requestAnimationFrame(loop);
        };

        loop();
      } catch (e) {
        console.error("liveness setup error:", e);
      }
    })();

    return () => {
      running = false;
      hardStopLoop();
    };
  }, [showVerify, mediaReady, challenges, step, challengeOK, expired]);

  // ✅ versión segura
  const captureSelfie = async () => {
    if (expired || !showVerify) { alert("Se acabó el tiempo. Pulsa Reintentar."); return; }
    if (!challengeOK) { alert("Primero supera los retos."); return; }

    window.__suspendFaceApi = true; // suspende loop
    hardStopLoop();

    const video = webcamRef.current?.video;
    try {
      await ensureVideoReady(video, 5000);
    } catch {
      window.__suspendFaceApi = false;
      alert("La cámara aún no está lista.");
      return;
    }
    if (!isRenderable(video)) {
      window.__suspendFaceApi = false;
      alert("No hay imagen de la cámara. Intenta nuevamente.");
      return;
    }

    const imageSrc = safeCaptureFromVideo(video, 0.92);
    if (!imageSrc) {
      window.__suspendFaceApi = false;
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

      if (!isRenderable(img)) {
        console.warn("captureSelfie: captured Image not renderable", img);
        alert("La imagen capturada está vacía o no tiene dimensiones válidas.");
        window.__suspendFaceApi = false;
        return;
      }

      const inCanvas = document.createElement("canvas");
      inCanvas.width = img.naturalWidth || img.width || 0;
      inCanvas.height = img.naturalHeight || img.height || 0;
      try {
        inCanvas.getContext("2d").drawImage(img, 0, 0);
      } catch (err) {
        console.error("drawImage failed for captured image:", err, { width: inCanvas.width, height: inCanvas.height });
        setCapturedSelfie(imageSrc);
        window.__suspendFaceApi = false;
        return;
      }

      if (!isRenderable(inCanvas)) { setCapturedSelfie(imageSrc); window.__suspendFaceApi = false; return; }

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 384, scoreThreshold: 0.3 });

      let pre = null;
      try { pre = await faceapi.detectSingleFace(inCanvas, options); } catch (ex) { console.warn("faceapi pre detect failed:", ex); pre = null; }
      if (!pre || !getValidBox(pre)) {
        alert("No se detectó tu rostro con claridad. Mejora luz/encuadre.");
        setCapturedSelfie(imageSrc);
        window.__suspendFaceApi = false;
        return;
      }

      let det = null;
      try {
        det = await faceapi.detectSingleFace(inCanvas, options).withFaceLandmarks();
      } catch (ex) {
        console.warn("faceapi detailed detect failed:", ex);
        det = null;
      }
      const box = getValidBox(det);
      if (!box) { setCapturedSelfie(imageSrc); window.__suspendFaceApi = false; return; }

      const croppedCanvas = cropFromBoxSafe(inCanvas, box, 0.25);
      if (!croppedCanvas) { setCapturedSelfie(imageSrc); window.__suspendFaceApi = false; return; }

      const croppedDataUrl = croppedCanvas.toDataURL("image/jpeg", 0.92);
      setCapturedSelfie(croppedDataUrl);
    } catch (e) {
      console.error("❌ Error procesando la selfie:", e);
      setCapturedSelfie(imageSrc); // fallback
    } finally {
      window.__suspendFaceApi = false; // reanudar
    }
  };

  const compareFaces = async () => {
    if (!idFrontFile || !capturedSelfie) return alert("Falta carnet o selfie.");
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
    } catch {
      setCompareResult({ match: false, score: 0, error: "No se pudo verificar la identidad" });
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
        id_uv: uvInfo?.id_uv ?? null,
    // backend expects fecha_nacimiento as integer YYYYMMDD (e.g. 20000101)
    fecha_nacimiento: form.birthdate ? parseInt(String(form.birthdate).replace(/-/g, ""), 10) : null,
        lat: geo.lat,
        lon: geo.lon,
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
          nombre: "", apellido: "", rut: "", correo: "",
          telefono: "", direccion: "", password: "", password2: "",
          birthdate: "", age: "",
        });
        setGeo({ lat: null, lon: null });
        setUvMsg("");
        setGeoError(null);
        setUvInfo(null);
        setUvEdge(false);
        setIdFrontFile(null);
        setIdBackFile(null);
        setIdFrontPreview(null);
        setIdBackPreview(null);
        navigate("/");
      } else {
        throw new Error("Respuesta inesperada del servidor");
      }
    } catch (err) {
      console.error("finalizarRegistro error:", err, err?.response?.data || err?.message);
      const serverData = err?.response?.data;
      let serverMsg = null;
      if (!serverData) serverMsg = err?.message || String(err);
      else if (typeof serverData === "string") serverMsg = serverData;
      else if (serverData.detail) serverMsg = serverData.detail;
      else if (serverData.message) serverMsg = serverData.message;
      else serverMsg = JSON.stringify(serverData);

      alert(`No se pudo completar el registro: ${serverMsg}`);
    }
  };

  const minConfidence = 0.45;
  const canConfirm = Boolean(compareResult?.match) && (compareResult?.score ?? 0) >= minConfidence;

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
