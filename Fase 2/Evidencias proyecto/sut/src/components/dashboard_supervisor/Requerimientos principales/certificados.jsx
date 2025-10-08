import React, { useEffect, useState } from "react";

const CertificadosDashboard = () => {
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [razonRechazo, setRazonRechazo] = useState("");
  const [certificadoRechazo, setCertificadoRechazo] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8000/certificados/residencia")
      .then((res) => res.json())
      .then((data) => {
        setCertificados(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Función para actualizar el estado del certificado
  const actualizarEstado = (id_certificado, nuevoEstado, razon = "") => {
    fetch(`http://localhost:8000/certificados/residencia/${id_certificado}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado, razon }),
    }).then((res) => {
      if (res.ok) {
        setCertificados((prev) =>
          prev.map((cert) =>
            cert.id_certificado === id_certificado
              ? { ...cert, estado: nuevoEstado }
              : cert
          )
        );
      }
    });
  };

  const enviarPDF = (cert) => {
    fetch(
      `http://localhost:8000/certificados/enviar_pdf/${cert.id_certificado}`,
      {
        method: "POST",
      }
    )
      .then((res) => res.json())
      .then((data) => {
        alert(data.mensaje || "PDF enviado correctamente");
      })
      .catch(() => {
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
            {certificados.map((cert) => (
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