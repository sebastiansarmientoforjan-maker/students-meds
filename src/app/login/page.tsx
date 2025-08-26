"use client"; // Necesario para componentes que usan estado

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");      // Aquí escribes tu correo
  const [password, setPassword] = useState(""); // Aquí escribes tu contraseña
  const [error, setError] = useState("");       // Mensajes de error

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue

    try {
      await signInWithEmailAndPassword(auth, email, password); // Login real
      setError("");
      // Redirige a la página principal
      window.location.href = "/app";
    } catch (err: unknown) {
      setError(err.message); // Muestra error si algo falla
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="p-6 bg-white shadow rounded space-y-4 w-96">
        <h1 className="text-xl font-bold">Iniciar Sesión</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border p-2 rounded"
        />
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
          Entrar
        </button>
      </form>
    </div>
  );
}
