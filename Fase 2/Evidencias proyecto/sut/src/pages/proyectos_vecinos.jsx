import React, { useState } from "react";
import { useAuth } from "../context/auth"; // Ajusta la ruta si es necesario

const tiposProyecto = [
  "Infraestructura",
  "Social",
  "Ambiental",
  "Cultural",
  "Otro"
];

const ProyectosVecinosForm = () => {
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    tipo_proyecto: "",
    ubicacion: "",
  });
  const [mensaje, setMensaje] = useState("");
  const { user } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    if (!user || !user.id_vecino) {
      setMensaje("No se pudo identificar al usuario.");
      return;
    }
    const data = {
      id_vecino: user.id_vecino,
      titulo: form.titulo,
      descripcion: form.descripcion,
      fecha_postulacion: new Date().toISOString().slice(0, 10),
      estado: "pendiente",
      tipo_proyecto: form.tipo_proyecto,
      ubicacion: form.ubicacion,
    };
    try {
      const res = await fetch("http://localhost:8000/proyectos/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setMensaje("Proyecto enviado correctamente.");
        setForm({
          titulo: "",
          descripcion: "",
          tipo_proyecto: "",
          ubicacion: "",
        });
      } else {
        const error = await res.json();
        setMensaje(error.detail || "Error al enviar el proyecto.");
      }
    } catch (err) {
      setMensaje("Error de conexión con el servidor.");
    }
  };

  return (
    <div className="container mt-4">
      <h2>Postulación de Proyecto</h2>
      <form onSubmit={handleSubmit} className="mt-3">
        <div className="mb-3">
          <label className="form-label">Nombre del proyecto</label>
          <input
            type="text"
            className="form-control"
            name="titulo"
            value={form.titulo}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Descripción del objetivo</label>
          <textarea
            className="form-control"
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Tipo de proyecto</label>
          <select
            className="form-select"
            name="tipo_proyecto"
            value={form.tipo_proyecto}
            onChange={handleChange}
            required
          >
            <option value="">Seleccione...</option>
            {tiposProyecto.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="form-label">Ubicación o calle</label>
          <input
            type="text"
            className="form-control"
            name="ubicacion"
            value={form.ubicacion}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Enviar Proyecto
        </button>
      </form>
      {mensaje && (
        <div className="alert alert-info mt-3">{mensaje}</div>
      )}
    </div>
  );
};

export default ProyectosVecinosForm;