import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/auth";

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    // No autenticado
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PrivateRoute;