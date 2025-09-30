import React, { useState, useEffect } from "react";
import { Modal, Button, Form } from "react-bootstrap";

const CertificadoResidencia = ({ show, handleClose, rut, id_vecino }) => {
  const [formRut, setFormRut] = useState("");
  const [formnombreVecino, setFormnombreVecino] = useState("");
  const [formNacionalidad, setFormNacionalidad] = useState("");
  const [formDomicilio, setFormDomicilio] = useState("");
  const [formTipoResidencia, setFormTipoResidencia] = useState("");
  const [formMotivo, setFormMotivo] = useState("");

  useEffect(() => {
    if (rut) setFormRut(rut);
    else setFormRut("");
  }, [rut, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log("id_usuario enviado:", id_vecino);
      const response = await fetch("http://localhost:8000/certificados/residencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rut: formRut,
          nombreVecino: formnombreVecino,
          nacionalidad: formNacionalidad,
          domicilio: formDomicilio,
          tipo_residencia: formTipoResidencia,
          motivo: formMotivo,
          id_vecino: id_vecino,
        }),
      });
      if (response.ok) {
        alert("Solicitud enviada correctamente");
        handleClose();
        setFormnombreVecino("");
        setFormNacionalidad("");
        setFormDomicilio("");
        setFormTipoResidencia("");
        setFormMotivo("");
      } else {
        alert("Error al enviar la solicitud");
      }
    } catch {
      alert("Error al conectar con el servidor");
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Solicitar Certificado de Residencia</Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
          <Button variant="primary" type="submit">
            Solicitar
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default CertificadoResidencia;