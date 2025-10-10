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