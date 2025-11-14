import React, { useState } from "react";
import api from "../../../api";

function Avisos() {
  const [aviso, setAviso] = useState("");
  const [segmento, setSegmento] = useState("todos_los_funcionarios");
  const [idRelacionado, setIdRelacionado] = useState(""); // Para actividad o reserva

  const handleEnviar = async () => {
    if (!aviso) return alert("El mensaje no puede estar vacío.");

    let payload = { segmento, mensaje: aviso };
    if (segmento === "inscritos_actividades") {
      if (!idRelacionado) return alert("Debes ingresar el ID de la actividad.");
      payload.id_actividad = Number(idRelacionado);
    }
    if (segmento === "inscritos_reservas") {
      if (!idRelacionado) return alert("Debes ingresar el ID de la reserva.");
      payload.id_reserva = Number(idRelacionado);
    }

    try {
      await api.post("/notificaciones/Notificar", payload);
      alert("Aviso enviado correctamente.");
      setAviso("");
      setIdRelacionado("");
    } catch (err) {
      alert("Error al enviar aviso: " + (err.response?.data?.detail || ""));
    }
  };

  return (
    <div className="container mt-4">
      <h2>Notificaciones y Avisos</h2>
      <div className="form-group">
        <label>Mensaje</label>
        <textarea className="form-control" value={aviso} onChange={e => setAviso(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Segmento destinatario</label>
        <select
          className="form-control"
          value={segmento}
          onChange={e => {
            setSegmento(e.target.value);
            setIdRelacionado(""); // Limpiar ID al cambiar segmento
          }}
        >
          <option value="todos_los_funcionarios">Todos los funcionarios (admins)</option>
          <option value="inscritos_actividades">Solo inscritos en actividades</option>
          <option value="inscritos_reservas">Solo inscritos en reservas</option>
          <option value="funcionarios" disabled style={{ color: "red" }}>INCOMPLETO Funcionarios municipales</option>
          <option value="juntas_vecinos" disabled style={{ color: "red" }}>INCOMPLETO Juntas de vecinos</option>
        </select>
      </div>
      {(segmento === "inscritos_actividades" || segmento === "inscritos_reservas") && (
        <div className="form-group mt-2">
          <label>
            {segmento === "inscritos_actividades" ? "ID de Actividad" : "ID de Reserva"}
          </label>
          <input
            className="form-control"
            type="number"
            value={idRelacionado}
            onChange={e => setIdRelacionado(e.target.value)}
            placeholder={
              segmento === "inscritos_actividades"
                ? "Ingrese el ID de la actividad"
                : "Ingrese el ID de la reserva"
            }
          />
        </div>
      )}
      <button className="btn btn-primary mt-3" onClick={handleEnviar}>
        Enviar Aviso
      </button>
    </div>
  );
}

export default Avisos;