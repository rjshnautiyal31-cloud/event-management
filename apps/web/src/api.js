const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export async function api(path, { token, method = "GET", body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!formData) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth-unauthorized"));
    }
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

