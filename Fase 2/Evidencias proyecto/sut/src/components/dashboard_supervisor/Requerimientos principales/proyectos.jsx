import React, { useEffect, useState } from "react";
import axios from "axios";

function Proyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [proyectoRechazo, setProyectoRechazo] = useState(null);

  const fetchProyectos = () => {
    axios.get("http://localhost:8000/proyectos/")
      .then(res => setProyectos(res.data))
      .catch(() => setMensaje("Error al cargar proyectos"));
  };

  useEffect(() => {
    fetchProyectos();
  }, []);

  const actualizarEstado = (id_proyecto, nuevoEstado, razon = "") => {
    axios.put(`http://localhost:8000/proyectos/${id_proyecto}/estado`, { estado: nuevoEstado, razon })
      .then(() => {
        setMensaje(`Proyecto ${nuevoEstado === "aprobado" ? "aprobado" : "rechazado"} correctamente.`);
        fetchProyectos();
      })
      .catch(() => setMensaje("Error al actualizar el estado del proyecto."));
  };

  // Maneja el rechazo abriendo el modal
  const handleRechazar = (proy) => {
    setProyectoRechazo(proy);
    setShowModal(true);
  };

  const handleEnviarRechazo = () => {
    if (razonRechazo.trim() === "") {
      alert("Por favor ingrese una razón.");
      return;
    }
    actualizarEstado(proyectoRechazo.id_proyecto, "rechazado", razonRechazo);
    setShowModal(false);
    setRazonRechazo("");
    setProyectoRechazo(null);
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
                      onClick={() => handleRechazar(p)}
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

      {/* Modal para ingresar razón de rechazo */}
      {showModal && (
        <div className="modal" style={{
          display: "block",
          background: "rgba(0,0,0,0.5)"
        }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Razón del rechazo</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <textarea
                  className="form-control"
                  rows="3"
                  value={razonRechazo}
                  onChange={(e) => setRazonRechazo(e.target.value)}
                  placeholder="Ingrese la razón del rechazo"
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-danger" onClick={handleEnviarRechazo}>
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Proyectos;