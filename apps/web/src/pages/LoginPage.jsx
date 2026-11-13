import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icons.jsx";

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
    <div className="min-h-screen bg-page flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <span className="inline-flex items-center justify-center h-14 w-14 rounded-tile bg-indigo-tile text-white font-bold text-2xl shadow-soft">
          Q
        </span>
        <h2 className="mt-4 text-center text-[30px] sm:text-[34px] font-bold text-primary leading-tight">
          EventQR Hub
        </h2>
        <p className="mt-2 text-center text-[15px] text-muted font-normal">
          Multi-Tenant QR Event Management &amp; Ticketing Portal
        </p>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-lg animate-scale-up">
        <div className="ui-container overflow-hidden">
          <div className="h-2 bg-hero-gradient border-b border-theme" />

          <div className="p-6 sm:p-8">
            {/* Pill Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-full bg-primary-tint p-1.5 mb-7 border border-theme">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`min-h-[46px] px-4 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-primary-soft text-primary font-bold shadow-subtle"
                    : "text-muted hover:text-heading"
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
                className={`min-h-[46px] px-4 py-2 text-sm font-semibold rounded-full transition-all cursor-pointer ${
                  mode === "register"
                    ? "bg-primary-soft text-primary font-bold shadow-subtle"
                    : "text-muted hover:text-heading"
                }`}
              >
                Register Company
              </button>
            </div>

            {mode === "login" ? (
              <form className="space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="ui-label">Email Address</label>
                  <input
                    type="email"
                    className="ui-input"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="ui-label">Password</label>
                  <input
                    className="ui-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="ui-btn-primary w-full"
                  >
                    <span>{loading ? "Signing in..." : "Sign In to Dashboard"}</span>
                    <Icon name="arrow-right" className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div>
                  <label className="ui-label">
                    Company Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="ui-input"
                    placeholder="e.g. Acme Entertainment"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="ui-label">
                    Owner Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="ui-input"
                    placeholder="e.g. Sarah Connor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label">
                      Email <span className="text-danger">*</span>
                    </label>
                    <input
                      type="email"
                      className="ui-input"
                      placeholder="owner@acme.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="ui-label">Phone (Optional)</label>
                    <div className="relative flex items-center">
                      <span className="absolute left-3 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-tint border border-theme text-xs font-semibold text-primary pointer-events-none">
                        <Icon name="globe" className="w-3.5 h-3.5" />
                        <span>+</span>
                      </span>
                      <input
                        type="tel"
                        className="ui-input pl-16"
                        placeholder="1 (555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-1 border-t border-theme">
                  <label className="ui-label mt-3">
                    Password <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    className="ui-input"
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>

                <p className="text-[13px] text-muted leading-relaxed">
                  You will be registered with the{" "}
                  <span className="font-bold text-primary">Owner</span> role and can create events, invite co-owners, event admins, and staff.
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="ui-btn-primary w-full"
                >
                  <span>{loading ? "Registering..." : "Create Company & Start as Owner"}</span>
                  <Icon name="arrow-right" className="w-4 h-4" />
                </button>
              </form>
            )}

            {error && (
              <div className="mt-5 p-3.5 rounded-control bg-danger-tint border border-danger/25 text-sm font-semibold text-danger flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
