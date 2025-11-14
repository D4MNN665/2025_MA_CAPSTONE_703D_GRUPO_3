import React, { useState, useEffect } from "react";
import { Form } from "react-bootstrap";

const CertificadoResidencia = ({ rut, id_vecino }) => {
  const [formRut, setFormRut] = useState("");
  const [formnombreVecino, setFormnombreVecino] = useState("");
  const [formNacionalidad, setFormNacionalidad] = useState("");
  const [formDomicilio, setFormDomicilio] = useState("");
  const [formTipoResidencia, setFormTipoResidencia] = useState("");
  const [formMotivo, setFormMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (rut) setFormRut(rut);
    else setFormRut("");
  }, [rut]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje("");
    setError("");
    if (!id_vecino) {
      setError("No se encontró el ID del vecino. No se puede enviar la solicitud.");
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const id_uv_local = localStorage.getItem("id_uv");
      console.log("ID UV local:", id_uv_local);

      const payload = {
        rut: formRut,
        nombreVecino: formnombreVecino,
        nacionalidad: formNacionalidad,
        domicilio: formDomicilio,
        tipo_residencia: formTipoResidencia,
        motivo: formMotivo,
        id_vecino: id_vecino,
      };
      if (id_uv_local) payload.id_uv = Number(id_uv_local);

      const response = await fetch("http://localhost:8000/certificados/residencia", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        setMensaje("Solicitud enviada correctamente");
        setFormnombreVecino("");
        setFormNacionalidad("");
        setFormDomicilio("");
        setFormTipoResidencia("");
        setFormMotivo("");
      } else {
        const errorMsg = await response.text();
        setError("Error al enviar la solicitud: " + errorMsg);
      }
    } catch {
      setError("Error al conectar con el servidor");
    }
  };

 return (
   <div className="container-fluid min-vh-100 p-0 page-gradient-brand">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-7">
            <div className="card shadow-lg border-0 bg-white">
              <div className="card-body p-4">
                <div className="text-center mb-4">
                  <i className="bi bi-file-earmark-text" style={{ fontSize: 48, color: "#0d6efd" }}></i>
                  <h2 className="fw-bold mt-2 text-primary">Solicitar Certificado de Residencia</h2>
                  <p className="text-muted">Completa el formulario para solicitar tu certificado oficial de residencia.</p>
                </div>
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="rut">
                    <Form.Label>RUT (OBLIGATORIO) </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ingrese su RUT"
                      value={formRut}
                      onChange={e => setFormRut(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="nombreVecino">
                    <Form.Label>Nombre completo (OBLIGATORIO)</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ingrese su nombre"
                      value={formnombreVecino}
                      onChange={e => setFormnombreVecino(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="nacionalidad">
                    <Form.Label>Nacionalidad (OBLIGATORIO)</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ingrese su nacionalidad"
                      value={formNacionalidad}
                      onChange={e => setFormNacionalidad(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="domicilio">
                    <Form.Label>Lugar de domicilio (OBLIGATORIO)</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Ingrese su domicilio"
                      value={formDomicilio}
                      onChange={e => setFormDomicilio(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="tipoResidencia">
                    <Form.Label>Tipo de residencia, Seleccione solo una opción (OBLIGATORIO)</Form.Label>
                    <Form.Select
                      value={formTipoResidencia}
                      onChange={e => setFormTipoResidencia(e.target.value)}
                      required
                    >
                      <option value="">Seleccione...</option>
                      <option value="propietario">Propietario</option>
                      <option value="arrendatario">Arrendatario</option>
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3" controlId="motivo">
                    <Form.Label>Motivo de la solicitud (OBLIGATORIO)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      placeholder="Explique el motivo"
                      value={formMotivo}
                      onChange={e => setFormMotivo(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <button type="submit" className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2" style={{ marginTop: 10 }}>
                    <i className="bi bi-send"></i> Solicitar Certificado
                  </button>
                </Form>
                {mensaje && <div className="alert alert-success mt-3">{mensaje}</div>}
                {error && <div className="alert alert-danger mt-3">{error}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificadoResidencia;