import React, { useEffect, useState } from "react";
import axios from "axios";

function Reservas() {
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    fetchReservas();
  }, []);

  const fetchReservas = () => {
    axios.get("http://localhost:8000/reservas")
      .then(res => setReservas(res.data))
      .catch(err => console.error(err));
  };

  const actualizarEstado = (id_reserva, nuevoEstado) => {
    axios.put(`http://localhost:8000/reservas/${id_reserva}`, { estado: nuevoEstado })
      .then(() => fetchReservas())
      .catch(err => alert("Error al actualizar la reserva"));
  };

  const eliminarReserva = (id_reserva) => {
    if (window.confirm("¿Seguro que deseas eliminar esta reserva?")) {
      axios.delete(`http://localhost:8000/reservas/${id_reserva}`)
        .then(() => fetchReservas())
        .catch(err => alert("Error al eliminar la reserva"));
    }
  };

  return (
    <div className="container mt-4">
      <h2>Gestión de Reservas</h2>
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID Reserva</th>
            <th>ID Vecino</th>
            <th>Nombre Completo</th>
            <th>Sector</th>
            <th>Fecha Inicio</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map(r => (
            <tr key={r.id_reserva}>
              <td>{r.id_reserva}</td>
              <td>{r.id_vecino}</td>
              <td>{r.nombre_completo}</td>
              <td>{r.nombreSector}</td>
              <td>{r.fecha_inicio}</td>
              <td>{r.estado}</td>
              <td>
                <button
                  className="btn btn-success btn-sm me-2"
                  onClick={() => actualizarEstado(r.id_reserva, "aprobado")}
                  disabled={r.estado === "aprobado"}
                >
                  Aprobar
                </button>
                <button
                  className="btn btn-warning btn-sm me-2"
                  onClick={() => actualizarEstado(r.id_reserva, "rechazado")}
                  disabled={r.estado === "rechazado"}
                >
                  Rechazar
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => eliminarReserva(r.id_reserva)}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Reservas;