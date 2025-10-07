import React from "react";
import { useAuth } from "../context/auth";
import CertificadoResidencia from "./certificados-vecinos";

const CertificadosVecinosPage = () => {
  const { user } = useAuth();

  if (!user) {
    return <div>Debes iniciar sesión para solicitar el certificado.</div>;
  }

  return (
    <CertificadoResidencia rut={user.rut} id_vecino={user.id_vecino} />
  );
};

export default CertificadosVecinosPage;