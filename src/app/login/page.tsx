"use client";

import { useState, useEffect } from "react";
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged, signInAnonymously } from "firebase/auth";

// Asumimos que estas variables globales se proporcionan en el entorno
declare const __firebase_config: string;
declare const __initial_auth_token: string;

// Componente principal de la aplicación
export default function App() {
  const [authInstance, setAuthInstance] = useState(null);
  const [loading, setLoading] = useState(true);

  // Inicializa Firebase y autentica al usuario al cargar la app
  useEffect(() => {
    async function initializeFirebase() {
      try {
        const firebaseConfig = JSON.parse(__firebase_config);
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Listener para el estado de autenticación
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log("Usuario autenticado:", user.uid);
          } else {
            console.log("No hay usuario autenticado.");
          }
          setLoading(false);
        });

        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }

        setAuthInstance(auth);

        // Retorna la función de limpieza para el listener
        return () => unsubscribe();

      } catch (err) {
        console.error("Error al inicializar Firebase o autenticar:", err);
        setLoading(false);
      }
    }
    initializeFirebase();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <div className="text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <LoginPage auth={authInstance} />
  );
}

// Componente de la página de inicio de sesión
function LoginPage({ auth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!auth) {
      setError("Error: Firebase Auth no está disponible.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setError("");
      window.location.href = "/app";
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado durante el inicio de sesión.");
      }
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 font-sans">
      <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg transform transition-all hover:scale-105">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Iniciar Sesión</h1>
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <input
              type="email"
              placeholder=" "
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="peer w-full p-3 pt-6 font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <label
              htmlFor="email"
              className="absolute text-sm font-medium text-gray-500 transform duration-300 -translate-y-4 scale-75 top-3 left-3 origin-[0] peer-focus:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4"
            >
              Email
            </label>
          </div>
          <div className="relative">
            <input
              type="password"
              placeholder=" "
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer w-full p-3 pt-6 font-medium text-gray-900 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <label
              htmlFor="password"
              className="absolute text-sm font-medium text-gray-500 transform duration-300 -translate-y-4 scale-75 top-3 left-3 origin-[0] peer-focus:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-4"
            >
              Contraseña
            </label>
          </div>
          {error && <p className="text-red-600 text-sm font-medium mt-2">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-300 ease-in-out"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
