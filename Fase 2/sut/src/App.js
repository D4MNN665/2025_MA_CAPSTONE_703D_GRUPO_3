import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./components/dashboard_supervisor/dashboard";
import PrivateRoute from "./context/PrivateRoute";
import JuntaVecinosPage from "./pages/inicio.jsx";

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
        </Routes>
      </div>
    </Router>
  );
}

export default App;