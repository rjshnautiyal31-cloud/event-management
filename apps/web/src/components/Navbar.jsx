import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "./Icons.jsx";

export function AppShell({
  auth,
  pageTitle = "EventQR Hub",
  activeTab,
  onSelectTab,
  onOpenCreateEvent,
  onOpenWalkIn,
  onOpenBulkImport,
  onOpenSwitcher,
  selectedEventTitle,
  companies = [],
  selectedCompanyId = "all",
  onSelectCompany = null,
  headerActions = null,
  children
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isSuperAdmin = auth?.user?.role === "super_admin";
  const isOwner = auth?.user?.role === "owner";
  const isCoOwner = auth?.user?.role === "co_owner";
  const isEventAdmin = auth?.user?.role === "event_admin";
  const isAdmin =
    isOwner ||
    isCoOwner ||
    isEventAdmin ||
    isSuperAdmin ||
    auth?.user?.role === "admin";
  const canCreateEvent = isOwner || isCoOwner || isSuperAdmin;

  const currentSelectedCompany =
    isSuperAdmin && selectedCompanyId !== "all"
      ? companies.find((c) => c._id === selectedCompanyId)
      : null;

  const workspaceDisplayName = currentSelectedCompany
    ? currentSelectedCompany.name
    : auth?.user?.company?.name || "EventQR Hub";

  const workspaceInitial = (
    workspaceDisplayName?.charAt(0) ||
    auth?.user?.name?.charAt(0) ||
    "E"
  ).toUpperCase();

  const roleDisplay = auth?.user?.role
    ? auth.user.role.replace(/_/g, " ")
    : "Member";

  const handleNavTab = (tab) => {
    setDrawerOpen(false);
    if (location.pathname === "/dashboard" && onSelectTab) {
      onSelectTab(tab);
    } else {
      navigate(`/dashboard?tab=${tab}`);
    }
  };

  const primaryNavItems = [
    {
      key: "dashboard",
      label: "Dashboard Hub",
      to: "/dashboard",
      icon: "dashboard",
      isActive: location.pathname === "/dashboard"
    },
    {
      key: "studio",
      label: "AI Story Studio",
      to: "/studio",
      icon: "studio",
      isActive: location.pathname === "/studio"
    },
    ...(isAdmin
      ? [
          {
            key: "ads",
            label: "AI Ad Studio",
            to: "/ads",
            icon: "rocket",
            isActive: location.pathname === "/ads"
          }
        ]
      : []),
    {
      key: "scan",
      label: "Entrance Scanner",
      to: "/scan",
      icon: "scanner",
      isActive: location.pathname === "/scan"
    },
    ...(isAdmin
      ? [
          {
            key: "generator",
            label: "QR Studio",
            to: "/generator",
            icon: "qr",
            isActive: location.pathname === "/generator"
          }
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            key: "settings",
            label: "System Settings",
            to: "/settings",
            icon: "settings",
            isActive: location.pathname === "/settings"
          }
        ]
      : [])
  ];

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-surface px-4 py-5 select-none">
      {/* 1. Brand Logo + Mobile Rounded-Square Close Button */}
      <div className="flex items-center justify-between gap-3 px-1 mb-5">
        <Link
          to="/dashboard"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 min-w-0 group"
        >
          <div className="h-10 w-10 shrink-0 rounded-tile bg-indigo-tile text-white font-bold text-lg flex items-center justify-center shadow-subtle group-hover:scale-[1.03] transition-transform">
            Q
          </div>
          <div className="min-w-0">
            <span className="block text-[17px] font-bold text-primary leading-tight truncate">
              EventQR Hub
            </span>
            <span className="block text-xs text-muted font-medium truncate">
              AI Video &amp; Pass Studio
            </span>
          </div>
        </Link>

        {isMobile && (
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="h-11 w-11 shrink-0 rounded-tile bg-primary-tint hover:bg-primary-soft border border-theme text-heading flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close Navigation Menu"
          >
            <Icon name="close" className="w-5 h-5 text-primary" />
          </button>
        )}
      </div>

      {/* 2. Workspace / Account Selector Card */}
      <div className="mb-5 space-y-2">
        <button
          type="button"
          onClick={() => {
            if (onOpenSwitcher) {
              setDrawerOpen(false);
              onOpenSwitcher();
            } else {
              setDrawerOpen(false);
              navigate("/dashboard");
            }
          }}
          className="w-full rounded-[18px] bg-primary-tint hover:bg-primary-soft/70 border border-theme p-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
          title={onOpenSwitcher ? "Switch active event workspace (⌘K)" : "Workspace overview"}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-tile bg-indigo-tile text-white font-bold text-base flex items-center justify-center shadow-subtle">
              {workspaceInitial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-heading truncate">
                {workspaceDisplayName}
              </p>
              <p className="text-xs text-muted truncate">
                {auth?.user?.name || "Account"} · <span className="capitalize">{roleDisplay}</span>
              </p>
            </div>
          </div>
          <Icon name="chevron-down" className="w-4 h-4 text-primary shrink-0" />
        </button>

        {/* Super Admin Organization Filter inside Workspace Selector */}
        {isSuperAdmin && companies.length > 0 && onSelectCompany && (
          <div className="rounded-[16px] bg-primary-tint/70 border border-theme px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                Organization Scope
              </span>
              {selectedCompanyId !== "all" && (
                <button
                  type="button"
                  onClick={() => onSelectCompany("all")}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <select
              value={selectedCompanyId || "all"}
              onChange={(e) => onSelectCompany(e.target.value)}
              className="w-full min-h-[38px] bg-surface border border-theme rounded-tile px-2.5 py-1 text-xs font-semibold text-heading focus:outline-none focus:border-primary cursor-pointer"
              aria-label="Select Organization Scope"
            >
              <option value="all">All Organizations ({companies.length})</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.eventCount || 0} events)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 3. Pill-Style Top-Level Navigation List (56px rows) */}
      <nav className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 scrollbar-none" aria-label="Main Navigation">
        {primaryNavItems.map((item) => {
          const active = item.isActive;
          return (
            <Link
              key={item.key}
              to={item.to}
              onClick={() => setDrawerOpen(false)}
              className={`min-h-[56px] px-3 py-2 rounded-full flex items-center gap-3.5 text-[16px] transition-all ${
                active
                  ? "bg-primary-soft text-primary font-bold"
                  : "text-heading font-medium hover:bg-primary-tint"
              }`}
            >
              <span
                className={`h-9 w-9 shrink-0 rounded-tile flex items-center justify-center transition-colors ${
                  active
                    ? "bg-pastel-lavender text-primary"
                    : "bg-transparent text-primary"
                }`}
              >
                <Icon name={item.icon} className="w-5 h-5" filled={active} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 4. Active Workspace / Studio Status Card (24px radius, primary-tint, lavender border) */}
      <div className="mt-4 rounded-card bg-primary-tint border border-pastel-lavender p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />
            <span className="text-sm font-bold text-heading truncate">
              Live Studio
            </span>
          </div>
          <Link
            to={
              location.pathname === "/studio" || location.pathname === "/ads"
                ? "/scan"
                : "/studio"
            }
            onClick={() => setDrawerOpen(false)}
            className="px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-dark text-white text-xs font-semibold transition-colors shrink-0"
          >
            {location.pathname === "/studio" || location.pathname === "/ads"
              ? "Scanner"
              : "Open AI"}
          </Link>
        </div>

        <div className="space-y-1.5 text-[13px] pt-1 border-t border-theme/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">Access Role</span>
            <span className="font-bold text-heading capitalize truncate">
              {roleDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted shrink-0">Active Event</span>
            <span className="font-bold text-heading truncate max-w-[130px]" title={selectedEventTitle || workspaceDisplayName}>
              {selectedEventTitle || workspaceDisplayName}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Bottom Circular Action Row (Settings / Studio, Scanner, Log out) */}
      <div className="mt-4 pt-4 border-t border-theme grid grid-cols-3 gap-2">
        {isSuperAdmin ? (
          <Link
            to="/settings"
            onClick={() => setDrawerOpen(false)}
            className="flex flex-col items-center gap-1.5 group"
            title="System Settings"
          >
            <span
              className={`h-14 w-14 rounded-full border flex items-center justify-center transition-all ${
                location.pathname === "/settings"
                  ? "bg-primary-soft border-primary text-primary"
                  : "bg-surface border-theme text-primary group-hover:bg-primary-tint group-hover:border-primary/40"
              }`}
            >
              <Icon name="settings" className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium text-body group-hover:text-heading">
              Settings
            </span>
          </Link>
        ) : (
          <Link
            to="/studio"
            onClick={() => setDrawerOpen(false)}
            className="flex flex-col items-center gap-1.5 group"
            title="AI Story Studio"
          >
            <span
              className={`h-14 w-14 rounded-full border flex items-center justify-center transition-all ${
                location.pathname === "/studio"
                  ? "bg-primary-soft border-primary text-primary"
                  : "bg-surface border-theme text-primary group-hover:bg-primary-tint group-hover:border-primary/40"
              }`}
            >
              <Icon name="sparkles" className="w-5 h-5" />
            </span>
            <span className="text-xs font-medium text-body group-hover:text-heading">
              Studio
            </span>
          </Link>
        )}

        <Link
          to="/scan"
          onClick={() => setDrawerOpen(false)}
          className="flex flex-col items-center gap-1.5 group"
          title="Entrance Scanner"
        >
          <span
            className={`h-14 w-14 rounded-full border flex items-center justify-center transition-all ${
              location.pathname === "/scan"
                ? "bg-primary-soft border-primary text-primary"
                : "bg-surface border-theme text-primary group-hover:bg-primary-tint group-hover:border-primary/40"
            }`}
          >
            <Icon name="scanner" className="w-5 h-5" />
          </span>
          <span className="text-xs font-medium text-body group-hover:text-heading">
            Scanner
          </span>
        </Link>

        <button
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            auth?.logout();
          }}
          className="flex flex-col items-center gap-1.5 group cursor-pointer"
          title="Log out"
        >
          <span className="h-14 w-14 rounded-full bg-danger-tint hover:bg-danger/15 border border-danger/35 text-danger flex items-center justify-center transition-all">
            <Icon name="logout" className="w-5 h-5" />
          </span>
          <span className="text-xs font-semibold text-danger">
            Log out
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-page text-body font-sans">
      {/* Desktop Fixed Left Sidebar (280px) */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[280px] border-r border-theme bg-surface">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Sticky White Top Bar (Hamburger + Bold Indigo Page Title) */}
      <header className="lg:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-theme px-4 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-11 w-11 shrink-0 rounded-tile bg-primary-tint hover:bg-primary-soft border border-theme text-primary flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Open Main Navigation Menu"
          >
            <Icon name="menu" className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-primary truncate">
            {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {headerActions}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="h-10 w-10 rounded-full bg-primary-soft border border-pastel-lavender text-primary font-bold text-sm flex items-center justify-center cursor-pointer"
            aria-label="Open Account Menu"
          >
            {auth?.user?.name?.charAt(0)?.toUpperCase() || "U"}
          </button>
        </div>
      </header>

      {/* Mobile Slide-In Drawer (~75% width, max 320px) over Dimmed Overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-start animate-fade-in">
          <div
            className="fixed inset-0 bg-heading/45 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[76vw] max-w-[320px] h-full bg-surface border-r border-theme shadow-soft animate-slide-right overflow-y-auto">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-[280px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}

// Backwards-compatible Navbar export if referenced directly
export function Navbar(props) {
  return <AppShell {...props} />;
}
