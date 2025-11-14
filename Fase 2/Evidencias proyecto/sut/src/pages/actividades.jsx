import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/auth";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// Fix default marker icon issue in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

const API_BASE = "http://localhost:8000";

const Actividades = () => {
  const { user } = useAuth();
  const [actividades, setActividades] = useState([]);
  const [nuevaActividad, setNuevaActividad] = useState({
    titulo: "",
    descripcion: "",
    ubicacion: "",
    cupo_max: 5
  });
  const [mensajeExito, setMensajeExito] = useState("");
  // Coordenadas aproximadas de Maipú, Chile
  const [ubicacion, setUbicacion] = useState({ lat: -33.5167, lng: -70.7617 }); // Maipú por defecto
  const [direccion, setDireccion] = useState("");
  // Componente para manejar el click en el mapa
  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        setUbicacion(e.latlng);
        // Geocodificación inversa con Nominatim
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${e.latlng.lat}&lon=${e.latlng.lng}`;
        const res = await fetch(url);
        const data = await res.json();
        const direccionObtenida = data.display_name || "Dirección no encontrada";
        setDireccion(direccionObtenida);
        setNuevaActividad((prev) => ({ ...prev, ubicacion: direccionObtenida }));
      },
    });
    return null;
  }

  useEffect(() => {
    cargarActividades();
    // Solicitar ubicación del usuario al cargar el formulario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          // Si el usuario no da permiso, no hacer nada
        }
      );
    }
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
    if (!nuevaActividad.ubicacion) {
      alert("Debes seleccionar una ubicación en el mapa antes de crear la actividad.");
      return;
    }
    try {
      const id_uv_local = localStorage.getItem("id_uv");
      const actividad = {
        titulo: nuevaActividad.titulo,
        descripcion: nuevaActividad.descripcion,
        ubicacion: nuevaActividad.ubicacion,
        fecha_inicio: new Date().toISOString(),
        fecha_fin: new Date(Date.now() + 3600 * 1000).toISOString(),
        cupo_max: Number(nuevaActividad.cupo_max) || 1,
        cupo_actual: 1,
        id_usuario: user.id_usuario,
        latitud: ubicacion.lat,
        longitud: ubicacion.lng,
      };
      if (id_uv_local) actividad.id_uv = Number(id_uv_local);
      await axios.post(`${API_BASE}/actividades`, actividad);
      await cargarActividades();
      setNuevaActividad({ titulo: "", descripcion: "", ubicacion: "", cupo_max: 5 });
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
      <div className="container-fluid min-vh-100 page-gradient-brand">
        <div className="container mt-4">
          <div className="alert alert-warning">
            Debes estar logueado para crear o enrolarte en actividades.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid min-vh-100 page-gradient-brand">
      <div className="container p-0">
        <div className="text-center mb-4">
          <h1 className="display-5 fw-bold on-brand-title">Gestión de Actividades</h1>
          <p className="lead on-brand-subtitle">Crea y participa en actividades de tu comunidad</p>
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
              <div className="mb-3">
                <label className="form-label">Cupo máximo</label>
                <input
                  type="number"
                  className="form-control"
                  min={1}
                  max={1000}
                  value={nuevaActividad.cupo_max}
                  onChange={e => setNuevaActividad({ ...nuevaActividad, cupo_max: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Ubicación</label>
                <div style={{ height: "250px", width: "100%" }}>
                  <MapContainer
                    center={ubicacion}
                    zoom={14}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; OpenStreetMap contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler />
                    <Marker position={ubicacion} />
                  </MapContainer>
                </div>
                <small className="text-muted">
                  Pincha en el mapa para seleccionar la ubicación de la actividad.
                </small>
                <div className="mt-2">
                  <strong>Dirección seleccionada:</strong>
                  <div>{direccion}</div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Crear
              </button>
            </form>
          </div>
          <div className="col-lg-7">
            <h2 className="mb-4 on-brand-title">Actividades</h2>
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
                        {act.ubicacion && (
                          <div className="mb-2">
                            <span
                              className="badge bg-secondary"
                              style={{
                                display: "inline-block",
                                maxWidth: "100%",
                                wordBreak: "break-word",
                                whiteSpace: "pre-line"
                              }}
                            >
                              <strong>Ubicación:</strong> {act.ubicacion}
                            </span>
                          </div>
                        )}
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
