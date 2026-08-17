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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#0A2D59] text-white font-black text-xl shadow-lg shadow-[#0A2D59]/20">
          Q
        </span>
        <h2 className="mt-4 text-center text-3xl font-black text-[#0A2D59] tracking-tight">
          Admin Gate Control
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Secure QR Event Management & Ticketing Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 animate-scale-up">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0A2D59]" />
          
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input 
                type="email"
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400" 
                placeholder="you@domain.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="w-full rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors py-3 text-white font-bold text-sm shadow-md shadow-[#0A2D59]/20 flex items-center justify-center gap-1.5">
              <span>Sign In to Dashboard</span>
              <span className="text-xs">➔</span>
            </button>
            
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
