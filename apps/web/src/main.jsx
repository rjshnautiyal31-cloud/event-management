import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App.jsx";
import "./index.css";

// If a user accesses a direct clean URL (like /register/slug) from an email or ticket,
// redirect them to the hash route equivalent so HashRouter can render it correctly.
if (window.location.pathname.startsWith("/register/")) {
  const slug = window.location.pathname.split("/register/")[1];
  if (slug) {
    window.location.replace(`/#/register/${slug}`);
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);

