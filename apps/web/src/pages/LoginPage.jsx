import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export function LoginPage({ auth }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "register"

  // Login form state
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");

  // Registration form state
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await api("/api/auth/login", {
        method: "POST",
        body: { email, password }
      });
      auth.login(payload);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await api("/api/auth/register-company", {
        method: "POST",
        body: {
          companyName,
          name: fullName,
          email: regEmail,
          phone,
          password: regPassword
        }
      });
      auth.login(payload);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[#0A2D59] text-white font-black text-xl shadow-lg shadow-[#0A2D59]/20">
          Q
        </span>
        <h2 className="mt-4 text-center text-3xl font-black text-[#0A2D59] tracking-tight">
          EventQR Hub
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Multi-Tenant QR Event Management & Ticketing Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 animate-scale-up">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#0A2D59]" />

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200/70">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white text-[#0A2D59] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === "register"
                  ? "bg-white text-[#0A2D59] shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Register Company
            </button>
          </div>

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={handleLogin}>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors py-3 text-white font-bold text-sm shadow-md shadow-[#0A2D59]/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <span>{loading ? "Signing in..." : "Sign In to Dashboard"}</span>
                <span className="text-xs">➔</span>
              </button>
            </form>
          ) : (
            <form className="space-y-3.5" onSubmit={handleRegister}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                  placeholder="e.g. Acme Entertainment"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Owner Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                  placeholder="e.g. Sarah Connor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                    placeholder="owner@acme.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                    placeholder="+1 (555) 000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] transition-all placeholder:text-slate-400"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>

              <p className="text-[11px] text-slate-500">
                You will be registered with the <span className="font-bold text-[#0A2D59]">Owner</span> role and can create events, invite co-owners, event admins, and staff.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors py-3 text-white font-bold text-xs shadow-md shadow-[#0A2D59]/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 uppercase tracking-wider"
              >
                <span>{loading ? "Registering..." : "Create Company & Start as Owner"}</span>
                <span className="text-xs">➔</span>
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
