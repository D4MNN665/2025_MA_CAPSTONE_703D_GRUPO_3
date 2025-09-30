import React, { useState, useEffect } from "react";
import "../App.css";
import { Navbar, Nav, Container, Carousel, NavDropdown } from "react-bootstrap";
import RegistroVecino from "../components/registroVecino";
import LoginVecino from "../components/login";
import "bootstrap-icons/font/bootstrap-icons.css";
import axios from "axios";
import { useAuth } from "../context/auth";
import InscripcionVecinos from "./inscripcion-vecinos";
import CertificadoResidencia from "./certificados-vecinos";

const JuntaVecinosPage = () => {
  const [showRegistro, setShowRegistro] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [noticias, setNoticias] = useState([]);
  const [showInscripcion, setShowInscripcion] = useState(false);
  const [showCertificado, setshowCertificado] = useState(false);

  const { user, login, logout } = useAuth();
  const isLoggedIn = !!user;

  useEffect(() => {
    axios
      .get("http://localhost:8000/noticias")
      .then((res) => setNoticias(res.data))
      .catch((err) => console.error(err));
  }, []);

  // Estilo para deshabilitar enlaces
  const disabledStyle = { pointerEvents: "none", opacity: 0.5 };

  // Solo permite abrir el modal si el usuario está logueado y tiene id_usuario
  const handleOpenInscripcion = () => {
    if (user && user.id_usuario) {
      setShowInscripcion(true);
    } else {
      alert("Debes iniciar sesión para inscribirte como directivo.");
    }
  };

  return (
    <div className="paginaprincipal">
      <header className="header-color">
        <Navbar className="inicio-navbar shadow-sm" expand="lg">
          <Container fluid>
            <Navbar.Brand href="/" className="fw-bold">
              Junta de Vecinos - Unidad Territorial
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="navbar-nav" />
            <Navbar.Collapse id="navbar-nav">
              <Nav className="ms-5 d-flex align-items-center gap-3 flex-grow-1">
                <Nav.Link
                  className="nav-link-hover"
                  href="#inscripcion"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                  onClick={handleOpenInscripcion}
                >
                  <i className="bi bi-person-plus-fill me-2"></i>
                  Inscripción de vecinos
                </Nav.Link>
                <NavDropdown
                  title={
                    <>
                      <i className="bi bi-file-earmark-text me-2"></i>
                      Certificados
                    </>
                  }
                  id="nav-certificados-dropdown"
                  className="nav-link-hover"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                >
                  <NavDropdown.Item
                    href="#certificado-residencia"
                    onClick={(e) => {
                      e.preventDefault();
                      setshowCertificado(true);
                    }}
                  >
                    Certificado de Residencia
                  </NavDropdown.Item>
                </NavDropdown>
                <Nav.Link
                  className="nav-link-hover"
                  href="#proyectos"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                >
                  <i className="bi bi-clipboard-check me-2"></i>
                  Proyectos vecinales
                </Nav.Link>
                <Nav.Link
                  className="nav-link-hover"
                  href="#reservas"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                >
                  <i className="bi bi-calendar-check me-2"></i>
                  Reservas de espacios
                </Nav.Link>
                <Nav.Link
                  className="nav-link-hover"
                  href="#actividades"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                >
                  <i className="bi bi-people-fill me-2"></i>
                  Actividades
                </Nav.Link>
                <Nav.Link
                  className="nav-link-hover"
                  href="#contacto"
                  style={!isLoggedIn ? disabledStyle : {}}
                  disabled={!isLoggedIn}
                >
                  <i className="bi bi-envelope-fill me-2"></i>
                  Contacto
                </Nav.Link>
              </Nav>
              {/* Botones SIEMPRE dentro de Navbar.Collapse pero FUERA de Nav */}
              {!isLoggedIn && (
                <div className="d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0">
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4"
                    onClick={() => setShowRegistro(true)}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Registro
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4"
                    onClick={() => setShowLogin(true)}
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Login
                  </button>
                </div>
              )}
              {isLoggedIn && (
                <div className="d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0">
                  <button
                    type="button"
                    className="btn btn-danger rounded-pill px-4"
                    onClick={logout}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>

      {/* Modals fuera del Navbar para que siempre se monten correctamente */}
      <RegistroVecino
        show={showRegistro}
        handleClose={() => setShowRegistro(false)}
      />
      <LoginVecino
        show={showLogin}
        handleClose={() => setShowLogin(false)}
        onLogin={(userData) => {
          login(userData);
        }}
      />

      <InscripcionVecinos
        show={showInscripcion}
        handleClose={() => setShowInscripcion(false)}
        userId={user?.id_usuario}
        userRol={user?.rol}
      />

      <CertificadoResidencia
        show={showCertificado}
        handleClose={() => setshowCertificado(false)}
        rut={user?.rut}
        id_vecino={user?.id_vecino}
      />

      <main className="main-content py-5">
        <Container>
          <div className="text-center mb-5">
            <h2 className="display-4 fw-bold mb-3">
              Bienvenidos a la Junta de Vecinos
            </h2>
            <p className="lead">
              Un espacio comunitario para gestionar proyectos, actividades y
              mantenernos informados. Aquí encontrarás todos los trámites en
              línea.
            </p>
          </div>

          <div id="noticias" className="noticias mt-5">
            <h3 className="text-center mb-4">Noticias de último momento</h3>
            <Carousel className="shadow rounded">
              {noticias.length === 0 ? (
                <Carousel.Item>
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ height: "200px" }}
                  >
                    <span>No hay noticias disponibles.</span>
                  </div>
                </Carousel.Item>
              ) : (
                noticias.map((noticia, idx) => (
                  <Carousel.Item key={noticia.id_noticia || idx}>
                    {noticia.imagen ? (
                      <img
                        className="d-block w-100"
                        src={noticia.imagen}
                        alt={`imagen Noticia ${idx + 1}`}
                      />
                    ) : null}
                    <Carousel.Caption>
                      <h5>{noticia.titulo}</h5>
                      <p>{noticia.descripcion}</p>
                    </Carousel.Caption>
                  </Carousel.Item>
                ))
              )}
            </Carousel>
          </div>
        </Container>
      </main>

      <footer className="footer mt-5 py-4 bg-light">
        <Container>
          <div id="contacto" className="contacto text-center">
            <h3 className="mb-3">Datos de Contacto</h3>
            <p className="mb-2">
              <i className="bi bi-envelope me-2"></i>
              junta.vecinosxd@gmail.cl
            </p>
            <p className="mb-2">
              <i className="bi bi-telephone me-2"></i>
              +56 9 XXXX XXXX
            </p>
          </div>
          <p className="text-center text-muted mt-3">
            &copy; 2025 Junta de Vecinos - Todos los derechos reservados
          </p>
        </Container>
      </footer>
    </div>
  );
};

export default JuntaVecinosPage;
