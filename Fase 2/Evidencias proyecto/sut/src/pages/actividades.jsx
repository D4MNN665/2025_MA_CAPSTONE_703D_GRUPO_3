import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/auth";

const API_BASE = "http://localhost:8000";

const Actividades = () => {
  const { user } = useAuth();
  const [actividades, setActividades] = useState([]);
  const [nuevaActividad, setNuevaActividad] = useState({
    titulo: "",
    descripcion: "",
  });
  const [mensajeExito, setMensajeExito] = useState("");

  useEffect(() => {
    cargarActividades();
  }, []);

  const cargarActividades = async () => {
    try {
      const res = await axios.get(`${API_BASE}/actividades`);
      setActividades(res.data);
    } catch {
      setActividades([]);
    }
  };

  const crearActividad = async (e) => {
    e.preventDefault();
    if (!user?.id_usuario) {
      alert("Debes estar logueado para crear una actividad.");
      return;
    }
    try {
      const actividad = {
        titulo: nuevaActividad.titulo,
        descripcion: nuevaActividad.descripcion,
        fecha_inicio: new Date().toISOString(),
        fecha_fin: new Date(Date.now() + 3600 * 1000).toISOString(),
        cupo_max: 5,
        cupo_actual: 1,
        id_usuario: user.id_usuario,
      };
      await axios.post(`${API_BASE}/actividades`, actividad);
      await cargarActividades();
      setNuevaActividad({ titulo: "", descripcion: "" });
      setMensajeExito("¡Actividad agregada exitosamente!");
      setTimeout(() => setMensajeExito(""), 3000);
    } catch {
      alert("Error al crear actividad");
    }
  };

  const enrolarse = async (id) => {
    try {
      await axios.post(`${API_BASE}/actividades/${id}/enrolar`, {
        usuario_id: user.id_usuario,
      });
      await cargarActividades();
      alert("¡Te has enrolado en la actividad!");
    } catch (error) {
      if (error.response?.status === 400) {
        alert(error.response.data.detail); // Muestra el mensaje del backend
      } else {
        alert("Error al enrolarse");
      }
    }
  };

  if (!user?.id_usuario) {
    return (
      <div className="container-fluid min-vh-100" style={{ background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" }}>
        <div className="container mt-4">
          <div className="alert alert-warning">
            Debes estar logueado para crear o enrolarte en actividades.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100" style={{ background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" }}>
      <div className="container p-0">
        <div className="text-center mb-4">
          <h1 className="display-5 fw-bold text-primary">Gestión de Actividades</h1>
          <p className="lead">Crea y participa en actividades de tu comunidad</p>
        </div>
        <div className="row">
          <div className="col-lg-5 mb-4">
            <form onSubmit={crearActividad} className="card p-4 shadow bg-white">
              <h4 className="mb-3 text-primary">Nueva Actividad</h4>
              {mensajeExito && (
                <div className="alert alert-success" role="alert">
                  {mensajeExito}
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Título</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Título"
                  value={nuevaActividad.titulo}
                  onChange={(e) =>
                    setNuevaActividad({
                      ...nuevaActividad,
                      titulo: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Descripción</label>
                <textarea
                  className="form-control"
                  placeholder="Descripción"
                  value={nuevaActividad.descripcion}
                  onChange={(e) =>
                    setNuevaActividad({
                      ...nuevaActividad,
                      descripcion: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Crear
              </button>
            </form>
          </div>
          <div className="col-lg-7">
            <h2 className="mb-4 text-primary">Actividades</h2>
            {actividades.length === 0 ? (
              <div className="alert alert-info">No hay actividades disponibles.</div>
            ) : (
              <ul className="list-group">
                {actividades.map((act) => (
                  <li key={act.id_actividad} className="list-group-item mb-3 p-0 border-0">
                    <div className="card shadow-sm bg-white">
                      <div className="card-body">
                        <h5 className="card-title text-primary">
                          <i className="bi bi-calendar-event me-2"></i>
                          {act.titulo}
                        </h5>
                        <p className="card-text">{act.descripcion}</p>
                        <div className="d-flex justify-content-between align-items-center">
                          <small className="text-muted">
                            Cupo: {act.cupo_actual} / {act.cupo_max}
                          </small>
                          {act.id_usuario !== user.id_usuario &&
                            !(act.usuarios_enrolados || []).includes(user.id_usuario) && (
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => enrolarse(act.id_actividad)}
                              >
                                <i className="bi bi-person-plus"></i> Enrolarse
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Actividades;
