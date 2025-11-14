// src/pages/historial.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/auth";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../App.css";

function fmtDate(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  } catch {}
  return String(v).slice(0, 10);
}

const Section = ({ title, columns, rows, emptyText }) => (
  <div className="card p-3 shadow-sm mb-3">
    <h5 className="mb-3 d-flex align-items-center gap-2">
      <i className="bi bi-list-check text-primary"></i>
      <span>{title}</span>
    </h5>
    {rows.length === 0 ? (
      <div className="text-muted">{emptyText}</div>
    ) : (
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <td key={c.key} className="text-nowrap">
                    {typeof c.render === "function" ? c.render(r[c.key], r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const HistorialPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [actividades, setActividades] = useState([]);

  useEffect(() => {
    let mounted = true;
    const tryGet = async (primaryFn, fallbackFn) => {
      try {
        const r = await primaryFn();
        if (Array.isArray(r?.data) && r.data.length > 0) return r.data;
      } catch {}
      try {
        const r2 = await fallbackFn?.();
        return Array.isArray(r2?.data) ? r2.data : [];
      } catch {
        return [];
      }
    };

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const idUv = localStorage.getItem("id_uv");
        const [reservasRaw, proyectosRaw, certsRaw, actsRaw] = await Promise.all([
          tryGet(() => api.get("/reservas/"), () => (idUv ? api.get(`/reservas/uv/${idUv}`) : Promise.resolve({ data: [] }))),
          tryGet(() => api.get("/proyectos/"), () => (idUv ? api.get(`/proyectos/uv/${idUv}`) : Promise.resolve({ data: [] }))),
          tryGet(() => api.get("/certificados/residencia"), () => (idUv ? api.get(`/certificados/uv/${idUv}`) : Promise.resolve({ data: [] }))),
          tryGet(() => api.get("/actividades")),
        ]);

        if (!mounted) return;
        const id_vecino = user.id_vecino;
        const id_usuario = user.id_usuario;

        const reservasUser = Array.isArray(reservasRaw)
          ? reservasRaw
              .filter((r) => String(r.id_vecino) === String(id_vecino))
              .map((r) => {
                const raw = r.fecha_inicio || r.fecha || r.fecha_reserva;
                return {
                  fecha: fmtDate(raw),
                  sector: r.nombreSector,
                  estado: r.estado,
                  sortKey: Date.parse(raw || "") || 0,
                };
              })
              .sort((a, b) => b.sortKey - a.sortKey)
          : [];

        const proyectosUser = Array.isArray(proyectosRaw)
          ? proyectosRaw
              .filter((p) => String(p.id_vecino) === String(id_vecino))
              .map((p) => {
                const raw = p.fecha_postulacion;
                return {
                  fecha: fmtDate(raw),
                  titulo: p.titulo,
                  estado: p.estado,
                  sortKey: Date.parse(raw || "") || 0,
                };
              })
              .sort((a, b) => b.sortKey - a.sortKey)
          : [];

        const certificadosUser = Array.isArray(certsRaw)
          ? certsRaw
              .filter((c) => String(c.id_vecino) === String(id_vecino))
              .map((c) => {
                const raw = c.fecha_solicitud || c.fecha;
                return {
                  fecha: fmtDate(raw),
                  motivo: c.motivo,
                  estado: c.estado || "pendiente",
                  sortKey: Date.parse(raw || "") || 0,
                };
              })
              .sort((a, b) => b.sortKey - a.sortKey)
          : [];

        const actividadesUser = Array.isArray(actsRaw)
          ? actsRaw
              .filter(
                (a) => Array.isArray(a.usuarios_enrolados) && a.usuarios_enrolados.includes(Number(id_usuario))
              )
              .map((a) => {
                const raw = a.fecha_inicio || a.fecha;
                return {
                  fecha: fmtDate(raw),
                  titulo: a.titulo,
                  cupo: a.cupo,
                  sortKey: Date.parse(raw || "") || 0,
                };
              })
              .sort((a, b) => b.sortKey - a.sortKey)
          : [];

        setReservas(reservasUser);
        setProyectos(proyectosUser);
        setCertificados(certificadosUser);
        setActividades(actividadesUser);
      } catch (e) {
        setReservas([]);
        setProyectos([]);
        setCertificados([]);
        setActividades([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const renderEstado = (value) => {
    const v = String(value || "").toLowerCase();
    const map = {
      pendiente: "badge bg-warning text-dark",
      aprobado: "badge bg-success",
      rechazada: "badge bg-danger",
      rechazado: "badge bg-danger",
      aprobada: "badge bg-success",
    };
    const cls = map[v] || "badge bg-secondary";
    return (
      <span className={cls} style={{ fontWeight: 600 }}>
        {value}
      </span>
    );
  };

  if (!user) {
    return (
      <div className="container py-5">
        <button className="btn btn-outline-primary mb-3" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-1"></i> Volver
        </button>
        <div className="alert alert-warning">
          Debes iniciar sesión para ver tu historial.
        </div>
      </div>
    );
  }

  return (
    <div className="historial-page paginaprincipal">
      <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <button className="btn btn-outline-primary" onClick={() => navigate(-1)}>
          <i className="bi bi-arrow-left me-1"></i> Volver
        </button>
        <h2 className="mb-0">Historial de {user?.nombre || "usuario"}</h2>
        <div />
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 120 }}></div>
      ) : (
        <div className="row">
          <div className="col-12 col-lg-6">
            <Section
              title="Reservas"
              emptyText="No tienes reservas registradas."
              columns={[
                { key: "fecha", label: "Fecha" },
                { key: "sector", label: "Sector" },
                { key: "estado", label: "Estado", render: (v) => renderEstado(v) },
              ]}
              rows={reservas}
            />
          </div>
          <div className="col-12 col-lg-6">
            <Section
              title="Solicitudes de proyectos"
              emptyText="No has postulado proyectos."
              columns={[
                { key: "fecha", label: "Fecha" },
                { key: "titulo", label: "Título" },
                { key: "estado", label: "Estado", render: (v) => renderEstado(v) },
              ]}
              rows={proyectos}
            />
          </div>
          <div className="col-12 col-lg-6">
            <Section
              title="Certificados"
              emptyText="No has solicitado certificados."
              columns={[
                { key: "fecha", label: "Fecha" },
                { key: "motivo", label: "Motivo" },
                { key: "estado", label: "Estado", render: (v) => renderEstado(v) },
              ]}
              rows={certificados}
            />
          </div>
          <div className="col-12 col-lg-6">
            <Section
              title="Actividades inscritas"
              emptyText="No estás inscrito en actividades."
              columns={[
                { key: "fecha", label: "Fecha" },
                { key: "titulo", label: "Actividad" },
                { key: "cupo", label: "Cupo" },
              ]}
              rows={actividades}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default HistorialPage;
