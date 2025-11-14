// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000",
  timeout: 30000,
});

// Request interceptor: añade Authorization y registra debug sin exponer el token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  try {
    // silent request debug: removed verbose console logs to keep console clean
  } catch {}
  return config;
});

// Response interceptor: log de respuestas y de errores de red/CORS
api.interceptors.response.use(
  (response) => {
    try {
      // no verbose response logging
    } catch {}
    return response;
  },
  (error) => {
    try {
      /* eslint-disable no-console */
      const cfg = error.config || {};
      const url = `${cfg.baseURL || ""}${cfg.url || ""}`;
      const status = error?.response?.status;
      const acao = error?.response?.headers?.["access-control-allow-origin"]; // puede ser undefined si CORS bloquea
      console.warn(`[API][ERR] ${cfg.method?.toUpperCase() || ""} ${url} -> ${status || 'NO_STATUS'}`, { code: error.code, acao });
      /* eslint-enable no-console */
    } catch {}
    return Promise.reject(error);
  }
);



export default api;
