import React, { useState, useEffect } from "react";
import { Link, Routes, Route } from "react-router-dom";
import Vecinos from "./Requerimientos principales/vecinos";
import Certificados from "./Requerimientos principales/certificados";
import Proyectos from "./Requerimientos principales/proyectos";
import Reservas from "./Requerimientos principales/reservas";
import Noticias from "./Requerimientos principales/noticias";
import Notificaciones from "./Requerimientos principales/notificaciones";
import CertificadosDashboard from "./Requerimientos principales/certificados";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button, Card, Row, Col } from "react-bootstrap";
import "../../css dashboard/sb-admin-2.css";
import "../../css dashboard/sb-admin-2.min.css";
import axios from "axios";

function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  const [vecinos, setVecinos] = useState([]);
  const [noticias, setNoticias] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resVecinos, resNoticias, resProyectos, resReservas] = await Promise.all([
          axios.get("http://localhost:8000/vecinos"),
          axios.get("http://localhost:8000/noticias"),
          axios.get("http://localhost:8000/proyectos"),
          axios.get("http://localhost:8000/reservas"),
        ]);
        setVecinos(resVecinos.data);
        setNoticias(resNoticias.data);
        setProyectos(resProyectos.data);
        setReservas(resReservas.data);
      } catch (err) {
        console.error("Error al traer datos:", err);
      }
    };
    fetchData();
  }, []);

  return (
    <div id="page-top">
      <div id="wrapper" className={sidebarCollapsed ? "toggled" : ""}>
        {/* Sidebar */}
        <ul className="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion sidebar-centered" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <Link className="sidebar-brand d-flex align-items-center justify-content-center" to="/dashboard">
            <div className="sidebar-brand-icon rotate-n-15">
              <i className="fas fa-laugh-wink"></i>
            </div>
            <div className="sidebar-brand-text mx-3">
              Admin Dashboard <sup>APT</sup>
            </div>
          </Link>
          <hr className="sidebar-divider my-0" style={{ margin: '0.5rem 0' }} />
          <li className="nav-item active">
            <Link className="nav-link sidebar-item" to="/dashboard">
              <i className="fas fa-fw fa-tachometer-alt"></i>
              <span style={{ marginLeft: '8px' }}>Dashboard</span>
            </Link>
          </li>
          <hr className="sidebar-divider" style={{ margin: '0.5rem 0' }} />

          <div className="sidebar-heading" style={{ marginBottom: '0.5rem', marginTop: '0.5rem', textAlign: 'center' }}>Gestión</div>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/vecinos">Vecinos</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/certificados">Certificados</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/proyectos">Proyectos</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/reservas">Reservas</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/noticias">Noticias</Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link sidebar-item" to="/dashboard/notificaciones">Notificaciones</Link>
          </li>
        </ul>

        {/* Content Wrapper */}
        <div id="content-wrapper" className="d-flex flex-column">
          <div id="content">
            {/* Topbar */}
            <nav className="navbar navbar-expand navbar-light bg-white topbar mb-4 shadow">
              <button
                className="btn btn-link d-md-none rounded-circle mr-3"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <i className="fa fa-bars"></i>
              </button>
              <ul className="navbar-nav ml-auto">
                <li className="nav-item">
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowLogout(true)}
                  >
                    Salir
                  </button>
                </li>
              </ul>
            </nav>

            {/* Page Content */}
            <div className="container-fluid">
              <Routes>
                <Route
                  path="/"
                  element={
                    <div>
                      <h1 className="h3 mb-4 text-gray-800">
                        Bienvenido al panel de administración
                      </h1>
                      <h1>Resumen total</h1>
                      <Row className="mb-4">
                        <Col md={3}>
                          <Card className="shadow-sm text-center">
                            <Card.Body>
                              <h5>Usuarios</h5>
                              <h2>{vecinos.length}</h2>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="shadow-sm text-center">
                            <Card.Body>
                              <h5>Noticias</h5>
                              <h2>{noticias.length}</h2>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="shadow-sm text-center">
                            <Card.Body>
                              <h5>Proyectos</h5>
                              <h2>{proyectos.length}</h2>
                            </Card.Body>
                          </Card>
                        </Col>
                        <Col md={3}>
                          <Card className="shadow-sm text-center">
                            <Card.Body>
                              <h5>Reservas</h5>
                              <h2>{reservas.length}</h2>
                            </Card.Body>
                          </Card>
                        </Col>
                      </Row>
                      <div className="alert alert-info">
                        Usa el menú lateral para gestionar usuarios, noticias, proyectos o reservas.
                      </div>
                    </div>
                  }
                />
                <Route path="vecinos" element={<Vecinos />} />
                <Route path="certificados" element={<CertificadosDashboard />} />
                <Route path="proyectos" element={<Proyectos />} />
                <Route path="reservas" element={<Reservas />} />
                <Route path="noticias" element={<Noticias />} />
                <Route path="notificaciones" element={<Notificaciones />} />
              </Routes>
            </div>
          </div>
          {/* Footer */}
          <footer className="sticky-footer bg-white">
            <div className="container my-auto text-center">
              <span>Copyright &copy; 2025 - APT</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Logout Modal */}
      <Modal show={showLogout} onHide={() => setShowLogout(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>¿Seguro que quieres salir?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Selecciona "Salir" si deseas cerrar tu sesión actual.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLogout(false)}>
            Cancelar
          </Button>
          <Button variant="primary" href="/">
            Salir
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Dashboard;