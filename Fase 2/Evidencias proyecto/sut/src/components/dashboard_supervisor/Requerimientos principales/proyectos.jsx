import React, { useEffect, useState } from "react";
import axios from "axios";

function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [mensaje, setMensaje] = useState("");

  const fetchProyectos = () => {
    axios.get("http://localhost:8000/proyectos/")
      .then(res => setProyectos(res.data))
      .catch(err => setMensaje("Error al cargar proyectos"));
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  const actualizarEstado = (id_proyecto, nuevoEstado) => {
    axios.put(`http://localhost:8000/proyectos/${id_proyecto}`, {
      // Solo se envían los campos requeridos para actualizar el estado
      estado: nuevoEstado
    })
      .then(() => {
        setMensaje(`Proyecto ${nuevoEstado === "aprobado" ? "aprobado" : "rechazado"} correctamente.`);
        fetchProyectos();
      })
      .catch(() => setMensaje("Error al actualizar el estado del proyecto."));
  };

  return (
    <div className="container mt-4">
      <h2>Gestión de Proyectos Vecinales</h2>
      {mensaje && <div className="alert alert-info">{mensaje}</div>}
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Descripción</th>
            <th>Tipo</th>
            <th>Ubicación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {proyectos.map(p => (
            <tr key={p.id_proyecto}>
              <td>{p.id_proyecto}</td>
              <td>{p.titulo}</td>
              <td>{p.estado}</td>
              <td>{p.descripcion}</td>
              <td>{p.tipo_proyecto}</td>
              <td>{p.ubicacion}</td>
              <td>
                {p.estado === "pendiente" && (
                  <>
                    <button
                      className="btn btn-success btn-sm me-2"
                      onClick={() => actualizarEstado(p.id_proyecto, "aprobado")}
                    >
                      Aprobar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => actualizarEstado(p.id_proyecto, "rechazado")}
                    >
                      Rechazar
                    </button>
                  </>
                )}
                {p.estado !== "pendiente" && (
                  <span className="text-muted">Sin acciones</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Proyectos;