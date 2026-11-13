import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";
import { api } from "../api.js";

export function SettingsPage({ auth }) {
  // Strict security guard: only super_admin can view or configure settings
  if (auth.user?.role !== "super_admin") {
    return <Navigate to="/dashboard" replace />;
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [connectionResult, setConnectionResult] = useState(null);

  const [categories, setCategories] = useState([]);
  const [settingsList, setSettingsList] = useState([]);
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [showSecrets, setShowSecrets] = useState({});

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all' | 'database' | 'env'

  // Fetch settings on mount
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api("/api/settings", { token: auth.token });
      setCategories(res.categories || []);
      setSettingsList(res.settings || []);

      const formInit = {};
      const origInit = {};
      for (const item of res.settings || []) {
        formInit[item.key] = item.value || "";
        origInit[item.key] = item.value || "";
      }
      setFormData(formInit);
      setOriginalData(origInit);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to load settings"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [auth.token]);

  // Track modified fields
  const modifiedCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(formData)) {
      if (formData[key] !== originalData[key]) {
        count++;
      }
    }
    return count;
  }, [formData, originalData]);

  // Handle input change
  const handleChange = (key, val) => {
    setFormData((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  // Toggle secret visibility
  const toggleShowSecret = (key) => {
    setShowSecrets((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Save modified settings to Database
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);
      setConnectionResult(null);

      // Only send keys that were modified or specifically set
      const payload = {};
      for (const [key, val] of Object.entries(formData)) {
        if (val !== originalData[key]) {
          payload[key] = val;
        }
      }

      if (Object.keys(payload).length === 0) {
        setStatusMessage({ type: "success", text: "No changes to save." });
        setSaving(false);
        return;
      }

      const res = await api("/api/settings", {
        token: auth.token,
        method: "PUT",
        body: { settings: payload }
      });

      setStatusMessage({
        type: "success",
        text: `${res.message} (${res.updatedCount} settings updated in Database). Priority is now assigned to DB values.`
      });

      // Refresh list to update source badges
      await fetchSettings();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to save settings"
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset a specific key to .env default
  const handleResetToEnv = async (key) => {
    if (
      !window.confirm(
        `Are you sure you want to remove the Database override for "${key}" and revert to the .env fallback value?`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setStatusMessage(null);
      const res = await api(`/api/settings/${encodeURIComponent(key)}`, {
        token: auth.token,
        method: "DELETE"
      });

      setStatusMessage({ type: "success", text: res.message });
      await fetchSettings();
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err.message || `Failed to reset ${key}`
      });
    } finally {
      setSaving(false);
    }
  };

  // Test Storage Connection
  const handleTestStorage = async () => {
    try {
      setTestingStorage(true);
      setConnectionResult(null);
      setStatusMessage(null);

      const res = await api("/api/settings/test-connection", {
        token: auth.token,
        method: "POST",
        body: { type: "storage" }
      });

      setConnectionResult({
        type: "storage",
        success: true,
        message: res.message,
        details: `Active Provider: ${res.provider?.toUpperCase()} | Test File URL: ${res.testUrl}`
      });
    } catch (err) {
      setConnectionResult({
        type: "storage",
        success: false,
        message: err.message || "Storage connection test failed"
      });
    } finally {
      setTestingStorage(false);
    }
  };

  // Test AI Connection
  const handleTestAi = async () => {
    try {
      setTestingAi(true);
      setConnectionResult(null);
      setStatusMessage(null);

      const res = await api("/api/settings/test-connection", {
        token: auth.token,
        method: "POST",
        body: { type: "ai" }
      });

      setConnectionResult({
        type: "ai",
        success: true,
        message: res.message,
        details: `LLM Provider: ${res.llmProvider} | Project: ${res.project}`
      });
    } catch (err) {
      setConnectionResult({
        type: "ai",
        success: false,
        message: err.message || "AI credentials test failed"
      });
    } finally {
      setTestingAi(false);
    }
  };

  // Filter settings
  const filteredSettings = useMemo(() => {
    return settingsList.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      if (sourceFilter === "database" && item.source !== "database") {
        return false;
      }
      if (sourceFilter === "env" && item.source !== "env") {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesKey = item.key.toLowerCase().includes(q);
        const matchesLabel = item.label.toLowerCase().includes(q);
        const matchesDesc = (item.description || "").toLowerCase().includes(q);
        if (!matchesKey && !matchesLabel && !matchesDesc) return false;
      }
      return true;
    });
  }, [settingsList, selectedCategory, sourceFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let dbCount = 0;
    let envCount = 0;
    let defaultCount = 0;
    for (const item of settingsList) {
      if (item.source === "database") dbCount++;
      else if (item.source === "env") envCount++;
      else defaultCount++;
    }
    return { dbCount, envCount, defaultCount, total: settingsList.length };
  }, [settingsList]);

  const dbPct = stats.total > 0 ? Math.round((stats.dbCount / stats.total) * 100) : 0;
  const envPct = stats.total > 0 ? Math.round((stats.envCount / stats.total) * 100) : 0;

  return (
    <AppShell auth={auth} pageTitle="System Settings">
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 space-y-6 animate-fade-in">
        {/* Summary Card (2px Indigo Border + Primary-Tint Background + Progress Legend) */}
        <div className="rounded-container border-2 border-primary bg-primary-tint p-6 sm:p-8 shadow-soft space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary-soft border border-pastel-lavender text-primary text-xs font-bold">
                <Icon name="settings" className="w-3.5 h-3.5" />
                <span>System Configuration • Dual-Tier Engine</span>
              </div>
              <h1 className="text-[28px] sm:text-[32px] font-bold text-primary leading-tight">
                Environment &amp; System Settings
              </h1>
              <p className="text-sm text-body max-w-2xl leading-relaxed">
                Manage cloud providers, AI models, Google Cloud Storage (GCS) credentials, and API parameters.{" "}
                <strong className="text-heading font-semibold">
                  Settings stored in the Database take 1st Priority
                </strong>{" "}
                over local{" "}
                <code className="bg-surface px-1.5 py-0.5 rounded-md border border-theme text-xs text-primary font-mono">
                  .env
                </code>{" "}
                fallback values.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleTestStorage}
                disabled={testingStorage || loading}
                className="ui-btn-secondary-sm"
              >
                <Icon name="globe" className="w-4 h-4 text-primary" />
                <span>
                  {testingStorage ? "Testing Storage..." : "Test Storage"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleTestAi}
                disabled={testingAi || loading}
                className="ui-btn-secondary-sm"
              >
                <Icon name="sparkles" className="w-4 h-4 text-primary" />
                <span>{testingAi ? "Testing AI..." : "Test AI Keys"}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || modifiedCount === 0}
                className="ui-btn-primary-sm"
              >
                <Icon name="check" className="w-4 h-4" />
                <span>
                  {saving
                    ? "Saving..."
                    : `Save Changes ${modifiedCount > 0 ? `(${modifiedCount})` : ""}`}
                </span>
              </button>
            </div>
          </div>

          {/* Rounded Progress Bar + Legend */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted font-medium">
                Active Configuration Coverage
              </span>
              <span className="font-bold text-heading">
                {stats.dbCount + stats.envCount} / {stats.total} Configured
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full bg-surface border border-theme overflow-hidden flex">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${dbPct}%` }}
                title={`Database (BO): ${stats.dbCount}`}
              />
              <div
                className="h-full bg-accent-violet transition-all duration-500"
                style={{ width: `${envPct}%` }}
                title={`.env Fallbacks: ${stats.envCount}`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-5 text-xs text-body pt-0.5">
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                <span>Database (BO) Override ({stats.dbCount})</span>
              </span>
              <span className="inline-flex items-center gap-2 font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-accent-violet" />
                <span>.env Fallback ({stats.envCount})</span>
              </span>
              <span className="inline-flex items-center gap-2 text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-surface border border-theme" />
                <span>Default / Unset ({stats.defaultCount})</span>
              </span>
            </div>
          </div>

          {/* 4 Stat Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
            <div className="bg-surface rounded-[18px] p-4 border border-theme">
              <span className="text-xs font-semibold text-muted">
                Total Settings
              </span>
              <p className="text-2xl font-bold text-primary mt-1">
                {stats.total}
              </p>
            </div>
            <div className="bg-pastel-mint/70 rounded-[18px] p-4 border border-theme">
              <span className="text-xs font-semibold text-heading flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span>Database (BO)</span>
              </span>
              <p className="text-2xl font-bold text-heading mt-1">
                {stats.dbCount}{" "}
                <span className="text-xs font-medium text-muted">
                  1st Priority
                </span>
              </p>
            </div>
            <div className="bg-pastel-peach/65 rounded-[18px] p-4 border border-theme">
              <span className="text-xs font-semibold text-heading flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span>.env Fallbacks</span>
              </span>
              <p className="text-2xl font-bold text-heading mt-1">
                {stats.envCount}{" "}
                <span className="text-xs font-medium text-muted">
                  2nd Priority
                </span>
              </p>
            </div>
            <div className="bg-surface rounded-[18px] p-4 border border-theme">
              <span className="text-xs font-semibold text-muted">
                Default / Unset
              </span>
              <p className="text-2xl font-bold text-body mt-1">
                {stats.defaultCount}
              </p>
            </div>
          </div>
        </div>

        {/* Status & Diagnostics Banners */}
        {statusMessage && (
          <div
            className={`p-4 rounded-card text-sm font-semibold flex items-center justify-between border ${
              statusMessage.type === "success"
                ? "bg-success-tint text-heading border-success/35"
                : "bg-danger-tint text-danger border-danger/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                name={statusMessage.type === "success" ? "check-circle" : "alert"}
                className={`w-5 h-5 shrink-0 ${
                  statusMessage.type === "success" ? "text-success" : "text-danger"
                }`}
              />
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="h-9 w-9 rounded-full hover:bg-surface/60 flex items-center justify-center text-muted hover:text-heading cursor-pointer"
              aria-label="Dismiss status message"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        )}

        {connectionResult && (
          <div
            className={`p-5 rounded-card text-sm border ${
              connectionResult.success
                ? "bg-primary-soft/70 text-heading border-pastel-lavender"
                : "bg-danger-tint text-danger border-danger/30"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Icon
                  name={connectionResult.success ? "check-circle" : "alert"}
                  className={`w-5 h-5 shrink-0 ${
                    connectionResult.success ? "text-primary" : "text-danger"
                  }`}
                />
                <span className="font-bold">{connectionResult.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setConnectionResult(null)}
                className="h-9 w-9 rounded-full hover:bg-surface/60 flex items-center justify-center text-muted hover:text-heading cursor-pointer"
                aria-label="Dismiss connection test result"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            {connectionResult.details && (
              <p className="mt-2 text-xs text-primary font-mono break-all bg-surface/80 px-3 py-2 rounded-tile border border-theme">
                {connectionResult.details}
              </p>
            )}
          </div>
        )}

        {/* Priority Resolution Details Card (24px white card, 2-col muted label / bold value grid) */}
        <div className="ui-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-theme">
            <h2 className="text-lg font-bold text-heading">
              Priority Resolution Hierarchy
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-chip bg-pastel-mint border-theme text-heading">
                <span className="h-2 w-2 rounded-full bg-success" />
                <span>Database Override</span>
              </span>
              <span className="ui-chip bg-pastel-peach border-theme text-heading">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <span>.env Fallback</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3.5 rounded-[16px] bg-primary-tint/70 border border-theme">
              <p className="text-xs text-muted font-medium">1st Priority</p>
              <p className="font-bold text-heading mt-0.5">Database (BO)</p>
              <p className="text-xs text-body mt-1">
                Values saved here in the Back Office override everything.
              </p>
            </div>
            <div className="p-3.5 rounded-[16px] bg-primary-tint/70 border border-theme">
              <p className="text-xs text-muted font-medium">2nd Priority</p>
              <p className="font-bold text-heading mt-0.5">Local .env</p>
              <p className="text-xs text-body mt-1">
                Used automatically when a variable is not overridden in the database.
              </p>
            </div>
            <div className="p-3.5 rounded-[16px] bg-primary-tint/70 border border-theme">
              <p className="text-xs text-muted font-medium">3rd Priority</p>
              <p className="font-bold text-heading mt-0.5">Built-in Default</p>
              <p className="text-xs text-body mt-1">
                Used when neither Database nor .env specifies a value.
              </p>
            </div>
          </div>
        </div>

        {/* Category Tabs + Search & Source Filter */}
        <div className="ui-card p-5 space-y-4">
          <div className="ui-tabs-bar" role="tablist" aria-label="Settings Categories">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`ui-tab ${
                    active ? "ui-tab-active" : "ui-tab-inactive"
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                <Icon name="search" className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search settings by key, label, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ui-input pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-primary-tint flex items-center justify-center text-muted hover:text-heading cursor-pointer"
                  aria-label="Clear search"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="ui-select sm:w-60"
              aria-label="Filter by setting source"
            >
              <option value="all">All Sources</option>
              <option value="database">Database (BO) Only</option>
              <option value="env">.env Fallback Only</option>
            </select>
          </div>
        </div>

        {/* Settings Grid / Cards */}
        {loading ? (
          <div className="ui-card p-12 text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center animate-pulse">
              <Icon name="settings" className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-heading">
              Loading system settings...
            </p>
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="ui-card p-12 text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary-tint text-primary flex items-center justify-center">
              <Icon name="search" className="w-6 h-6" />
            </div>
            <p className="text-base font-bold text-heading">
              No settings found matching your filters
            </p>
            <p className="text-sm text-muted">
              Try clearing your search query or selecting a different category.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSettings.map((item) => {
                const isModified = formData[item.key] !== originalData[item.key];
                const isSecretVisible = showSecrets[item.key];

                return (
                  <div
                    key={item.key}
                    className={`rounded-card bg-surface p-6 transition-all relative ${
                      isModified
                        ? "border-2 border-primary shadow-soft bg-primary-tint/30"
                        : "border border-theme shadow-subtle hover:border-primary/35"
                    }`}
                  >
                    {/* Header: Label + Badges */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="text-base font-bold text-heading leading-snug">
                            {item.label}
                          </label>
                          {isModified && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-soft text-primary border border-pastel-lavender">
                              Modified
                            </span>
                          )}
                        </div>
                        <code className="text-xs font-mono text-primary font-semibold block mt-1 truncate">
                          {item.key}
                        </code>
                      </div>

                      {/* Source Badge */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {item.source === "database" ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-pastel-mint text-heading border border-theme"
                            title="Active value is configured in Database (1st Priority)"
                          >
                            <span className="h-2 w-2 rounded-full bg-success" />
                            <span>Database (BO)</span>
                          </span>
                        ) : item.source === "env" ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-pastel-peach text-heading border border-theme"
                            title="Falling back to environment variable (.env)"
                          >
                            <span className="h-2 w-2 rounded-full bg-warning" />
                            <span>.env Fallback</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary-tint text-muted border border-theme"
                            title="Using default or unconfigured value"
                          >
                            Default / Unset
                          </span>
                        )}

                        {item.hasDbValue && (
                          <button
                            type="button"
                            onClick={() => handleResetToEnv(item.key)}
                            className="text-xs text-muted hover:text-danger underline cursor-pointer"
                            title="Remove Database override and revert to .env fallback"
                          >
                            Reset to .env
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-[13px] text-muted mb-4 min-h-[36px] leading-relaxed">
                      {item.description}
                    </p>

                    {/* Control Input */}
                    <div className="relative">
                      {item.type === "select" ? (
                        <select
                          value={formData[item.key] || ""}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="ui-select"
                        >
                          {item.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : item.isSecret ? (
                        <div className="relative">
                          <input
                            type={isSecretVisible ? "text" : "password"}
                            value={formData[item.key] || ""}
                            onChange={(e) =>
                              handleChange(item.key, e.target.value)
                            }
                            placeholder={
                              item.isConfigured
                                ? "•••••••• (Configured)"
                                : "Enter secret key..."
                            }
                            className="ui-input font-mono pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret(item.key)}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-11 w-11 rounded-tile hover:bg-primary-tint text-primary flex items-center justify-center cursor-pointer"
                            title={isSecretVisible ? "Hide Secret" : "Show Secret"}
                            aria-label={
                              isSecretVisible ? "Hide Secret" : "Show Secret"
                            }
                          >
                            <Icon
                              name={isSecretVisible ? "eye-off" : "eye"}
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                      ) : (
                        <input
                          type={item.type === "number" ? "number" : "text"}
                          value={formData[item.key] || ""}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          placeholder={`Default: ${item.defaultValue || "empty"}`}
                          className="ui-input"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Save Bar */}
            {modifiedCount > 0 && (
              <div className="sticky bottom-4 z-20 bg-primary text-white p-4 sm:p-5 rounded-card shadow-soft flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-tile bg-white/15 flex items-center justify-center font-bold text-base shrink-0">
                    {modifiedCount}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight text-white">
                      Unsaved Settings Changes
                    </p>
                    <p className="text-xs text-primary-soft/90 mt-0.5">
                      You have {modifiedCount} modified setting
                      {modifiedCount > 1 ? "s" : ""}. Click Save to apply to Database.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...originalData })}
                    className="min-h-[44px] px-4 py-2 rounded-control text-sm font-semibold text-primary-soft hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[44px] px-5 py-2 rounded-control text-sm font-bold bg-surface text-primary hover:bg-primary-soft transition-all cursor-pointer"
                  >
                    {saving ? "Saving..." : "Save Settings to DB"}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </main>
    </AppShell>
  );
}
