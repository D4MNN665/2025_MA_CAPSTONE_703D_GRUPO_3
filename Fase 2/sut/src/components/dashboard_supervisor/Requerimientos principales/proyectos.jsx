import React, { useEffect, useState } from "react";
import axios from "axios";

function Proyectos() {
  const [proyectos, setProyectos] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/proyectos")
      .then(res => setProyectos(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="container mt-4">
      <h2>Gestión de Proyectos Vecinales</h2>
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Observaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.nombre}</td>
              <td>{p.estado}</td>
              <td>{p.observaciones}</td>
              <td>
                <button className="btn btn-success btn-sm">Aprobar</button>
                <button className="btn btn-danger btn-sm">Rechazar</button>
                <button className="btn btn-info btn-sm">Ver Historial</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Proyectos;