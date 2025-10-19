import React, { useEffect, useState } from "react";
import axios from "axios";

function Vecinos() {
  const [vecinos, setVecinos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    fetchVecinos();
  }, []);

  const fetchVecinos = () => {
    axios
      .get("http://localhost:8000/vecinos")
      .then((res) => setVecinos(res.data))
      .catch((err) => console.error(err));
  };

  // Contar miembros y no miembros
  const miembrosCount = vecinos.filter((v) => v.miembro === 1).length;
  const noMiembrosCount = vecinos.filter((v) => v.miembro === 0).length;

  const handleDelete = async (id_vecino) => {
    if (
      window.confirm(
        "¿Estás seguro de que deseas eliminar este vecino?\nEsta acción no se puede deshacer."
      )
    ) {
      try {
        await axios.delete(`http://localhost:8000/vecinos/${id_vecino}`);
        fetchVecinos();
      } catch (err) {
        alert("Error al eliminar el vecino");
        console.error(err);
      }
    }
  };

  const handleEdit = (vecino) => {
    setEditId(vecino.id_vecino);
    setEditData({
      id_vecino: vecino.id_vecino,
      nombre: vecino.nombre,
      apellido: vecino.apellido,
      rut: vecino.rut,
      correo: vecino.correo,
      numero_telefono: vecino.numero_telefono || "",
      direccion: vecino.direccion || "",
      contrasena: vecino.contrasena || "",
      miembro: vecino.miembro,
    });
  };

  const handleCancel = () => {
    setEditId(null);
    setEditData({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData(function (prev) {
      let nuevoEditData = {
        id_vecino: prev.id_vecino,
        nombre: prev.nombre,
        apellido: prev.apellido,
        rut: prev.rut,
        correo: prev.correo,
        numero_telefono: prev.numero_telefono,
        direccion: prev.direccion,
        contrasena: prev.contrasena,
        miembro: prev.miembro,
      };
      if (name === "miembro") {
        nuevoEditData.miembro = Number(value);
      } else if (name === "nombre") {
        nuevoEditData.nombre = value;
      } else if (name === "apellido") {
        nuevoEditData.apellido = value;
      } else if (name === "correo") {
        nuevoEditData.correo = value;
      } else if (name === "numero_telefono") {
        nuevoEditData.numero_telefono = value;
      } else if (name === "direccion") {
        nuevoEditData.direccion = value;
      }
      // El campo rut y contrasena no se pueden editar
      return nuevoEditData;
    });
  };

  const handleSave = async () => {
    try {
      const dataToSend = {
        nombre: editData.nombre,
        apellido: editData.apellido,
        rut: editData.rut,
        correo: editData.correo,
        numero_telefono: editData.numero_telefono || "",
        direccion: editData.direccion || "",
        contrasena: editData.contrasena || "",
        miembro: editData.miembro,
      };
      const token = localStorage.getItem("access_token");
      console.log("TOKEN:", token);
      await axios.put(`http://localhost:8000/vecinos/${editId}`, dataToSend, {
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      fetchVecinos();
      setEditId(null);
      setEditData({});
    } catch (err) {
      alert("Error al actualizar el vecino");
      console.error(err.response?.data);
    }
  };

  return (
    <div className="container mt-4">
      <h2>Gestión de Vecinos</h2>
      <div className="mb-3">
        <strong>Miembros:</strong> {miembrosCount} &nbsp;|&nbsp;
        <strong>No Miembros:</strong> {noMiembrosCount}
      </div>
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Apellido</th>
            <th>RUT</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Contraseña</th>
            <th>Estado Inscripción</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {vecinos.map((v) => (
            <tr key={v.id_vecino}>
              <td>{v.id_vecino}</td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="nombre"
                    value={editData.nombre}
                    onChange={handleChange}
                    className="form-control"
                  />
                ) : (
                  v.nombre
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="apellido"
                    value={editData.apellido}
                    onChange={handleChange}
                    className="form-control"
                  />
                ) : (
                  v.apellido
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="rut"
                    value={editData.rut}
                    className="form-control"
                    disabled
                  />
                ) : (
                  v.rut
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="correo"
                    value={editData.correo}
                    onChange={handleChange}
                    className="form-control"
                  />
                ) : (
                  v.correo
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="numero_telefono"
                    value={editData.numero_telefono}
                    onChange={handleChange}
                    className="form-control"
                  />
                ) : (
                  v.numero_telefono
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="direccion"
                    value={editData.direccion}
                    onChange={handleChange}
                    className="form-control"
                  />
                ) : (
                  v.direccion
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <input
                    name="contrasena"
                    value={
                      editData.contrasena
                        ? "*".repeat(editData.contrasena.length)
                        : ""
                    }
                    className="form-control"
                    disabled
                  />
                ) : v.contrasena ? (
                  "*".repeat(v.contrasena.length)
                ) : (
                  ""
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <select
                    name="miembro"
                    value={editData.miembro}
                    onChange={handleChange}
                    className="form-control"
                  >
                    <option value={1}>Miembro</option>
                    <option value={0}>No Miembro</option>
                  </select>
                ) : v.miembro === 1 ? (
                  "Miembro"
                ) : (
                  "No Miembro"
                )}
              </td>
              <td>
                {editId === v.id_vecino ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={handleSave}
                    >
                      Guardar
                    </button>
                    <button
                      className="btn btn-secondary btn-sm me-2"
                      onClick={handleCancel}
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn btn-warning btn-sm me-2"
                      onClick={() => handleEdit(v)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(v.id_vecino)}
                    >
                      Eliminar
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default Vecinos;
