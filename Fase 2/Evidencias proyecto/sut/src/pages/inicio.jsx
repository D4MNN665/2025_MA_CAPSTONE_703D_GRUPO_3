// src/pages/inicio.jsx
import React, { useEffect, useState } from "react";
import "../App.css";
import { useNavigate, Link, NavLink } from "react-router-dom";
import { Navbar, Container, Carousel, Dropdown } from "react-bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import { useAuth } from "../context/auth";
import api from "../api";
// (Modal de inscripción removido del header)
import img3Poniente from "../images/3poniente 1.jpg";
import imgFachada from "../images/fachadas-centro-de-maipu-1024x704.webp";

const JuntaVecinosPage = () => {
  const [noticias, setNoticias] = useState([]);
  const [loadingNoticias, setLoadingNoticias] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [showPerfil, setShowPerfil] = useState(false);
  const [closingPerfil, setClosingPerfil] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 576 : false);

  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isLoggedIn = !!user;

  // Navbar: sombra al scrollear
  useEffect(() => {
    const onScroll = () => {
      const nav = document.querySelector('.inicio-navbar');
      if (nav) nav.classList.toggle('scrolled', window.scrollY > 4);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const onResize = () => setIsMobile(window.innerWidth <= 576);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Noticias: si hay sesión usamos "/noticias/" (token),
  // si no, intentamos público vía "/noticias/uv/{id_uv}"
  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setLoadingNoticias(true);
      try {
        if (isLoggedIn) {
          const res = await api.get("/noticias/");
          if (!mounted) return;
          setNoticias(Array.isArray(res.data) ? res.data : []);
          return;
        }

        const storedUv = window.localStorage.getItem("id_uv");
        if (!storedUv) {
          // Sin id_uv público disponible, no cargamos noticias
          if (!mounted) return;
          setNoticias([]);
          return;
        }
        const res = await api.get(`/noticias/uv/${storedUv}`);
        if (!mounted) return;
        setNoticias(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!mounted) return;
        setNoticias([]);
      } finally {
        mounted && setLoadingNoticias(false);
      }
    };
    cargar();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  // Cargar información adicional del perfil (correo desde vecinos)
  useEffect(() => {
    let mounted = true;
    const loadPerfil = async () => {
      if (!isLoggedIn || !user?.id_vecino) {
        if (mounted) setPerfil(null);
        return;
      }
      try {
        const res = await api.get(`/vecinos/${user.id_vecino}`);
        if (!mounted) return;
        setPerfil(res.data || null);
      } catch (e) {
        if (!mounted) return;
        setPerfil(null);
      }
    };
    loadPerfil();
    return () => {
      mounted = false;
    };
  }, [isLoggedIn, user?.id_vecino]);

  // Menú superior simplificado: sin accesos duplicados

  return (
    <div className="paginaprincipal">
      {/* NAVBAR */}
      <header className="header-color">
        <Navbar className="inicio-navbar shadow-sm" expand="lg">
          <Container fluid>
            <Navbar.Brand as={Link} to="/" className="text-white fw-bold">
              <i className="bi bi-house-door-fill me-2"></i>
              Junta de Vecinos
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="navbar-nav" />
            <Navbar.Collapse id="navbar-nav" className="justify-content-end">
              {/* Menú central oculto por decisión de diseño (los accesos ya están abajo) */}

              {!isLoggedIn ? (
                <div className="d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0">
                  <button
                    type="button"
                    className="btn btn-primary rounded-pill px-4"
                    onClick={() => navigate("/registro")}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Registro
                  </button>
                  <Link
                    to="/login"
                    className="btn btn-primary rounded-pill px-4"
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Login
                  </Link>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-2 ms-lg-3 mt-3 mt-lg-0">
                  <Dropdown
                    align={isMobile ? "start" : "end"}
                    show={showPerfil}
                    onToggle={(nextShow)=>{
                    if(!nextShow){
                      // iniciar animación de salida
                      setClosingPerfil(true);
                      // esperar duración de animación antes de ocultar
                      setTimeout(()=>{
                        setShowPerfil(false);
                        setClosingPerfil(false);
                      }, 180);
                    } else {
                      setShowPerfil(true);
                    }
                    }}
                  >
                    <Dropdown.Toggle
                      id="perfil-menu"
                      className="btn btn-outline-light text-white border-0 rounded-pill px-3 d-flex align-items-center gap-2"
                    >
                      <i className="bi bi-person-circle"></i>
                      <span className="d-none d-sm-inline">{user?.nombre || "Perfil"}</span>
                    </Dropdown.Toggle>
                    {showPerfil && (
                      <Dropdown.Menu className={`p-3 profile-dropdown-menu ${closingPerfil ? 'closing' : ''}`} style={{ minWidth: 260 }}>
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-person-circle fs-3 me-2 text-primary"></i>
                        <div>
                          <div className="fw-semibold">{user?.nombre || "Usuario"}</div>
                          <div className="text-muted small">{user?.rut || "RUT no disponible"}</div>
                        </div>
                      </div>
                      <div className="small text-muted mb-2">
                        {perfil?.correo || "Correo no disponible"}
                      </div>
                      <Dropdown.Divider />
                      <Dropdown.Item onClick={() => navigate("/historial")}>Historial</Dropdown.Item>
                      <Dropdown.Item onClick={() => navigate("/inscripcion")}>Modificar perfil</Dropdown.Item>
                      <Dropdown.Item className="text-danger" onClick={() => { logout?.(); navigate("/"); }}>Cerrar sesión</Dropdown.Item>
                      </Dropdown.Menu>
                    )}
                  </Dropdown>
                </div>
              )}
            </Navbar.Collapse>
          </Container>
        </Navbar>
      </header>

      {/* CONTENIDO */}
      <main className="main-content py-5">
        <Container>

                    {/* NOTICIAS */}
          <section id="noticias" className="mt-4">
            <div className="section-title section-title--single">
              <h3 className="mb-0 text-center w-100">Noticias de último momento</h3>
            </div>

            {loadingNoticias ? (
              <div className="skeleton" aria-hidden="true" />
            ) : noticias.length === 0 ? (
              <div className="empty-box">
                <p className="mb-0 text-muted">Aún no hay noticias publicadas.</p>
              </div>
            ) : (
              <Carousel className="shadow rounded">
                {noticias.map((n, idx) => (
                  <Carousel.Item key={n.id_noticia || idx}>
                    <div style={{ minHeight: "200px" }} />
                    <Carousel.Caption>
                      <div className="mb-2">
                        <span className="noticia-chip">
                          <i className="bi bi-calendar-event" />
                          {n.fecha_publicacion?.slice(0, 10) || "Reciente"}
                        </span>
                      </div>
                      <h5
                        style={{
                          color: "#222",
                          background: "rgba(255,255,255,0.9)",
                          padding: 8,
                          borderRadius: 8,
                        }}
                      >
                        {n.titulo}
                      </h5>
                      <p
                        style={{
                          color: "#222",
                          background: "rgba(255,255,255,0.9)",
                          padding: 8,
                          borderRadius: 8,
                        }}
                      >
                        {n.contenido}
                      </p>
                    </Carousel.Caption>
                  </Carousel.Item>
                ))}
              </Carousel>
            )}
          </section>
          {/* HERO */}
          <section className="hero text-center">
            <div
              className={`hero-card mx-auto ${!isLoggedIn ? "hero-card-lg hero-card-wide" : ""}`}
              style={{ maxWidth: !isLoggedIn ? 1240 : 960 }}
            >
              {isLoggedIn ? (
                <>
                  <span className="hero-eyebrow">Plataforma comunitaria</span>
                  <h1 className="display-5">Bienvenidos a la Junta de Vecinos</h1>
                  <p className="lead mt-2">
                    Un espacio comunitario para gestionar proyectos, actividades y
                    mantenernos informados. Aquí encontrarás todos los trámites en línea.
                  </p>
                </>
              ) : (
                <div className="container-xxl px-0">
                  {/* Título y subtítulo arriba */}
                  <h1 className="display-5 mb-2">Bienvenidos y bienvenidas al portal oficial de nuestra Junta de Vecinos.</h1>
                  <p className="lead text-muted mb-3">Queremos abrirte las puertas de este espacio digital pensado especialmente para ti y para todas las familias de nuestro territorio.</p>

                  {/* Texto + fotos por debajo */}
                  <div className="row g-3 align-items-start text-start mt-1">
                    <div className="col-12 col-lg-7 hero-guest-text">
                      <p className="text-muted mb-2">
                        Aquí podrás realizar trámites de manera sencilla, como la inscripción de vecinos y la solicitud de certificados.
                      </p>
                      <p className="text-muted mb-2">
                        También podrás mantenerte informado sobre noticias, actividades y anuncios importantes de nuestra comunidad.
                      </p>
                      <p className="text-muted mb-2">
                        Este portal nace con el deseo de acercarnos más y facilitar la comunicación.
                      </p>
                      <p className="text-muted mb-2">
                        Buscamos construir un lugar donde todos nos sintamos escuchados y acompañados.
                      </p>
                      <p className="text-muted mb-2">
                        Gracias por visitarnos y ser parte activa de nuestra comunidad. Este es tu espacio… y juntos hacemos que nuestra Junta de Vecinos crezca día a día.
                      </p>
                      {/* Foto 2 justo debajo del texto */}
                      <div className="mt-3">
                        <div className="photo-slot ratio ratio-4x3 rounded-3">
                          <img src={imgFachada} alt="Centro de Maipú" className="w-100 h-100" style={{objectFit:"cover"}} />
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-lg-5">
                      <div className="welcome-photos d-grid gap-3 h-100">
                        <div className="photo-slot ratio ratio-16x9 rounded-3">
                          <img src={img3Poniente} alt="3 Poniente - Maipú" className="w-100 h-100" style={{objectFit:"cover"}} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ACCESOS RÁPIDOS O LOREM PARA INVITADOS */}
          {isLoggedIn ? (
            <section className="grid-tiles">
              <div className="row g-3">
                {[
                  [
                    "bi-person-plus",
                    "Inscripción",
                    "Únete o actualiza tus datos",
                    "/inscripcion",
                  ],
                  [
                    "bi-file-earmark-text",
                    "Certificados",
                    "Residencia y más",
                    "/certificados",
                  ],
                  [
                    "bi-clipboard-check",
                    "Proyectos",
                    "Postula y haz seguimiento",
                    "/proyectos",
                  ],
                  [
                    "bi-calendar-event",
                    "Reservas",
                    "Sede, cancha, salón",
                    "/reservas",
                  ],
                  [
                    "bi-people",
                    "Actividades",
                    "Eventos y talleres",
                    "/actividades",
                  ],
                  ["bi-envelope", "Contacto", "Escríbenos", "#contacto"],
                ].map(([icon, title, desc, href]) => (
                  <div className="col-12 col-sm-6 col-lg-4" key={href}>
                    <Link
                      className="text-decoration-none d-block"
                      to={href.startsWith("/") ? href : "#contacto"}
                    >
                      <div className="card-tile">
                        <i className={`bi ${icon}`}></i>
                        <h5 className="mt-2">{title}</h5>
                        <p className="mb-0">{desc}</p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <></>
          )}


        </Container>
      </main>

      {/* FOOTER */}
      <footer className="footer mt-5 py-4">
        <Container>

          <div id="contacto" className="contacto text-center">
            <h3 className="mb-3">Datos de Contacto</h3>
            <p className="mb-2">
              <i className="bi bi-envelope me-2"></i>
              junta.vecinos2025sut@gmail.com
            </p>
            <p className="mb-2">
              <i className="bi bi-telephone me-2"></i>
              +56 9 5199 5369
            </p>
          </div>
          <p className="text-center text-muted mt-3">
            &copy; 2025 Junta de Vecinos - Todos los derechos reservados
          </p>
        </Container>
      </footer>

      {/* Modal de inscripción eliminado del header (acceso vía página /inscripcion) */}
    </div>
  );
};

export default JuntaVecinosPage;