import { Navigate, Route, Routes } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { PublicRegistrationPage } from "./pages/PublicRegistrationPage.jsx";
import { ScannerPage } from "./pages/ScannerPage.jsx";
import { QRGeneratorPage } from "./pages/QRGeneratorPage.jsx";

function ProtectedRoute({ token, user, adminOnly = false, children }) {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  const isAdminRole = user?.role === "admin" || user?.role === "super_admin" || user?.role === "event_admin";
  if (adminOnly && !isAdminRole) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  const auth = useMemo(
    () => ({
      token,
      user,
      login(payload) {
        localStorage.setItem("token", payload.token);
        localStorage.setItem("user", JSON.stringify(payload.user));
        setToken(payload.token);
        setUser(payload.user);
      },
      logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken("");
        setUser(null);
      }
    }),
    [token, user]
  );

  useEffect(() => {
    function handleUnauthorized() {
      auth.logout();
    }
    window.addEventListener("auth-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth-unauthorized", handleUnauthorized);
  }, [auth]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage auth={auth} />} />
      <Route path="/register/:slug" element={<PublicRegistrationPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute token={auth.token} user={auth.user}>
            <DashboardPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute token={auth.token} user={auth.user}>
            <ScannerPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/generator"
        element={
          <ProtectedRoute token={auth.token} user={auth.user} adminOnly>
            <QRGeneratorPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={auth.token ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

