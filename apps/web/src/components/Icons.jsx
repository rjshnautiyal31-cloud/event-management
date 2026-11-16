import React from "react";

export function Icon({
  name,
  className = "w-5 h-5",
  filled = false,
  strokeWidth = 1.75
}) {
  const baseProps = {
    viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: filled ? 1.5 : strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": "true"
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...baseProps}>
          <rect x="3" y="3" width="7.5" height="7.5" rx="2" fill={filled ? "currentColor" : "none"} />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill={filled ? "currentColor" : "none"} />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" fill={filled ? "currentColor" : "none"} />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill={filled ? "currentColor" : "none"} />
        </svg>
      );

    case "studio":
    case "video":
      return (
        <svg {...baseProps} fill="none">
          <rect
            x="2.5"
            y="5"
            width="14"
            height="14"
            rx="3.5"
            fill={filled ? "currentColor" : "none"}
          />
          <path
            d="M16.5 10l5-3v10l-5-3v-4z"
            fill={filled ? "currentColor" : "none"}
          />
          {filled ? (
            <polygon points="8.5,9.5 12.5,12 8.5,14.5" fill="var(--color-primary-soft)" stroke="none" />
          ) : (
            <polygon points="8.5,9.5 12.5,12 8.5,14.5" />
          )}
        </svg>
      );

    case "scanner":
    case "camera":
      return (
        <svg {...baseProps} fill="none">
          <path d="M4 8V6a2 2 0 0 1 2-2h2" />
          <path d="M16 4h2a2 2 0 0 1 2 2v2" />
          <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
          <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
          <rect
            x="7.5"
            y="7.5"
            width="9"
            height="9"
            rx="2"
            fill={filled ? "currentColor" : "none"}
          />
          {!filled && <line x1="6" y1="12" x2="18" y2="12" />}
        </svg>
      );

    case "qr":
      return (
        <svg {...baseProps} fill="none">
          <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" fill={filled ? "currentColor" : "none"} />
          <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" fill={filled ? "currentColor" : "none"} />
          <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" fill={filled ? "currentColor" : "none"} />
          <path d="M14 14h3v3h-3z" fill={filled ? "currentColor" : "none"} />
          <path d="M18 18h2.5v2.5H18z" />
          <path d="M18.5 14h2" />
          <path d="M14 19.5h2" />
        </svg>
      );

    case "users":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="9" cy="8" r="3.5" fill={filled ? "currentColor" : "none"} />
          <path
            d="M3 19.5c0-3.1 2.7-5.5 6-5.5s6 2.4 6 5.5"
            fill={filled ? "currentColor" : "none"}
          />
          <path d="M16 5a3.2 3.2 0 0 1 0 6.2" />
          <path d="M21 19.5c0-2.5-1.8-4.6-4.3-5.2" />
        </svg>
      );

    case "pin":
    case "gates":
      return (
        <svg {...baseProps} fill="none">
          <path
            d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z"
            fill={filled ? "currentColor" : "none"}
          />
          <circle
            cx="12"
            cy="10"
            r="2.4"
            fill={filled ? "var(--color-primary-soft)" : "none"}
            stroke={filled ? "var(--color-primary-soft)" : "currentColor"}
          />
        </svg>
      );

    case "calendar":
      return (
        <svg {...baseProps} fill="none">
          <rect
            x="3.5"
            y="4.5"
            width="17"
            height="16"
            rx="3"
            fill={filled ? "currentColor" : "none"}
          />
          <line x1="8" y1="2.8" x2="8" y2="6.2" />
          <line x1="16" y1="2.8" x2="16" y2="6.2" />
          <line
            x1="3.5"
            y1="9.5"
            x2="20.5"
            y2="9.5"
            stroke={filled ? "var(--color-primary-soft)" : "currentColor"}
          />
        </svg>
      );

    case "shield":
      return (
        <svg {...baseProps} fill="none">
          <path
            d="M12 3l7.5 3.2v5.3c0 4.9-3.2 8.5-7.5 9.8-4.3-1.3-7.5-4.9-7.5-9.8V6.2L12 3z"
            fill={filled ? "currentColor" : "none"}
          />
          <path
            d="M9.2 12.2l1.9 1.9 3.8-3.8"
            stroke={filled ? "var(--color-primary-soft)" : "currentColor"}
          />
        </svg>
      );

    case "settings":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );

    case "logout":
      return (
        <svg {...baseProps} fill="none">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );

    case "sparkles":
      return (
        <svg {...baseProps} fill="none">
          <path
            d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
            fill={filled ? "currentColor" : "none"}
          />
          <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
          <path d="M5 16l.7 1.6L7.3 18.3l-1.6.7L5 20.6l-.7-1.6-1.6-.7 1.6-.7L5 16z" />
        </svg>
      );

    case "music":
      return (
        <svg {...baseProps} fill="none">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" fill={filled ? "currentColor" : "none"} />
          <circle cx="18" cy="16" r="3" fill={filled ? "currentColor" : "none"} />
        </svg>
      );

    case "image":
      return (
        <svg {...baseProps} fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.6" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );

    case "book":
      return (
        <svg {...baseProps} fill="none">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );

    case "rocket":
      return (
        <svg {...baseProps} fill="none">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
          <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
      );

    case "plus":
      return (
        <svg {...baseProps} fill="none">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );

    case "arrow-left":
      return (
        <svg {...baseProps} fill="none">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      );

    case "arrow-right":
      return (
        <svg {...baseProps} fill="none">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );

    case "arrow-up-right":
      return (
        <svg {...baseProps} fill="none">
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      );

    case "chevron-left":
      return (
        <svg {...baseProps} fill="none">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );

    case "chevron-down":
      return (
        <svg {...baseProps} fill="none">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );

    case "chevron-right":
      return (
        <svg {...baseProps} fill="none">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );

    case "menu":
      return (
        <svg {...baseProps} fill="none">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      );

    case "close":
      return (
        <svg {...baseProps} fill="none">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );

    case "search":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="11" cy="11" r="7" />
          <line x1="20" y1="20" x2="16.2" y2="16.2" />
        </svg>
      );

    case "clock":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="8.5" />
          <polyline points="12 7.5 12 12 15.2 14" />
        </svg>
      );

    case "check":
      return (
        <svg {...baseProps} fill="none">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );

    case "check-circle":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.2l2.3 2.3 4.8-4.8" />
        </svg>
      );

    case "alert":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12.5" />
          <circle cx="12" cy="16" r="0.6" fill="currentColor" />
        </svg>
      );

    case "upload":
      return (
        <svg {...baseProps} fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );

    case "download":
      return (
        <svg {...baseProps} fill="none">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );

    case "link":
      return (
        <svg {...baseProps} fill="none">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );

    case "edit":
      return (
        <svg {...baseProps} fill="none">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );

    case "trash":
      return (
        <svg {...baseProps} fill="none">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );

    case "building":
      return (
        <svg {...baseProps} fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <line x1="9" y1="7" x2="10" y2="7" />
          <line x1="14" y1="7" x2="15" y2="7" />
          <line x1="9" y1="11" x2="10" y2="11" />
          <line x1="14" y1="11" x2="15" y2="11" />
          <path d="M10 21v-4h4v4" />
        </svg>
      );

    case "phone":
      return (
        <svg {...baseProps} fill="none">
          <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
          <line x1="10.5" y1="18" x2="13.5" y2="18" />
        </svg>
      );

    case "monitor":
      return (
        <svg {...baseProps} fill="none">
          <rect x="2.5" y="3.5" width="19" height="13" rx="2.5" />
          <line x1="8" y1="20.5" x2="16" y2="20.5" />
          <line x1="12" y1="16.5" x2="12" y2="20.5" />
        </svg>
      );

    case "square":
      return (
        <svg {...baseProps} fill="none">
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );

    case "star":
      return (
        <svg {...baseProps}>
          <polygon points="12 2.8 14.9 8.7 21.4 9.6 16.7 14.2 17.8 20.6 12 17.6 6.2 20.6 7.3 14.2 2.6 9.6 9.1 8.7 12 2.8" />
        </svg>
      );

    case "globe":
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18" />
        </svg>
      );

    case "eye":
      return (
        <svg {...baseProps} fill="none">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );

    case "eye-off":
      return (
        <svg {...baseProps} fill="none">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.4 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      );

    default:
      return (
        <svg {...baseProps} fill="none">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
