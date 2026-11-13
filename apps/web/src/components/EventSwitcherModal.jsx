import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icons.jsx";

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

  const todayStr = new Date().toISOString().split("T")[0];

  const processedEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((ev) => {
      const matchesQuery =
        !query ||
        ev.title?.toLowerCase().includes(query) ||
        ev.location?.toLowerCase().includes(query) ||
        ev.description?.toLowerCase().includes(query) ||
        new Date(ev.date).toLocaleDateString().toLowerCase().includes(query);

      if (!matchesQuery) return false;

      const evDateStr = new Date(ev.date).toISOString().split("T")[0];
      const isPast = evDateStr < todayStr;

      if (category === "pinned") {
        return pinnedIds.includes(ev._id);
      } else if (category === "past") {
        return isPast;
      } else {
        return !isPast;
      }
    });
  }, [events, search, category, pinnedIds, todayStr]);

  const totalPages = Math.ceil(processedEvents.length / pageSize) || 1;
  const paginatedEvents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedEvents.slice(start, start + pageSize);
  }, [processedEvents, page, pageSize]);

  const copyPublicLink = (publicSlug, e) => {
    e.stopPropagation();
    const link = `${window.location.origin}/#/register/${publicSlug}`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(publicSlug);
    setTimeout(() => setCopiedSlug(""), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fade-in overflow-y-auto">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-2xl bg-surface border border-theme rounded-container shadow-soft overflow-hidden flex flex-col max-h-[88vh] z-10 animate-scale-up my-auto">
        {/* Hero Header */}
        <div className="bg-hero-gradient border-b border-theme px-5 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 shrink-0 rounded-tile bg-primary text-white flex items-center justify-center shadow-subtle">
              <Icon name="calendar" className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-primary leading-tight truncate">
                Event Switcher
              </h2>
              <p className="text-xs sm:text-sm text-muted truncate">
                Search and switch between managed events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-surface/80 border border-theme text-xs font-semibold text-primary">
              ⌘K / Ctrl+K
            </span>
            <button
              type="button"
              onClick={onClose}
              className="h-11 w-11 rounded-full bg-surface hover:bg-primary-soft border border-theme text-heading flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close Modal"
            >
              <Icon name="close" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Tabs */}
        <div className="px-5 sm:px-6 pt-4 pb-0 border-b border-theme bg-surface space-y-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <Icon name="search" className="w-5 h-5" />
            </span>
            <input
              type="text"
              autoFocus
              placeholder="Search by title, location venue, or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ui-input pl-11 pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-primary-tint text-muted hover:text-heading flex items-center justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="ui-tabs-bar border-b-0 flex-1">
              <button
                type="button"
                onClick={() => setCategory("upcoming")}
                className={`ui-tab ${category === "upcoming" ? "ui-tab-active" : "ui-tab-inactive"}`}
              >
                Active &amp; Upcoming
              </button>
              <button
                type="button"
                onClick={() => setCategory("past")}
                className={`ui-tab ${category === "past" ? "ui-tab-active" : "ui-tab-inactive"}`}
              >
                Past
              </button>
              <button
                type="button"
                onClick={() => setCategory("pinned")}
                className={`ui-tab ${category === "pinned" ? "ui-tab-active" : "ui-tab-inactive"}`}
              >
                <Icon name="star" className="w-4 h-4" filled={category === "pinned"} />
                <span>Pinned</span>
                {pinnedIds.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-pastel-lavender/70 text-primary text-xs font-bold">
                    {pinnedIds.length}
                  </span>
                )}
              </button>
            </div>

            {onOpenCreateModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateModal();
                }}
                className="ui-btn-pill mb-2 shrink-0"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span>New Event</span>
              </button>
            )}
          </div>
        </div>

        {/* Event Roster List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-page max-h-[48vh]">
          {paginatedEvents.length === 0 ? (
            <div className="ui-card p-8 text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center">
                <Icon name="calendar" className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-heading">No events found matching your filter</p>
              <p className="text-sm text-muted">
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
                  className={`p-4 rounded-card border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-primary-soft border-primary shadow-subtle"
                      : "bg-surface border-theme hover:border-primary/40 hover:bg-primary-tint/40"
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[15px] text-heading break-words">
                        {ev.title}
                      </span>

                      {isToday ? (
                        <span className="ui-chip bg-success-tint text-emerald-800 border-success/30">
                          <span className="h-2 w-2 rounded-full bg-success" />
                          Live Today
                        </span>
                      ) : isPast ? (
                        <span className="ui-chip bg-primary-tint text-muted border-theme">
                          Ended
                        </span>
                      ) : (
                        <span className="ui-chip bg-pastel-blue text-primary border-pastel-lavender">
                          Upcoming
                        </span>
                      )}

                      {isSelected && (
                        <span className="ui-chip bg-primary text-white border-primary">
                          Active
                        </span>
                      )}

                      {ev.companyId?.name && (
                        <span className="ui-chip bg-surface text-body border-theme">
                          {ev.companyId.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs sm:text-[13px] text-muted flex-wrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-body">
                        <Icon name="calendar" className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {evDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric"
                          })}
                        </span>
                        <span>·</span>
                        <span>
                          {evDate.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </span>

                      {ev.location && (
                        <span className="inline-flex items-center gap-1 text-muted truncate max-w-[220px]">
                          <Icon name="pin" className="w-3.5 h-3.5 text-primary" />
                          <span className="truncate">{ev.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => togglePin(ev._id, e)}
                      className={`h-11 w-11 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                        isPinned
                          ? "bg-pastel-peach border-warning/40 text-warning"
                          : "bg-surface border-theme text-muted hover:text-primary hover:border-primary/40"
                      }`}
                      title={isPinned ? "Unpin Event" : "Pin Event to Top"}
                      aria-label={isPinned ? "Unpin Event" : "Pin Event"}
                    >
                      <Icon name="star" className="w-4 h-4" filled={isPinned} />
                    </button>

                    {ev.publicSlug && (
                      <button
                        type="button"
                        onClick={(e) => copyPublicLink(ev.publicSlug, e)}
                        className="ui-btn-secondary-sm rounded-full px-3.5"
                        title="Copy Public Guest Registration URL"
                      >
                        <Icon name="link" className="w-4 h-4 text-primary" />
                        <span>{copiedSlug === ev.publicSlug ? "Copied!" : "Link"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectEvent(ev._id);
                        onClose();
                      }}
                      className={
                        isSelected
                          ? "ui-btn-primary-sm rounded-full px-4"
                          : "ui-btn-secondary-sm rounded-full px-4 hover:bg-primary hover:text-white hover:border-primary"
                      }
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
        <div className="px-5 py-3.5 bg-surface border-t border-theme flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="min-h-[38px] bg-primary-tint border border-theme rounded-tile px-2.5 py-1 text-xs font-bold text-heading focus:outline-none focus:border-primary"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>·</span>
            <span>
              {processedEvents.length > 0 ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, processedEvents.length)} of {processedEvents.length} Events
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="ui-btn-secondary-sm min-h-[40px] px-3.5 rounded-full"
            >
              Prev
            </button>
            <span className="px-2 text-xs sm:text-sm font-bold text-primary">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="ui-btn-secondary-sm min-h-[40px] px-3.5 rounded-full"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
