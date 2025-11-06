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
    <div className="container-fluid min-vh-100 p-0" style={{ background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" }}>
      <div className="container p-0">
        <div className="text-center mb-4">
          <h1 className="display-5 fw-bold text-primary">Postulación de Proyecto</h1>
          <p className="lead">Propón proyectos para mejorar tu comunidad</p>
        </div>
        <div className="row justify-content-center">
          <div className="col-lg-6">
            <form onSubmit={handleSubmit} className="card p-4 shadow bg-white">
              <h4 className="mb-3 text-primary">Nuevo Proyecto</h4>
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
              <button type="submit" className="btn btn-primary w-100">
                <i className="bi bi-send me-2"></i>Enviar Proyecto
              </button>
              {mensaje && (
                <div className="alert alert-info mt-3">{mensaje}</div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProyectosVecinosForm;