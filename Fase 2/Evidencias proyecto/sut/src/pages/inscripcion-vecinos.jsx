import React from "react";
import { Modal, Button } from "react-bootstrap";
import axios from "axios";

const InscripcionVecinos = ({ show, handleClose, userId, userRol }) => {
  const esAdmin = userRol === "admin";
  const yaEsDirectivo = userRol === "directivo";

  const handleInscripcion = async () => {
    if (esAdmin) {
      alert("Los administradores no pueden inscribirse como miembros.");
      return;
    }
    try {
      await axios.put(
        `http://localhost:8000/usuarios/${userId}/rol?rol=directivo`
      );
      alert("¡Ahora eres miembro!");
      handleClose();
    } catch (error) {
      alert("Error al inscribirse como miembro");
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Inscripción miembro de Vecinos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {esAdmin
          ? "Los administradores no pueden inscribirse como miembros."
          : yaEsDirectivo
          ? "Ya eres miembro."
          : "¿Deseas postularte como miembro?"}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleInscripcion}
          disabled={yaEsDirectivo || esAdmin}
        >
          Postularse
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default InscripcionVecinos;
