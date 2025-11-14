import React, { useEffect, useState } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/auth";

function Actividades() {
  const { user } = useAuth();
  const [actividades, setActividades] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [actividadRechazo, setActividadRechazo] = useState(null);

  const fetchActividades = () => {
    (async () => {
      try {
        let id_uv = user?.id_uv ?? null;
        if (!id_uv) {
          const s = localStorage.getItem("id_uv");
          id_uv = s ? Number(s) : null;
        }
        if (!id_uv) {
          setActividades([]);
          return;
        }
        const token = localStorage.getItem("access_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get(`/actividades/uv/${id_uv}`, { headers });
        setActividades(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("GET /actividades/uv", e?.response?.data || e);
        setMensaje("Error al cargar actividades");
        setActividades([]);
      }
    })();
  };

  useEffect(() => {
    fetchActividades();
  }, []);

  const actualizarEstado = (id_actividad, nuevoEstado, razon = "") => {
    api.put(`/actividades/${id_actividad}/estado`, { estado: nuevoEstado, razon })
      .then((res) => {
        setMensaje(`Actividad ${nuevoEstado === "aprobado" ? "aprobada" : "rechazada"} correctamente.`);
        fetchActividades();
      })
      .catch((err) => {
        setMensaje("Error al actualizar el estado de la actividad.");
        console.error("Error backend:", err.response?.data || err);
      });
  };

  const handleRechazar = (act) => {
    setActividadRechazo(act);
    setShowModal(true);
  };

  const handleEnviarRechazo = () => {
    if (razonRechazo.trim() === "") {
      alert("Por favor ingrese una razón.");
      return;
    }
    actualizarEstado(actividadRechazo.id_actividad, "rechazado", razonRechazo);
    setShowModal(false);
    setRazonRechazo("");
    setActividadRechazo(null);
  };

  return (
    <div className="container mt-4">
      <h2>Gestión de Actividades</h2>
      {mensaje && <div className="alert alert-info">{mensaje}</div>}
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
              {/* <th>Estado</th> */}
            <th>Descripción</th>
            <th>Fecha</th>
            <th>Lugar</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {actividades.map(a => (
            <tr key={a.id_actividad}>
              <td>{a.id_actividad}</td>
              <td>{a.titulo}</td>
                {/* <td>{a.estado}</td> */}
              <td>{a.descripcion}</td>
              <td>{a.fecha_inicio ? a.fecha_inicio : "-"}</td>
              <td>{a.lugar || "-"}</td>
              <td>
                  {/*
                  {a.estado === "pendiente" && (
                    <>
                      <button
                        className="btn btn-success btn-sm me-2"
                        onClick={() => actualizarEstado(a.id_actividad, "aprobado")}
                      >
                        Aprobar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRechazar(a)}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {a.estado !== "pendiente" && (
                    <span className="text-muted">Sin acciones</span>
                  )}
                  */}
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

export default Actividades;