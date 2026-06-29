import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function LoginPage({ auth }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = await api("/api/auth/login", {
        method: "POST",
        body: { email, password }
      });
      auth.login(payload);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-lg bg-white p-6 shadow">
      <h1 className="text-2xl font-semibold">Admin Login</h1>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <input className="w-full rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="w-full rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full rounded bg-slate-900 px-3 py-2 text-white">Login</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}

