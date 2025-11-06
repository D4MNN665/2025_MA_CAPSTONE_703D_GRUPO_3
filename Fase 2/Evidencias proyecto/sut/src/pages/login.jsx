import React, { useState } from "react";
import { Form, Button, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/auth";

const LoginPage = () => {
  const [form, setForm] = useState({
    rut: "",
    contrasena: "",
  });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const campo = e.target.name;
    const valor = e.target.value;

    // Creamos una copia del estado actual
    const nuevoForm = { ...form };

    // Actualizamos el campo correspondiente
    if (campo === "rut") {
      nuevoForm.rut = valor;
    } else if (campo === "contrasena") {
      nuevoForm.contrasena = valor;
    }

    // Guardamos el nuevo estado
    setForm(nuevoForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.rut) {
      alert("El RUT ingresado no es válido");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rut: form.rut,
          contrasena: form.contrasena,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.rol) {
        // Guarda el access_token si existe
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);
        }
        if (data.rol === "admin") {
          alert("Bienvenido Administrador");
          login(data);
          navigate("/dashboard");
        } else if (data.rol === "vecino" || data.rol === "directivo") {
          alert(
            data.rol === "vecino" ? "Bienvenido Vecino" : "Bienvenido Directivo"
          );
          login(data);
          navigate("/");
        } else {
          alert("Tipo de usuario desconocido");
        }
        setForm({ rut: "", contrasena: "" });
      } else {
        alert("Error: " + (data.detail || "No se pudo iniciar sesión"));
      }
    } catch {
      alert("Error de conexión, POST login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid min-vh-100 p-0" style={{ background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" }}>
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
