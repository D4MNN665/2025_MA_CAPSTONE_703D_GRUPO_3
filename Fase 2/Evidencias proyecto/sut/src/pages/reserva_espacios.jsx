import React, { useState } from "react";
import { useAuth } from "../context/auth";

function getMinReservationDateString() {
  const today = new Date();
  const daysInAdvance = 7; // Cambia este valor si quieres más o menos días de anticipación
  today.setDate(today.getDate() + daysInAdvance);

  // Formatea la fecha como YYYY-MM-DD
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}



const zonas = [
  {
    nombre: "Sector Norte",
    imagen: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-7TGEZve03ZQV17ycGIUoOosXifDtd72AUA&s",
    plazas: ["Plaza Pomaire", "Piscina municipal de maipu", "Sendero Primo de Rivera"],
  },
  {
    nombre: "Sector Sur",
    imagen: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-7TGEZve03ZQV17ycGIUoOosXifDtd72AUA&s",
    plazas: ["Plaza de los master", "Plaza Nicolás Riquelme ", "Plaza Carrasco Medel"],
  },
  {
    nombre: "Sector Este",
    imagen: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-7TGEZve03ZQV17ycGIUoOosXifDtd72AUA&s",
    plazas: ["Plaza Monte Palomar", "Plaza La Fortuna", "Plaza Felipe Serrano"],
  },
  {
    nombre: "Sector Oeste",
    imagen: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-7TGEZve03ZQV17ycGIUoOosXifDtd72AUA&s",
    plazas: ["Plaza Raúl Matas", "Plaza Arturo Moya Grau", "Plaza Campanario Oriente"],
  },
];

const URL = "http://localhost:8000/reservas";

const ReservaEspaciosPage = () => {
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [plazaSeleccionada, setPlazaSeleccionada] = useState("");
  const [fecha, setFecha] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const { user } = useAuth();

  const handleZonaClick = (zona) => {
    setZonaSeleccionada(zona);
    setPlazaSeleccionada("");
    setMensaje("");
    setError("");
  };
  

  const handleSubmit = async (e) => {
  e.preventDefault();
  setMensaje("");
  setError("");

  const reserva = {
    id_vecino: user.id_vecino, 
    nombreSector: plazaSeleccionada,
    fecha_inicio: new Date(fecha).toISOString(),
    estado: "pendiente" 
  };

  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reserva),
    });

    let data = null;
    // Solo intenta leer JSON si hay contenido
    const text = await response.text();
    if (text) {
      data = JSON.parse(text);
    }

    if (response.ok) {
      setMensaje("Reserva realizada exitosamente.");
      setPlazaSeleccionada("");
      setFecha("");
    } else {
      if (data && Array.isArray(data.detail)) {
        setError(data.detail.map((err) => err.msg).join(", "));
      } else if (data && data.detail) {
        setError(data.detail || "Error al realizar la reserva.");
      } else {
        setError("Error al realizar la reserva.");
      }
    }
  } catch (error) {
    setError("Error de conexión con el servidor.");
  }
};

  return (
    <div className="container-fluid min-vh-100 p-0" style={{ background: "linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)" }}>
      <div className="container p-0">
        <div className="text-center mb-4">
          <h1 className="display-5 fw-bold text-primary">Reserva de Espacios</h1>
          <p className="lead">Seleccione un espacio para reservar</p>
        </div>
        <div className="row">
          {zonas.map((zona, idx) => (
            <div className="col-md-3 mb-4" key={idx}>
              <div
                className={`card h-100 text-center shadow-sm bg-white ${zonaSeleccionada === zona ? "border-primary" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => handleZonaClick(zona)}
              >
                <div className="card-body">
                  <h5 className="card-title text-primary">
                    <i className="bi bi-geo-alt me-2"></i>
                    {zona.nombre}
                  </h5>
                  <img
                    src={zona.imagen}
                    alt={zona.nombre}
                    className="img-fluid my-3"
                    style={{ maxHeight: "120px", objectFit: "contain" }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {zonaSeleccionada && (
          <div className="mt-4">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <form onSubmit={handleSubmit} className="card p-4 shadow bg-white">
                  <h4 className="mb-3 text-primary">Reservar en {zonaSeleccionada.nombre}</h4>
                  <div className="mb-3">
                    <label className="form-label">Plaza</label>
                    <select
                      className="form-select"
                      value={plazaSeleccionada}
                      onChange={(e) => setPlazaSeleccionada(e.target.value)}
                      required
                    >
                      <option value="">Seleccione una opción</option>
                      {zonaSeleccionada.plazas.map((plaza, idx) => (
                        <option key={idx} value={plaza}>
                          {plaza}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={fecha}
                      onChange={(e) => setFecha(e.target.value)}
                      required
                      min={getMinReservationDateString()}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100">
                    <i className="bi bi-calendar-plus me-2"></i>Reservar
                  </button>
                  {mensaje && (
                    <div className="alert alert-success mt-3" role="alert">
                      {mensaje}
                    </div>
                  )}
                  {error && (
                    <div className="alert alert-danger mt-3" role="alert">
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReservaEspaciosPage;