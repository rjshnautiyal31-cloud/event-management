import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export function Navbar({
  auth,
  activeTab,
  onSelectTab,
  onOpenCreateEvent,
  onOpenWalkIn,
  onOpenBulkImport,
  onOpenSwitcher,
  selectedEventTitle
}) {
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = auth.user?.role === "super_admin";
  const isOwner = auth.user?.role === "owner";
  const isCoOwner = auth.user?.role === "co_owner";
  const isEventAdmin = auth.user?.role === "event_admin";
  const isAdmin = isOwner || isCoOwner || isEventAdmin || isSuperAdmin || auth.user?.role === "admin";
  const canCreateEvent = isOwner || isCoOwner || isSuperAdmin;

  const handleNavTab = (tab) => {
    setHamburgerMenuOpen(false);
    if (location.pathname === "/dashboard") {
      if (onSelectTab) onSelectTab(tab);
    } else {
      navigate(`/dashboard?tab=${tab}`);
    }
  };

  return (
    <>
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setHamburgerMenuOpen(true)}
            className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A2D59] flex items-center justify-center font-black text-lg transition-all border border-slate-200/80 shadow-2xs active:scale-95 cursor-pointer"
            title="Open Main Navigation Menu"
            aria-label="Open Main Navigation Menu"
          >
            ☰
          </button>

          <Link to="/dashboard" className="flex items-center gap-2 group min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-[#0A2D59] flex items-center justify-center font-black text-white text-base shadow-sm shadow-[#0A2D59]/20 group-hover:scale-105 transition-transform">
              Q
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-black text-[#0A2D59] tracking-tight leading-none truncate">
                {auth.user?.company?.name || "EventQR Hub"}
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                {auth.user?.name} · <span className="text-[#0A2D59] font-extrabold capitalize">{auth.user?.role?.replace("_", " ")}</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links (Hidden on mobile for clean UI) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {location.pathname !== "/dashboard" && (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/80"
            >
              <span>📊</span>
              <span>Dashboard</span>
            </Link>
          )}

          {isSuperAdmin && location.pathname !== "/generator" && (
            <Link
              to="/generator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200/80"
            >
              <span>🎨 Studio</span>
            </Link>
          )}

          <Link
            to="/studio"
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              location.pathname === "/studio"
                ? "bg-[#0A2D59] text-white shadow-sm shadow-[#0A2D59]/20 ring-2 ring-[#0A2D59]/20"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
            }`}
          >
            <span>🎬</span>
            <span>AI Story Studio</span>
          </Link>

          {location.pathname !== "/scan" && (
            <Link
              to="/scan"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-[#0A2D59]/20"
            >
              <span>📷</span>
              <span>Scanner</span>
            </Link>
          )}

          {isSuperAdmin && (
            <Link
              to="/settings"
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                location.pathname === "/settings"
                  ? "bg-[#0A2D59] text-white shadow-sm shadow-[#0A2D59]/20 ring-2 ring-[#0A2D59]/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
              }`}
              title="System & Environment Settings"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </Link>
          )}

          <button
            onClick={() => auth.logout()}
            className="rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 transition-colors px-3 py-1.5 text-xs text-slate-500 font-semibold border border-slate-200 cursor-pointer"
          >
            Logout
          </button>
        </div>

        {/* Mobile Clean User Avatar Trigger */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          <button
            onClick={() => setHamburgerMenuOpen(true)}
            className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A2D59] flex items-center justify-center font-black text-xs transition-all border border-slate-200/80 shadow-2xs active:scale-95 cursor-pointer"
            title="Open Menu"
            aria-label="Open Navigation Menu"
          >
            {auth.user?.name?.charAt(0)?.toUpperCase() || "U"}
          </button>
        </div>
      </header>

      {/* 📱 Slide-Over Hamburger Drawer Navigation Menu */}
      {hamburgerMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-start animate-fade-in">
          {/* Backdrop Overlay Click to Close */}
          <div className="absolute inset-0" onClick={() => setHamburgerMenuOpen(false)} />

          {/* Drawer Content Panel */}
          <div className="relative w-full max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-right overflow-y-auto border-r border-slate-200">
            
            {/* Drawer Header Banner */}
            <div className="bg-[#0A2D59] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 text-white font-black flex items-center justify-center text-lg border border-white/20">
                  {auth.user?.name?.charAt(0) || "A"}
                </div>
                <div>
                  <h2 className="text-sm font-extrabold leading-tight text-white">{auth.user?.name}</h2>
                  <p className="text-[11px] text-slate-300 font-medium capitalize mt-0.5">
                    {auth.user?.company?.name ? `${auth.user?.company?.name} · ` : ""}{auth.user?.role?.replace("_", " ")}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setHamburgerMenuOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-sm transition-colors cursor-pointer"
                aria-label="Close Navigation Menu"
              >
                ✕
              </button>
            </div>

            {/* Navigation Drawer Body */}
            <div className="p-4 space-y-6 flex-1">
              {/* Section 1: Core Applications */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 px-2">
                  Navigation
                </p>
                <div className="space-y-1">
                  <Link
                    to="/dashboard"
                    onClick={() => setHamburgerMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === "/dashboard"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>📊</span>
                      <span>Dashboard Hub</span>
                    </span>
                    <span className="text-[10px] text-slate-400">➔</span>
                  </Link>

                  <Link
                    to="/studio"
                    onClick={() => setHamburgerMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === "/studio"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>🎬</span>
                      <span>AI Story Studio</span>
                    </span>
                    <span className="text-[10px] text-slate-400">➔</span>
                  </Link>

                  <Link
                    to="/scan"
                    onClick={() => setHamburgerMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                      location.pathname === "/scan"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>📷</span>
                      <span>Live Entrance Scanner</span>
                    </span>
                    <span className="text-[10px] text-slate-400">➔</span>
                  </Link>

                  {isSuperAdmin && (
                    <Link
                      to="/generator"
                      onClick={() => setHamburgerMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        location.pathname === "/generator"
                          ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span>🎨</span>
                        <span>QR Studio Generator</span>
                      </span>
                      <span className="text-[10px] text-slate-400">➔</span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Section 2: Event Workspaces & Tabs (Hidden on mobile when on /dashboard since bottom bar is active) */}
              <div className={location.pathname === "/dashboard" ? "hidden md:block" : ""}>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 px-2">
                  Event Workspaces
                </p>
                <div className="space-y-1">
                  <button
                    onClick={() => handleNavTab("overview")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "overview" && location.pathname === "/dashboard"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>📊</span>
                      <span>Overview Hub</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400">➔</span>
                  </button>

                  <button
                    onClick={() => handleNavTab("attendees")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "attendees" && location.pathname === "/dashboard"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>👥</span>
                      <span>Attendee Roster</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400">➔</span>
                  </button>

                  <button
                    onClick={() => handleNavTab("gates")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "gates" && location.pathname === "/dashboard"
                        ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>📍</span>
                      <span>Gates & Checkpoints</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-slate-400">➔</span>
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleNavTab("events")}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "events" && location.pathname === "/dashboard"
                            ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span>🗓️</span>
                          <span>Events Directory</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-400">➔</span>
                      </button>

                      <button
                        onClick={() => handleNavTab("team")}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeTab === "team" && location.pathname === "/dashboard"
                            ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span>🛡️</span>
                          <span>Team & Staff Access</span>
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-400">➔</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Section 3: Event Quick Actions */}
              {isAdmin && (onOpenCreateEvent || onOpenWalkIn || onOpenBulkImport) && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 px-2">
                    Event Actions
                  </p>
                  <div className="space-y-1">
                    {canCreateEvent && onOpenCreateEvent && (
                      <button
                        onClick={() => { onOpenCreateEvent(); setHamburgerMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0A2D59] bg-slate-50 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
                      >
                        <span>➕</span>
                        <span>Create New Event</span>
                      </button>
                    )}

                    {onOpenWalkIn && (
                      <button
                        onClick={() => { onOpenWalkIn(); setHamburgerMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        <span>📝</span>
                        <span>Walk-In Guest Registration</span>
                      </button>
                    )}

                    {onOpenBulkImport && (
                      <button
                        onClick={() => { onOpenBulkImport(); setHamburgerMenuOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        <span>📥</span>
                        <span>Bulk Import CSV / Excel</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Section 4: System Utilities */}
              {isSuperAdmin && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 px-2">
                    System
                  </p>
                  <div className="space-y-1">
                    <Link
                      to="/settings"
                      onClick={() => setHamburgerMenuOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        location.pathname === "/settings"
                          ? "bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span>⚙️</span>
                        <span>System Settings</span>
                      </span>
                      <span className="text-[10px] text-slate-400">➔</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Sign Out */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => { auth.logout(); setHamburgerMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200 cursor-pointer"
              >
                <span>🚪</span>
                <span>Sign Out of Account</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
