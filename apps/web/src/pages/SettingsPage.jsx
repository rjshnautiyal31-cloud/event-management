import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "../components/Navbar.jsx";
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
      setStatusMessage({ type: "error", text: err.message || "Failed to load settings" });
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
      setStatusMessage({ type: "error", text: err.message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  // Reset a specific key to .env default
  const handleResetToEnv = async (key) => {
    if (!window.confirm(`Are you sure you want to remove the Database override for "${key}" and revert to the .env fallback value?`)) {
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
      setStatusMessage({ type: "error", text: err.message || `Failed to reset ${key}` });
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
      // Category filter
      if (selectedCategory !== "all" && item.category !== selectedCategory) {
        return false;
      }
      // Source filter
      if (sourceFilter === "database" && item.source !== "database") {
        return false;
      }
      if (sourceFilter === "env" && item.source !== "env") {
        return false;
      }
      // Search filter
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <Navbar auth={auth} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {/* Header Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#0A2D59]/5 to-transparent rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A2D59]/10 text-[#0A2D59] text-xs font-bold mb-2">
                <span>⚙️ System Configuration</span>
                <span>•</span>
                <span>Dual-Tier Engine</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0A2D59] tracking-tight">
                Environment & System Settings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-2xl mt-1.5">
                Manage cloud providers, AI models, S3/R2/GCS storage credentials, and API parameters.
                <strong className="text-slate-700 ml-1">Settings stored in the Database take 1st Priority</strong> over local <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-[#0A2D59]">.env</code> fallback values.
              </p>
            </div>

            {/* Test Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTestStorage}
                disabled={testingStorage || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{testingStorage ? "⏳" : "☁️"}</span>
                <span>{testingStorage ? "Testing Storage..." : "Test Storage"}</span>
              </button>

              <button
                type="button"
                onClick={handleTestAi}
                disabled={testingAi || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>{testingAi ? "⏳" : "🤖"}</span>
                <span>{testingAi ? "Testing AI..." : "Test AI Keys"}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || modifiedCount === 0}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                  modifiedCount > 0
                    ? "bg-[#0A2D59] hover:bg-[#082247] shadow-[#0A2D59]/20 cursor-pointer active:scale-95"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"
                }`}
              >
                <span>{saving ? "⏳" : "💾"}</span>
                <span>{saving ? "Saving..." : `Save Changes ${modifiedCount > 0 ? `(${modifiedCount})` : ""}`}</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Settings</span>
              <p className="text-xl font-black text-[#0A2D59] mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Database (BO) Active
              </span>
              <p className="text-xl font-black text-emerald-800 mt-0.5">{stats.dbCount} <span className="text-xs font-normal text-emerald-600">1st Priority</span></p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                .env Fallbacks Active
              </span>
              <p className="text-xl font-black text-amber-800 mt-0.5">{stats.envCount} <span className="text-xs font-normal text-amber-600">2nd Priority</span></p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Default / Unset</span>
              <p className="text-xl font-black text-slate-600 mt-0.5">{stats.defaultCount}</p>
            </div>
          </div>
        </div>

        {/* Status & Diagnostics Banners */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{statusMessage.type === "success" ? "✅" : "❌"}</span>
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {connectionResult && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold border ${
              connectionResult.success
                ? "bg-blue-50 text-blue-900 border-blue-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{connectionResult.success ? "🎉" : "⚠️"}</span>
                <span className="font-bold">{connectionResult.message}</span>
              </div>
              <button
                onClick={() => setConnectionResult(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {connectionResult.details && (
              <p className="mt-1 text-[11px] text-blue-700 font-mono break-all">
                {connectionResult.details}
              </p>
            )}
          </div>
        )}

        {/* Priority Explanation Callout */}
        <div className="bg-gradient-to-r from-[#0A2D59]/5 via-white to-[#0A2D59]/5 rounded-xl p-4 border border-[#0A2D59]/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">💡</span>
            <div>
              <p className="font-bold text-[#0A2D59]">Priority Resolution Hierarchy</p>
              <p className="text-slate-600 text-[11px] mt-0.5">
                <strong>1. Database (BO):</strong> Values saved here in the Back Office override everything.<br />
                <strong>2. Local .env:</strong> If a variable is not defined in the database, the server uses its <code className="bg-slate-100 px-1 rounded">.env</code> variable.<br />
                <strong>3. Built-in Default:</strong> Used if neither Database nor <code className="bg-slate-100 px-1 rounded">.env</code> is specified.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
              🟢 Database Override
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
              🟡 .env Fallback
            </span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#0A2D59] text-white shadow-2xs shadow-[#0A2D59]/20"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Search & Source Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative flex-1 md:w-56">
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
              />
              <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20"
            >
              <option value="all">All Sources</option>
              <option value="database">🟢 Database (BO) Only</option>
              <option value="env">🟡 .env Fallback Only</option>
            </select>
          </div>
        </div>

        {/* Settings Grid / Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
            <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
            <p className="text-xs font-bold text-slate-600">Loading system settings...</p>
          </div>
        ) : filteredSettings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm font-bold text-slate-700">No settings found matching your filters</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing your search query or selecting a different category.</p>
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
                    className={`bg-white rounded-xl p-5 border transition-all relative ${
                      isModified
                        ? "border-[#0A2D59] ring-2 ring-[#0A2D59]/10 shadow-xs"
                        : "border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    {/* Header: Label + Badges */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{item.label}</h3>
                          {isModified && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700">
                              Modified
                            </span>
                          )}
                        </div>
                        <code className="text-[11px] font-mono text-[#0A2D59] font-bold block mt-0.5">
                          {item.key}
                        </code>
                      </div>

                      {/* Source Badge */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {item.source === "database" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200" title="Active value is configured in Database (1st Priority)">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Database (BO)
                          </span>
                        ) : item.source === "env" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200" title="Falling back to environment variable (.env)">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            .env Fallback
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-200" title="Using default or unconfigured value">
                            Default / Unset
                          </span>
                        )}

                        {item.hasDbValue && (
                          <button
                            type="button"
                            onClick={() => handleResetToEnv(item.key)}
                            className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                            title="Remove Database override and revert to .env fallback"
                          >
                            Reset to .env
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 font-medium mb-3 min-h-[32px]">
                      {item.description}
                    </p>

                    {/* Control Input */}
                    <div className="relative">
                      {item.type === "select" ? (
                        <select
                          value={formData[item.key] || ""}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
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
                            onChange={(e) => handleChange(item.key, e.target.value)}
                            placeholder={item.isConfigured ? "•••••••• (Configured)" : "Enter secret key..."}
                            className="w-full text-xs font-mono px-3 py-2 pr-10 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret(item.key)}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-0.5"
                            title={isSecretVisible ? "Hide Secret" : "Show Secret"}
                          >
                            {isSecretVisible ? "🙈" : "👁️"}
                          </button>
                        </div>
                      ) : (
                        <input
                          type={item.type === "number" ? "number" : "text"}
                          value={formData[item.key] || ""}
                          onChange={(e) => handleChange(item.key, e.target.value)}
                          placeholder={`Default: ${item.defaultValue || "empty"}`}
                          className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Save Bar */}
            {modifiedCount > 0 && (
              <div className="sticky bottom-4 z-20 bg-[#0A2D59] text-white p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-sm">
                    {modifiedCount}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">Unsaved Settings Changes</p>
                    <p className="text-[11px] text-slate-300">
                      You have {modifiedCount} modified setting{modifiedCount > 1 ? "s" : ""}. Click Save to apply to Database.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...originalData })}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 rounded-xl text-xs font-black bg-white text-[#0A2D59] hover:bg-slate-100 transition-transform active:scale-95 shadow-sm cursor-pointer"
                  >
                    {saving ? "Saving..." : "Save Settings to DB"}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
