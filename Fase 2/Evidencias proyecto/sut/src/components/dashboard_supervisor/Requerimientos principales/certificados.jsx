import React, { useEffect, useState } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/auth";

const CertificadosDashboard = () => {
  const { user } = useAuth();
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [certificadoRechazo, setCertificadoRechazo] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        let id_uv = user?.id_uv ?? null;
        if (!id_uv) {
          const s = localStorage.getItem("id_uv");
          id_uv = s ? Number(s) : null;
        }
        if (!id_uv) {
          setCertificados([]);
          return;
        }
        const token = localStorage.getItem("access_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const { data } = await api.get(`/certificados/uv/${id_uv}`, { headers });
        setCertificados(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("GET /certificados/uv", e?.response?.data || e);
        setCertificados([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Función para actualizar el estado del certificado
  const actualizarEstado = (id_certificado, nuevoEstado, razon = "") => {
    api
      .put(`/certificados/residencia/${id_certificado}`, { estado: nuevoEstado, razon })
      .then(() => {
        setCertificados((prev) =>
          prev.map((cert) =>
            cert.id_certificado === id_certificado ? { ...cert, estado: nuevoEstado } : cert
          )
        );
      })
      .catch((e) => console.error("PUT /certificados/residencia", e?.response?.data || e));
  };

  const enviarPDF = (cert) => {
    api
      .post(`/certificados/enviar_pdf/${cert.id_certificado}`)
      .then(({ data }) => alert(data?.mensaje || "PDF enviado correctamente"))
      .catch((e) => {
        console.error("POST /certificados/enviar_pdf", e?.response?.data || e);
        alert("Error al enviar el PDF");
      });
  };

  // Nueva función para manejar el rechazo
  const handleRechazar = (cert) => {
    setCertificadoRechazo(cert);
    setShowModal(true);
  };

  const handleEnviarRechazo = () => {
    if (razonRechazo.trim() === "") {
      alert("Por favor ingrese una razón.");
      return;
    }
    actualizarEstado(certificadoRechazo.id_certificado, "rechazado", razonRechazo);
    setShowModal(false);
    setRazonRechazo("");
    setCertificadoRechazo(null);
  };

  return (
    <div className="container mt-4">
      <h2>Certificados emitidos por los vecinos</h2>
      {loading ? (
        <div>Cargando certificados...</div>
      ) : (
        <table className="table table-striped mt-3">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha Solicitud</th>
              <th>Nombre Vecino</th>
              <th>RUT</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Tipo Residencia</th>
              <th>Domicilio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(certificados) && certificados.map((cert) => (
              <tr key={cert.id_certificado}>
                <td>{cert.id_certificado}</td>
                <td>{cert.fecha_solicitud}</td>
                <td>{cert.nombreVecino}</td>
                <td>{cert.rut}</td>
                <td>{cert.motivo}</td>
                <td>{cert.estado}</td>
                <td>{cert.tipo_residencia}</td>
                <td>{cert.domicilio}</td>
                <td>
                  {cert.estado === "pendiente" && (
                    <>
                      <button
                        className="btn btn-success btn-sm me-2"
                        onClick={() =>
                          actualizarEstado(cert.id_certificado, "aprobado")
                        }
                      >
                        Aprobar
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRechazar(cert)}
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                  {cert.estado === "aprobado" && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => enviarPDF(cert)}
                    >
                      Enviar PDF
                    </button>
                  )}
                  {cert.estado === "rechazado" && (
                    <span className="text-muted">Sin acciones</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
};

export default CertificadosDashboard;