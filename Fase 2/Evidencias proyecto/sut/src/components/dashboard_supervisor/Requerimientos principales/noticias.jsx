import React, { useEffect, useState } from "react";
import api from "../../../api";
import { useAuth } from "../../../context/auth"; // Ajusta la ruta si tu contexto está en otro lugar

function Noticias() {
  const { user } = useAuth(); // user contains id_uv in our flow
  const [noticias, setNoticias] = useState([]);
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const autorId = user?.id_usuario || ""; // Se asigna automáticamente
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    fetchNoticias();
  }, []);

  const fetchNoticias = () => {
    (async () => {
      try {
        let id_uv = user?.id_uv ?? null;
        if (!id_uv) {
          const s = localStorage.getItem("id_uv");
          id_uv = s ? Number(s) : null;
        }
        if (!id_uv) {
          setNoticias([]);
          return;
        }
        const token = localStorage.getItem("access_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await api.get(`/noticias/uv/${id_uv}`, { headers });
        setNoticias(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("GET /noticias/uv", err?.response?.data || err);
        setNoticias([]);
      }
    })();
  };

  const handleCrear = (e) => {
    e.preventDefault();
    if (!titulo || !contenido || !autorId) return;

    const noticia = {
      titulo,
      contenido,
      fecha_publicacion: new Date().toISOString().slice(0, 19).replace("T", " "),
      autor_id: autorId
    };

    // attach optional id_uv fallback and debug
    const id_uv_local = localStorage.getItem('id_uv') || user?.id_uv;
    if (id_uv_local) noticia.id_uv = Number(id_uv_local);
    console.log('[NOTICIAS] token?', !!localStorage.getItem('access_token'), 'id_uv_local', id_uv_local);

    api.post("/noticias", noticia)
      .then(() => {
        setTitulo("");
        setContenido("");
        fetchNoticias();
      })
      .catch(err => alert("Error al crear noticia: " + (err.response?.data?.detail || "")));
  };

  const handleDelete = (id) => {
    if (window.confirm("¿Seguro que deseas eliminar esta noticia?")) {
      api.delete(`/noticias/${id}`)
        .then(() => fetchNoticias())
        .catch(err => alert("Error al eliminar noticia"));
    }
  };

  const handleEdit = (noticia) => {
    setEditId(noticia.id_noticia);
    setTitulo(noticia.titulo);
    setContenido(noticia.contenido);
    // autorId no cambia, es el del usuario logueado
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!titulo || !contenido || !autorId) return;

    const noticia = {
      titulo,
      contenido,
      fecha_publicacion: new Date().toISOString().slice(0, 19).replace("T", " "),
      autor_id: autorId
    };

    api.put(`/noticias/${editId}`, noticia)
      .then(() => {
        setEditId(null);
        setTitulo("");
        setContenido("");
        fetchNoticias();
      })
      .catch(err => alert("Error al actualizar noticia"));
  };

  return (
    <div className="container mt-4">
      <h2>Gestión de Noticias</h2>
      <div className="alert alert-info">
        Tu Author ID es: <strong>{autorId || "No definido"}</strong>
      </div>
      <form className="mb-4" onSubmit={editId ? handleUpdate : handleCrear}>
        <div className="form-group">
          <input
            className="form-control"
            placeholder="Título"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
          />
        </div>
        <div className="form-group mt-2">
          <textarea
            className="form-control"
            placeholder="Contenido"
            value={contenido}
            onChange={e => setContenido(e.target.value)}
          />
        </div>
        {/* El input de autorId se elimina, ya que se asigna automáticamente */}
        <button className="btn btn-success mt-2" type="submit">
          {editId ? "Actualizar Noticia" : "Crear Noticia"}
        </button>
        {editId && (
          <button
            className="btn btn-secondary mt-2 ms-2"
            type="button"
            onClick={() => {
              setEditId(null);
              setTitulo("");
              setContenido("");
            }}
          >
            Cancelar
          </button>
        )}
      </form>
      <ul className="list-group mt-3">
        {noticias.map(n => (
          <li key={n.id_noticia} className="list-group-item d-flex justify-content-between align-items-center">
            <div>
              <strong>{n.titulo}</strong>
              <p>{n.contenido}</p>
            </div>
            <div>
              <button className="btn btn-info btn-sm me-2" onClick={() => handleEdit(n)}>Editar</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(n.id_noticia)}>Eliminar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Noticias;