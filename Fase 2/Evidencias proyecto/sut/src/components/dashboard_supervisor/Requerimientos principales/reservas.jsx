import React, { useEffect, useState } from "react";
import axios from "axios";

function Reservas() {
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/reservas")
      .then(res => setReservas(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container mt-4">
      <h2>Gestión de Reservas</h2>
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.usuario}</td>
              <td>{r.fecha}</td>
              <td>{r.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Reservas;