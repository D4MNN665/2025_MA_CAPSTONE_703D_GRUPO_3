import React, { useState } from "react";
import { Form, Button, Modal, Spinner } from "react-bootstrap";

// Validador de RUT chileno
export const validarRut = (rutCompleto) => {
  if (!rutCompleto) return false;
  const rutLimpio = rutCompleto.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  if (rutLimpio.length < 2) return false;

  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1);

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  let dvEsperado = "";

  if (resto === 11) dvEsperado = "0";
  else if (resto === 10) dvEsperado = "K";
  else dvEsperado = resto.toString();

  return dv === dvEsperado;
};

const RegistroVecino = ({ show, handleClose }) => {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    rut: "",
    direccion: "",
    correo: "",
    contrasena: "",
    numero_telefono: "",
  });

  const [loading, setLoading] = useState(false);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    let nuevoForm = {
      nombre: form.nombre,
      apellido: form.apellido,
      rut: form.rut,
      direccion: form.direccion,
      correo: form.correo,
      contrasena: form.contrasena,
      numero_telefono: form.numero_telefono,
    };

    if (name === "nombre") nuevoForm.nombre = value;
    else if (name === "apellido") nuevoForm.apellido = value;
    else if (name === "rut") nuevoForm.rut = value;
    else if (name === "direccion") nuevoForm.direccion = value;
    else if (name === "correo") nuevoForm.correo = value;
    else if (name === "contrasena") nuevoForm.contrasena = value;
    else if (name === "numero_telefono") nuevoForm.numero_telefono = value;

    setForm(nuevoForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validarRut(form.rut)) {
      alert("El RUT ingresado no es válido");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8000/vecinos/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          rut: form.rut,
          direccion: form.direccion,
          correo: form.correo,
          contrasena: form.contrasena,
          numero_telefono: form.numero_telefono,
          miembro: 0,
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log("Respuesta backend:", data);

      if (response.ok) {
        alert("Vecino registrado exitosamente");
        setForm({
          nombre: "",
          apellido: "",
          rut: "",
          direccion: "",
          correo: "",
          contrasena: "",
          numero_telefono: "",
        });
        handleClose();
      } else {
        alert("Error: " + (data.detail || "No se pudo registrar"));
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Registro de Vecino</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
              placeholder="Nombre"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Apellido</Form.Label>
            <Form.Control
              type="text"
              name="apellido"
              value={form.apellido}
              onChange={handleChange}
              required
              placeholder="Apellido"
            />
          </Form.Group>

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
            <Form.Label>Dirección</Form.Label>
            <Form.Control
              type="text"
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              required
              placeholder="Dirección"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Correo</Form.Label>
            <Form.Control
              type="email"
              name="correo"
              value={form.correo}
              onChange={handleChange}
              required
              placeholder="Correo"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              type="text"
              name="numero_telefono"
              value={form.numero_telefono}
              onChange={handleChange}
              required
              placeholder="Teléfono"
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
            {loading ? <Spinner animation="border" size="sm" /> : "Registrar"}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default RegistroVecino;
