import React, { useState } from "react";

function Avisos() {
  const [aviso, setAviso] = useState("");
  const [segmento, setSegmento] = useState("todos");

  const handleEnviar = () => {
    // Aquí iría la lógica para enviar el aviso por email, WhatsApp, etc.
    alert(`Aviso enviado a: ${segmento}`);
  };

  return (
    <div className="container mt-4">
      <h2>Notificaciones y Avisos</h2>
      <div className="form-group">
        <label>Mensaje/Afiche</label>
        <textarea className="form-control" value={aviso} onChange={e => setAviso(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Segmento destinatario</label>
        <select className="form-control" value={segmento} onChange={e => setSegmento(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="directiva">Solo directiva</option>
          <option value="inscritos">Solo inscritos en actividades</option>
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleEnviar}>Enviar Aviso</button>
    </div>
  );
}

export default Avisos;