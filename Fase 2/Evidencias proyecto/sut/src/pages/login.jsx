// src/pages/login.jsx
import React, { useState } from "react";
import { Form, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";
import api from "../api"; // <-- usa el cliente axios con interceptores

// Decodifica un JWT sin verificar firma (solo para debug)
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const LoginPage = () => {
  const [form, setForm] = useState({ rut: "", contrasena: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rut = form.rut?.trim();
    if (!rut) {
      alert("El RUT ingresado no es válido");
      return;
    }

    setLoading(true);
    try {
      // POST al backend
      const { data } = await api.post("/login/", {
        rut,
        contrasena: form.contrasena,
      });

      // Esperamos: { access_token, rol, id_uv, ... }
      if (!data?.rol) {
        alert("Respuesta inválida del servidor");
        return;
      }

      // DEBUG: decodifica el JWT para ver el payload (id_uv, rol, exp, etc.)
      if (data?.access_token) {
        const payload = decodeJwt(data.access_token);
        /* eslint-disable no-console */
        console.log("[LOGIN] JWT payload:", payload);
        console.log("[LOGIN] id_uv en token:", payload?.id_uv ?? "(sin id_uv)");
        /* eslint-enable no-console */
      }

      // Guarda token + usuario en contexto (y localStorage) y configura Authorization
      login(data);
      // Garantizar que el access_token e id_uv también estén en localStorage
      try {
        if (data?.access_token) localStorage.setItem("access_token", data.access_token);
        if (data?.id_uv !== undefined) localStorage.setItem("id_uv", String(data.id_uv));
      } catch (e) {}

      // Redirección según rol
      if (data.rol === "admin") {
        alert("Bienvenido Administrador");
        navigate("/dashboard");
      } else if (data.rol === "vecino" || data.rol === "directivo") {
        alert(data.rol === "vecino" ? "Bienvenido Vecino" : "Bienvenido Directivo");
        navigate("/");
      } else {
        alert("Tipo de usuario desconocido");
      }

      setForm({ rut: "", contrasena: "" });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "No se pudo iniciar sesión";
      alert(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 p-0 page-gradient-brand">
      <div className="container d-flex justify-content-center align-items-center min-vh-100">
        <div className="card p-4 shadow bg-white" style={{ maxWidth: 400, width: "100%" }}>
          <div className="text-center mb-4">
            <i className="bi bi-person-circle" style={{ fontSize: 48, color: "#0d6efd" }}></i>
            <h2 className="fw-bold mt-2 text-primary">Iniciar Sesión</h2>
          </div>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="rut">RUT (ej: 12.345.678-9)</Form.Label>
              <Form.Control
                id="rut"
                type="text"
                name="rut"
                value={form.rut}
                onChange={handleChange}
                required
                placeholder="RUT"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="contrasena">Contraseña</Form.Label>
              <Form.Control
                id="contrasena"
                type="password"
                name="contrasena"
                value={form.contrasena}
                onChange={handleChange}
                required
                placeholder="Contraseña"
              />
            </Form.Group>
            <Button
              variant="primary"
              type="submit"
              disabled={loading}
              style={{ width: "100%" }}
              className="d-flex align-items-center justify-content-center gap-2"
            >
              {loading ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <><i className="bi bi-box-arrow-in-right"></i> Iniciar sesión</>
              )}
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;