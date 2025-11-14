import React, { useEffect, useState } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/auth";

function Reservas() {
  const { user } = useAuth();
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    fetchReservas();
  }, []);

  const fetchReservas = () => {
    (async () => {
      try {
        let id_uv = user?.id_uv ?? null;
        if (!id_uv) {
          const s = localStorage.getItem("id_uv");
          id_uv = s ? Number(s) : null;
        }
        if (!id_uv) {
          setReservas([]);
          return;
        }
        const token = localStorage.getItem("access_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get(`/reservas/uv/${id_uv}`, { headers });
        setReservas(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("GET /reservas/uv", err?.response?.data || err);
        setReservas([]);
      }
    })();
  };

  const actualizarEstado = (id_reserva, nuevoEstado) => {
  const reserva = reservas.find(r => r.id_reserva === id_reserva);
  if (!reserva) return alert("Reserva no encontrada");

  api.put(
    `/reservas/${id_reserva}`,
    {
      id_vecino: reserva.id_vecino,
      nombre_completo: reserva.nombre_completo,
      nombreSector: reserva.nombreSector,
      fecha_inicio: reserva.fecha_inicio,
      estado: nuevoEstado,
    }
  )
    .then(() => fetchReservas())
    .catch(err => alert("Error al actualizar la reserva"));
};

  const eliminarReserva = (id_reserva) => {
    if (window.confirm("¿Seguro que deseas eliminar esta reserva?")) {
      api.delete(`/reservas/${id_reserva}`)
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