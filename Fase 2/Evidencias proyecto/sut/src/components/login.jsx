import React, { useState } from "react";
import { Form, Button, Modal, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { validarRut } from "./registroVecino"; // Asegúrate de que la ruta es correcta
import { useAuth } from "../context/auth";

const LoginVecino = ({ show, handleClose, onLogin }) => {
  const [form, setForm] = useState({
    rut: "",
    contrasena: "",
  });
  
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarRut(form.rut)) {
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
      console.log("Respuesta backend:", data);

      if (response.ok) {
        // Lógica de roles
        if (data.rol === "admin") {
          alert("Bienvenido Administrador");
          login(data);
          navigate("/dashboard");
        } else if (data.rol === "vecino") {
          alert("Bienvenido Vecino");
          login(data);
        } else if (data.rol === "directivo") {
          alert("Bienvenido Directivo");
        } else if (data.rol === "secretario") {
          alert("Bienvenido Secretario");
        } else if (data.rol === "tesorero") {
          alert("Bienvenido Tesorero");
        } else {
          alert("Tipo de usuario desconocido");
        }
        setForm({ rut: "", contrasena: "" });
        handleClose();
        if (onLogin) onLogin(data); // Llama a la prop onLogin si existe
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
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Iniciar Sesión</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>RUT (ej: 12.345.678-9)</Form.Label>
            <Form.Control
              type="text"
              name="rut"
              value={form.rut}
              onChange={handleChange}
              required
              placeholder="RUT"
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Contraseña</Form.Label>
            <Form.Control
              type="password"
              name="contrasena"
              value={form.contrasena}
              onChange={handleChange}
              required
              placeholder="Contraseña"
            />
          </Form.Group>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <Spinner animation="border" size="sm" />
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default LoginVecino;