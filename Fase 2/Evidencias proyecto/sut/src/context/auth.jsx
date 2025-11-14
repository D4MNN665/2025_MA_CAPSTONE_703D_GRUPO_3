import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // Inicializa el usuario desde localStorage si existe
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Guarda el usuario en localStorage cuando cambia
  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  // Ejemplo de función de login
  const login = (userData) => {
    setUser(userData);
    // almacenar token separado para el cliente HTTP (si viene)
    try {
      if (userData?.access_token) {
        localStorage.setItem("access_token", userData.access_token);
      }
      if (userData?.id_uv !== undefined) {
        // guardar id_uv también para páginas que no decodifiquen el token
        localStorage.setItem("id_uv", String(userData.id_uv));
      }
    } catch (e) {
      // ignore storage errors
    }
    // localStorage se actualiza automáticamente por el useEffect
  };

  // Ejemplo de función de logout
  const logout = () => {
    setUser(null);
    // localStorage se limpia automáticamente por el useEffect
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}