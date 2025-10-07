import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Registro from "./pages/registro";
import Dashboard from "./components/dashboard_supervisor/dashboard";
import PrivateRoute from "./context/PrivateRoute";
import JuntaVecinosPage from "./pages/inicio.jsx";
import CertificadosVecinosPage from "./pages/certificados-vecinos-page.jsx";
import ReservaEspaciosPage from "./pages/reserva_espacios.jsx";

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<JuntaVecinosPage />} />
          <Route
            path="/dashboard/*"
            element={
              <PrivateRoute allowedRoles={["admin"]}>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="/registro" element={<Registro />} />
          <Route path="/certificados" element={<CertificadosVecinosPage />} /> {/* Usa la página puente */}
          <Route path="/reservas" element={<ReservaEspaciosPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;