import { useEffect, useMemo, useState } from "react";

export function EventSwitcherModal({
  isOpen,
  onClose,
  events = [],
  selectedEventId,
  onSelectEvent,
  onOpenCreateModal
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("upcoming"); // "upcoming" | "past" | "pinned"
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedSlug, setCopiedSlug] = useState("");
  
  // Pinned event IDs stored in localStorage
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const raw = localStorage.getItem("pinned_event_ids");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (eventId, e) => {
    e.stopPropagation();
    let updated;
    if (pinnedIds.includes(eventId)) {
      updated = pinnedIds.filter((id) => id !== eventId);
    } else {
      updated = [...pinnedIds, eventId];
    }
    setPinnedIds(updated);
    try {
      localStorage.setItem("pinned_event_ids", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // Global Keyboard Listener for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset page when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [search, category, pageSize]);

  // Determine event timing category
  const todayStr = new Date().toISOString().split("T")[0];

  const processedEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    
    return events.filter((ev) => {
      // 1. Text Search Filter
      const matchesQuery =
        !query ||
        ev.title?.toLowerCase().includes(query) ||
        ev.location?.toLowerCase().includes(query) ||
        ev.description?.toLowerCase().includes(query) ||
        new Date(ev.date).toLocaleDateString().toLowerCase().includes(query);

      if (!matchesQuery) return false;

      // 2. Category Tab Filter
      const evDateStr = new Date(ev.date).toISOString().split("T")[0];
      const isPast = evDateStr < todayStr;

      if (category === "pinned") {
        return pinnedIds.includes(ev._id);
      } else if (category === "past") {
        return isPast;
      } else {
        // "upcoming" includes today & future events
        return !isPast;
      }
    });
  }, [events, search, category, pinnedIds, todayStr]);

  // Pagination calculation
  const totalPages = Math.ceil(processedEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedEvents.slice(start, start + pageSize);
  }, [processedEvents, page, pageSize]);

  const copyPublicLink = (publicSlug, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/register/${publicSlug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(publicSlug);
    setTimeout(() => setCopiedSlug(""), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      {/* Click backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-scale-up font-sans">
        
        {/* Top Header Banner */}
        <div className="bg-[#0A2D59] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight leading-none">
                Event Command Switcher
              </h2>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                Quickly search and switch between thousands of managed events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-white/10 border border-white/20 text-[10px] font-mono font-bold text-slate-200">
              ⌘K / Ctrl+K
            </span>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
              aria-label="Close Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Input Section */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              🔍
            </span>
            <input
              type="text"
              autoFocus
              placeholder="Search by title, location venue, or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl bg-white border border-slate-200 pl-10 pr-10 py-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] shadow-2xs transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Categorized Filter Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5">
            <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setCategory("upcoming")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  category === "upcoming"
                    ? "bg-white text-[#0A2D59] shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ⚡ Active & Upcoming
              </button>
              <button
                onClick={() => setCategory("past")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  category === "past"
                    ? "bg-white text-[#0A2D59] shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🕒 Past Events
              </button>
              <button
                onClick={() => setCategory("pinned")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  category === "pinned"
                    ? "bg-white text-[#0A2D59] shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>⭐ Pinned</span>
                {pinnedIds.length > 0 && (
                  <span className="bg-[#0A2D59]/10 text-[#0A2D59] text-[10px] px-1.5 rounded-full font-black">
                    {pinnedIds.length}
                  </span>
                )}
              </button>
            </div>

            {onOpenCreateModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateModal();
                }}
                className="shrink-0 rounded-xl bg-[#0A2D59] hover:bg-[#082247] text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>+</span>
                <span>New Event</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Roster List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[50vh]">
          {paginatedEvents.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <span className="text-3xl">🗓️</span>
              <p className="text-xs font-bold text-slate-700">No events found matching your filter</p>
              <p className="text-[11px] text-slate-400">
                Try searching with a different keyword or create a new event.
              </p>
            </div>
          ) : (
            paginatedEvents.map((ev) => {
              const isSelected = ev._id === selectedEventId;
              const isPinned = pinnedIds.includes(ev._id);
              const evDate = new Date(ev.date);
              const evDateStr = evDate.toISOString().split("T")[0];
              const isToday = evDateStr === todayStr;
              const isPast = evDateStr < todayStr;

              return (
                <div
                  key={ev._id}
                  onClick={() => {
                    onSelectEvent(ev._id);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-[#0A2D59]/5 border-[#0A2D59] shadow-xs"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-2xs"
                  }`}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-slate-900 truncate">
                        {ev.title}
                      </span>

                      {/* Event Status Badges */}
                      {isToday ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wide uppercase border border-emerald-200">
                          🟢 Live Today
                        </span>
                      ) : isPast ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold tracking-wide uppercase border border-slate-200">
                          🏁 Ended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold tracking-wide uppercase border border-blue-200">
                          🗓 Upcoming
                        </span>
                      )}

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-[#0A2D59] text-white text-[10px] font-black uppercase">
                          Active Selection
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <span>📅</span>
                        <span>{evDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>•</span>
                        <span>{evDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                      </span>

                      {ev.location && (
                        <span className="flex items-center gap-1 text-slate-600 truncate max-w-[200px]">
                          <span>📍</span>
                          <span className="truncate">{ev.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => togglePin(ev._id, e)}
                      className={`p-1.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isPinned
                          ? "bg-amber-50 border-amber-300 text-amber-600"
                          : "bg-slate-50 border-slate-200 text-slate-400 hover:text-amber-500"
                      }`}
                      title={isPinned ? "Unpin Event" : "Pin Event to Top"}
                    >
                      {isPinned ? "⭐" : "☆"}
                    </button>

                    {ev.publicSlug && (
                      <button
                        type="button"
                        onClick={(e) => copyPublicLink(ev.publicSlug, e)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200/80 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Copy Public Guest Registration URL"
                      >
                        <span>🔗</span>
                        <span>{copiedSlug === ev.publicSlug ? "Copied!" : "Link"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectEvent(ev._id);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[#0A2D59] text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-[#0A2D59] hover:text-white text-slate-700 border border-slate-200"
                      }`}
                    >
                      {isSelected ? "Selected ✓" : "Switch Event"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Pagination Controls */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value={5}>5 per batch</option>
              <option value={10}>10 per batch</option>
              <option value={25}>25 per batch</option>
              <option value={50}>50 per batch</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              Showing {processedEvents.length > 0 ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, processedEvents.length)} of {processedEvents.length} Events
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold cursor-pointer"
            >
              ◀ Prev
            </button>
            <span className="px-2 text-xs font-bold text-[#0A2D59]">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold cursor-pointer"
            >
              Next ▶
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
