import { Navigate, Route, Routes } from "react-router-dom";
import { useMemo, useState } from "react";
import { LoginPage } from "./pages/LoginPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { PublicRegistrationPage } from "./pages/PublicRegistrationPage.jsx";
import { ScannerPage } from "./pages/ScannerPage.jsx";

function ProtectedRoute({ token, children }) {
  if (!token) {
    return <Navigate to="/login" replace />;
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

  return (
    <Routes>
      <Route path="/login" element={<LoginPage auth={auth} />} />
      <Route path="/register/:slug" element={<PublicRegistrationPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute token={auth.token}>
            <DashboardPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute token={auth.token}>
            <ScannerPage auth={auth} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={auth.token ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}

