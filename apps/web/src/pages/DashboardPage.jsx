import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import QRCode from "qrcode";
import { Navbar } from "../components/Navbar.jsx";
import { EventSwitcherModal } from "../components/EventSwitcherModal.jsx";

export function DashboardPage({ auth }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [error, setError] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [manualAttendee, setManualAttendee] = useState({ name: "", email: "", phoneNumber: "" });
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "event_staff", assignedGateId: "" });
  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    location: "",
    description: ""
  });
  const [activeAttendeeQr, setActiveAttendeeQr] = useState(null);

  // App Shell Navigation & Sheet States
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "attendees" | "gates" | "team" | "events"
  const [walkInSheetOpen, setWalkInSheetOpen] = useState(false);
  const [bulkImportSheetOpen, setBulkImportSheetOpen] = useState(false);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [switcherModalOpen, setSwitcherModalOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventDirectoryFilter, setEventDirectoryFilter] = useState("all"); // "all" | "upcoming" | "past"
  const [eventDirectoryPage, setEventDirectoryPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [attendeeFilter, setAttendeeFilter] = useState("all"); // "all" | "checked_in" | "pending"
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);

  // High-Volume Pagination & Infinite Scroll States for 100s/1000s of Attendees
  const [pageSize, setPageSize] = useState(25);
  const [visibleCount, setVisibleCount] = useState(25);
  const attendeeListContainerRef = useRef(null);

  // Gates management and context-specific messages
  const [gates, setGates] = useState([]);
  const [newGateName, setNewGateName] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateSuccess, setGateSuccess] = useState("");
  const [editingAttendee, setEditingAttendee] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phoneNumber: "" });
  const [eventError, setEventError] = useState("");
  const [eventSuccess, setEventSuccess] = useState("");
  const [staffError, setStaffError] = useState("");
  const [staffSuccess, setStaffSuccess] = useState("");
  const [attendeeError, setAttendeeError] = useState("");
  const [attendeeSuccess, setAttendeeSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const [eventQrDataUrl, setEventQrDataUrl] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // User edit/delete states
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", role: "event_staff", assignedGateId: "" });
  const [editUserError, setEditUserError] = useState("");

  // Map of attendee IDs to generated QR Data URLs
  const [attendeeQrMap, setAttendeeQrMap] = useState({});

  const isSuperAdmin = auth.user?.role === "admin" || auth.user?.role === "super_admin";
  const isAdmin = isSuperAdmin || auth.user?.role === "event_admin";

  async function loadEvents() {
    try {
      const list = await api("/api/events", { token: auth.token });
      setEvents(list);
      if (list.length && !selectedEventId) {
        setSelectedEventId(list[0]._id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadStaff() {
    if (!isAdmin) return;
    const staff = await api("/api/auth/staff", { token: auth.token });
    setStaffUsers(staff);
  }

  useEffect(() => {
    loadEvents();
    loadStaff().catch((err) => setError(err.message));
  }, [auth.token]);

  async function loadEventDetails(eventId) {
    const [s, a] = await Promise.all([
      api(`/api/events/${eventId}/stats`, { token: auth.token }),
      api(`/api/events/${eventId}/attendees`, { token: auth.token })
    ]);
    setStats(s);
    setAttendees(a);
  }

  async function loadGates(eventId) {
    try {
      const list = await api(`/api/events/${eventId}/gates`, { token: auth.token });
      setGates(list);
    } catch (err) {
      console.error("Failed to load gates:", err);
    }
  }

  useEffect(() => {
    if (!selectedEventId) return;
    (async () => {
      try {
        await Promise.all([
          loadEventDetails(selectedEventId),
          loadGates(selectedEventId)
        ]);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [selectedEventId, auth.token]);

  // Reset pagination count whenever search, filter, or event changes
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [searchQuery, attendeeFilter, selectedEventId, pageSize]);

  // Filtered attendees search & status logic
  const filteredAttendees = attendees.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.phoneNumber && a.phoneNumber.includes(searchQuery));
    
    if (attendeeFilter === "checked_in") return matchesSearch && a.isCheckedIn;
    if (attendeeFilter === "pending") return matchesSearch && !a.isCheckedIn;
    return matchesSearch;
  });

  // Slice for visible items based on current pagination
  const displayedAttendees = filteredAttendees.slice(0, visibleCount);

  // Generate QR codes on-demand only for currently visible attendees (High-Performance Scaling)
  useEffect(() => {
    if (!displayedAttendees || !displayedAttendees.length) return;

    let isMounted = true;

    async function generateAttendeeQrs() {
      const map = { ...attendeeQrMap };
      let changed = false;

      for (const a of displayedAttendees) {
        if (!map[a._id]) {
          if (a.ticketQrDataUrl) {
            map[a._id] = a.ticketQrDataUrl;
            changed = true;
          } else {
            const payload = a.ticketUuid || JSON.stringify({ attendeeId: a._id, eventId: a.eventId });
            try {
              const url = await QRCode.toDataURL(payload, {
                width: 200,
                margin: 1,
                color: { dark: "#0A2D59", light: "#ffffff" }
              });
              map[a._id] = url;
              changed = true;
            } catch (e) {
              console.error("Failed to generate attendee QR:", e);
            }
          }
        }
      }
      if (isMounted && changed) {
        setAttendeeQrMap(map);
      }
    }

    generateAttendeeQrs();

    return () => { isMounted = false; };
  }, [displayedAttendees]);

  // Infinite scroll listener for attendee list container
  function handleAttendeeScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      if (visibleCount < filteredAttendees.length) {
        setVisibleCount((prev) => Math.min(prev + pageSize, filteredAttendees.length));
      }
    }
  }

  async function createGate(e) {
    e.preventDefault();
    if (!selectedEventId || !newGateName.trim()) return;
    setGateError("");
    setGateSuccess("");
    try {
      await api(`/api/events/${selectedEventId}/gates`, {
        token: auth.token,
        method: "POST",
        body: { name: newGateName.trim() }
      });
      setNewGateName("");
      setGateSuccess("Gate created successfully!");
      await loadGates(selectedEventId);
    } catch (err) {
      setGateError(err.message);
    }
  }

  async function handleDeleteGate(gateId) {
    if (!selectedEventId) return;
    if (!window.confirm("Are you sure you want to delete this gate? All staff assigned to this gate will be unassigned.")) return;
    setGateError("");
    setGateSuccess("");
    try {
      await api(`/api/events/${selectedEventId}/gates/${gateId}`, {
        token: auth.token,
        method: "DELETE"
      });
      setGateSuccess("Gate deleted successfully!");
      await loadGates(selectedEventId);
      await loadStaff();
    } catch (err) {
      setGateError(err.message);
    }
  }

  async function handleReassignGate(userId, gateId) {
    try {
      await api(`/api/auth/staff/${userId}`, {
        token: auth.token,
        method: "PUT",
        body: { assignedGateId: gateId || null }
      });
      await loadStaff();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    setEventError("");
    setEventSuccess("");
    try {
      const combinedDateTime = form.date && form.time ? `${form.date}T${form.time}` : form.date;
      const created = await api("/api/events", {
        token: auth.token,
        method: "POST",
        body: {
          title: form.title,
          date: combinedDateTime,
          location: form.location,
          description: form.description
        }
      });
      setForm({
        title: "",
        date: new Date().toISOString().split("T")[0],
        time: "09:00",
        location: "",
        description: ""
      });
      setEventSuccess("Event created successfully!");
      setCreateEventModalOpen(false);
      await loadEvents();
      if (created && created._id) {
        setSelectedEventId(created._id);
      }
    } catch (err) {
      setEventError(err.message);
    }
  }

  async function uploadCsv(file) {
    setAttendeeError("");
    setAttendeeSuccess("");
    const data = new FormData();
    data.append("file", file);
    try {
      const result = await api(`/api/events/${selectedEventId}/attendees/bulk`, {
        token: auth.token,
        method: "POST",
        formData: data
      });
      setBulkResult(result);
      setAttendeeSuccess(`Import complete: ${result.created} attendees successfully imported.`);
      setBulkImportSheetOpen(false);
      await loadEventDetails(selectedEventId);
    } catch (err) {
      setAttendeeError(err.message);
    }
  }

  async function addManualAttendee(event) {
    event.preventDefault();
    if (!selectedEventId) return;
    setAttendeeError("");
    setAttendeeSuccess("");

    try {
      await api(`/api/events/${selectedEventId}/attendees`, {
        token: auth.token,
        method: "POST",
        body: manualAttendee
      });
      setManualAttendee({ name: "", email: "", phoneNumber: "" });
      setBulkResult(null);
      setAttendeeSuccess("Walk-in guest registered successfully!");
      setWalkInSheetOpen(false);
      await loadEventDetails(selectedEventId);
    } catch (err) {
      setAttendeeError(err.message);
    }
  }

  async function createStaffUser(event) {
    event.preventDefault();
    setStaffError("");
    setStaffSuccess("");
    try {
      await api("/api/auth/staff", {
        token: auth.token,
        method: "POST",
        body: staffForm
      });
      const roleLabels = { super_admin: "Super Admin", event_admin: "Event Admin", event_staff: "Event Staff" };
      const createdRole = roleLabels[staffForm.role] || "User";
      setStaffForm({ name: "", email: "", password: "", role: "event_staff", assignedGateId: "" });
      setStaffSuccess(`${createdRole} account created successfully!`);
      await loadStaff();
    } catch (err) {
      setStaffError(err.message);
    }
  }

  function handleStartEditUser(user) {
    setEditingUser(user);
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      assignedGateId: user.assignedGateId || ""
    });
    setEditUserError("");
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError("");
    setStaffError("");
    setStaffSuccess("");
    try {
      await api(`/api/auth/staff/${editingUser.id}`, {
        token: auth.token,
        method: "PUT",
        body: editUserForm
      });
      setEditingUser(null);
      setStaffSuccess("User account updated successfully!");
      await loadStaff();
    } catch (err) {
      setEditUserError(err.message);
    }
  }

  async function handleDeleteUser(userId, userName) {
    if (auth.user?.id === userId) {
      alert("For safety reasons, you cannot delete your own logged-in admin account!");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the user account for "${userName}"? This action is permanent.`)) return;
    setStaffError("");
    setStaffSuccess("");
    try {
      await api(`/api/auth/staff/${userId}`, {
        token: auth.token,
        method: "DELETE"
      });
      setStaffSuccess(`User account for "${userName}" deleted successfully!`);
      await loadStaff();
    } catch (err) {
      setStaffError(err.message);
    }
  }

  async function handleStartEdit(attendee) {
    setEditingAttendee(attendee);
    setEditForm({
      name: attendee.name,
      email: attendee.email,
      phoneNumber: attendee.phoneNumber || ""
    });
    setEditError("");
  }

  async function handleUpdateAttendee(event) {
    event.preventDefault();
    if (!selectedEventId || !editingAttendee) return;
    setEditError("");
    setAttendeeError("");
    setAttendeeSuccess("");

    try {
      await api(`/api/events/${selectedEventId}/attendees/${editingAttendee._id}`, {
        token: auth.token,
        method: "PUT",
        body: editForm
      });
      setEditingAttendee(null);
      setAttendeeSuccess("Attendee updated successfully!");
      await loadEventDetails(selectedEventId);
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDeleteAttendee(attendeeId) {
    if (!selectedEventId) return;
    if (!window.confirm("Are you sure you want to delete this attendee? This action cannot be undone.")) return;
    setAttendeeError("");
    setAttendeeSuccess("");

    try {
      await api(`/api/events/${selectedEventId}/attendees/${attendeeId}`, {
        token: auth.token,
        method: "DELETE"
      });
      setAttendeeSuccess("Attendee deleted successfully!");
      await loadEventDetails(selectedEventId);
    } catch (err) {
      setAttendeeError(err.message);
    }
  }

  function downloadSampleCsv() {
    const csvContent = "Name,Email,Phone Number\nJohn Doe,john.doe@example.com,+1234567890\nJane Smith,jane.smith@example.com,+9876543210\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "attendee_import_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const selectedEvent = events.find((event) => event._id === selectedEventId);
  const publicRegistrationUrl = selectedEvent
    ? `${window.location.origin}/#/register/${selectedEvent.publicSlug}`
    : "";

  useEffect(() => {
    if (publicRegistrationUrl) {
      QRCode.toDataURL(publicRegistrationUrl, {
        width: 360,
        margin: 2,
        color: { dark: "#0A2D59", light: "#ffffff" }
      })
        .then((url) => setEventQrDataUrl(url))
        .catch((err) => console.error("Failed to generate event QR:", err));
    }
  }, [publicRegistrationUrl]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-mobile-nav">
      
      {/* Shared Navbar Header & Hamburger Menu */}
      <Navbar
        auth={auth}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCreateEvent={() => setCreateEventModalOpen(true)}
        onOpenWalkIn={() => setWalkInSheetOpen(true)}
        onOpenBulkImport={() => setBulkImportSheetOpen(true)}
        onOpenSwitcher={() => setSwitcherModalOpen(true)}
        selectedEventTitle={selectedEvent?.title}
      />

      {/* 2. Top Event Switcher & Tab Selector Header */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Interactive Command Switcher Pill Trigger */}
            <button
              onClick={() => setSwitcherModalOpen(true)}
              className="flex-1 flex items-center justify-between rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 transition-all cursor-pointer shadow-2xs group"
              title="Click or press ⌘K to search & switch events"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs">⚡</span>
                <span className="truncate font-black text-[#0A2D59]">
                  {selectedEvent?.title || "Select Event..."}
                </span>
                {selectedEvent && (
                  <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                    ({new Date(selectedEvent.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono font-extrabold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                  ⌘K Search
                </span>
                <span className="text-xs text-slate-400 group-hover:text-slate-600">▼</span>
              </div>
            </button>
            
            {isAdmin && (
              <button
                onClick={() => setCreateEventModalOpen(true)}
                className="shrink-0 rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-3.5 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                + New Event
              </button>
            )}
          </div>

          {/* Desktop Tab Selector Pills */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "overview" ? "bg-white text-[#0A2D59] shadow-xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setActiveTab("attendees")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "attendees" ? "bg-white text-[#0A2D59] shadow-xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>👥 Attendees</span>
              {stats && (
                <span className="bg-[#0A2D59]/10 text-[#0A2D59] text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                  {stats.totalRegistrations}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("gates")}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "gates" ? "bg-white text-[#0A2D59] shadow-xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📍 Gates
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab("events")}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "events" ? "bg-white text-[#0A2D59] shadow-xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🗓️ Events
                </button>
                <button
                  onClick={() => setActiveTab("team")}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeTab === "team" ? "bg-white text-[#0A2D59] shadow-xs border border-slate-200/60" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🛡️ Team
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global Context Alerts Bar */}
      {(error || eventError || gateError || attendeeError || staffError) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-xs font-semibold text-red-700 flex items-center justify-between">
          <span>⚠️ {error || eventError || gateError || attendeeError || staffError}</span>
          <button onClick={() => { setError(""); setEventError(""); setGateError(""); setAttendeeError(""); setStaffError(""); }} className="text-red-700 font-extrabold text-sm ml-2">×</button>
        </div>
      )}
      {(eventSuccess || gateSuccess || attendeeSuccess || staffSuccess) && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 text-xs font-semibold text-emerald-700 flex items-center justify-between">
          <span>✅ {eventSuccess || gateSuccess || attendeeSuccess || staffSuccess}</span>
          <button onClick={() => { setEventSuccess(""); setGateSuccess(""); setAttendeeSuccess(""); setStaffSuccess(""); }} className="text-emerald-700 font-extrabold text-sm ml-2">×</button>
        </div>
      )}

      {/* 3. Main Workspace Canvas */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* TAB 1: 📊 OVERVIEW & EVENT HUB */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-in">
            {selectedEvent ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Event Hero Details Card with #0A2D59 Branding */}
                <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1 bg-[#0A2D59]/10 text-[#0A2D59] text-xs font-bold px-2.5 py-1 rounded-lg border border-[#0A2D59]/20 mb-2">
                        🟢 Active Event Workspace
                      </span>
                      <h2 className="text-2xl font-extrabold text-[#0A2D59] tracking-tight">{selectedEvent.title}</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
                      <span className="text-lg">📅</span>
                      <div>
                        <p className="text-slate-500 font-semibold">Date & Time</p>
                        <p className="text-slate-900 font-bold">{new Date(selectedEvent.date).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center gap-3">
                      <span className="text-lg">📍</span>
                      <div>
                        <p className="text-slate-500 font-semibold">Location</p>
                        <p className="text-slate-900 font-bold">{selectedEvent.location}</p>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.description && (
                    <p className="text-slate-600 text-xs leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 font-medium">
                      {selectedEvent.description}
                    </p>
                  )}

                  {/* Registration Share Bar */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>🔗</span>
                      <span>Public Guest Registration Link</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={publicRegistrationUrl}
                        className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-mono text-[#0A2D59] font-semibold focus:outline-none select-all truncate"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(publicRegistrationUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="shrink-0 rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-4 py-2.5 text-xs font-bold text-white shadow-sm"
                      >
                        {copiedLink ? "Copied! ✅" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Event QR Code Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📲</span>
                    <span>Registration QR Code</span>
                  </h3>
                  {eventQrDataUrl ? (
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-200">
                      <img src={eventQrDataUrl} alt="Event Registration QR" className="w-40 h-40 object-contain" />
                    </div>
                  ) : (
                    <div className="w-40 h-40 bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 animate-pulse font-semibold">
                      Generating QR...
                    </div>
                  )}
                  {eventQrDataUrl && (
                    <a
                      href={eventQrDataUrl}
                      download={`${(selectedEvent.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-registration-qr.png`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A2D59] bg-[#0A2D59]/10 hover:bg-[#0A2D59]/20 px-3.5 py-2 rounded-xl border border-[#0A2D59]/20 transition-colors"
                    >
                      <span>📥</span>
                      <span>Download Registration QR</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center space-y-3 shadow-xs">
                <p className="text-slate-500 text-sm font-semibold">No events found in your workspace.</p>
                {isAdmin && (
                  <button
                    onClick={() => setCreateEventModalOpen(true)}
                    className="rounded-xl bg-[#0A2D59] hover:bg-[#082247] px-4 py-2.5 text-xs font-bold text-white shadow-sm"
                  >
                    + Create Your First Event
                  </button>
                )}
              </div>
            )}

            {/* Quick Metrics Bar */}
            {stats && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registrations</p>
                      <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.totalRegistrations}</p>
                    </div>
                    <span className="text-3xl opacity-80">📋</span>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Checked In</p>
                      <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.checkedIn}</p>
                    </div>
                    <span className="text-3xl opacity-80">✅</span>
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Arrival</p>
                      <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.pending}</p>
                    </div>
                    <span className="text-3xl opacity-80">⏳</span>
                  </div>
                </div>

                {/* Recent Entry Scan Logs Feed */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⏱️</span>
                      <span>Recent Scan Activity & Entry Logs</span>
                    </h3>
                    <span className="text-[11px] font-bold text-[#0A2D59] bg-[#0A2D59]/10 px-2.5 py-0.5 rounded-full border border-[#0A2D59]/20">
                      {stats?.recentLogs?.length || 0} Scans Recorded
                    </span>
                  </div>

                  {!stats?.recentLogs || stats.recentLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic font-medium">
                      No check-in scan activity logged yet for this event.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
                      {stats.recentLogs.map((log) => (
                        <div key={log._id || log.id || log.timestamp} className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                log.status === "GRANTED"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {log.status === "GRANTED" ? "✓" : "✕"}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 truncate">
                                  {log.attendeeId?.name || "Attendee"}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                    log.status === "GRANTED"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-red-50 text-red-700 border border-red-200"
                                  }`}
                                >
                                  {log.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate">
                                {log.attendeeId?.email || "No email"} {log.gateName ? `· Gate: ${log.gateName}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-mono text-[11px] font-bold text-slate-700">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">
                              {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: 👥 ATTENDEES & HIGH-VOLUME SCALABLE ROSTER */}
        {activeTab === "attendees" && (
          <div className="space-y-4 animate-fade-in">
            
            {/* Header & Quick Action Trigger Bar */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder="Search 100s of attendees by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setWalkInSheetOpen(true)}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-4 py-2 text-xs font-bold text-white shadow-sm shadow-[#0A2D59]/20"
                  >
                    <span>+ Walk-In Guest</span>
                  </button>
                  <button
                    onClick={() => setBulkImportSheetOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors px-3.5 py-2 text-xs font-bold text-slate-700 border border-slate-200"
                  >
                    <span>📥 Bulk Import</span>
                  </button>
                </div>
              </div>

              {/* Status Filter Pills & High-Volume Batch Selector */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setAttendeeFilter("all")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      attendeeFilter === "all" ? "bg-[#0A2D59] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    All ({attendees.length})
                  </button>
                  <button
                    onClick={() => setAttendeeFilter("checked_in")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      attendeeFilter === "checked_in" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Checked In ({attendees.filter((a) => a.isCheckedIn).length})
                  </button>
                  <button
                    onClick={() => setAttendeeFilter("pending")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      attendeeFilter === "pending" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Pending ({attendees.filter((a) => !a.isCheckedIn).length})
                  </button>
                </div>

                {/* Page Batch Size Control */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Batch Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value={25}>25 per view</option>
                    <option value={50}>50 per view</option>
                    <option value={100}>100 per view</option>
                    <option value={250}>250 (All)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Attendee Roster List with High-Volume Virtual Scroll & Lazy QR Rendering */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#0A2D59] uppercase tracking-wider flex items-center gap-1.5">
                  <span>📜</span>
                  <span>Attendee Roster ({filteredAttendees.length} Total Records)</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Showing 1–{displayedAttendees.length} of {filteredAttendees.length}
                </span>
              </div>

              {filteredAttendees.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs italic font-medium">
                  No attendees matching your search/filter criteria.
                </div>
              ) : (
                <div
                  ref={attendeeListContainerRef}
                  onScroll={handleAttendeeScroll}
                  className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto"
                >
                  {displayedAttendees.map((a) => {
                    const qrUrl = attendeeQrMap[a._id] || a.ticketQrDataUrl;

                    return (
                      <div key={a._id} className="p-3.5 sm:p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3">
                        
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          {/* Direct Visible Inline Attendee QR Code */}
                          {qrUrl ? (
                            <button
                              onClick={() => setActiveAttendeeQr(qrUrl)}
                              className="shrink-0 group relative p-1 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-[#0A2D59] hover:shadow-md transition-all"
                              title="Click to view full QR pass"
                            >
                              <img src={qrUrl} alt={`${a.name} QR`} className="w-14 h-14 object-contain rounded-lg" />
                              <span className="absolute inset-0 bg-[#0A2D59]/10 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity flex items-center justify-center text-[10px] font-extrabold text-[#0A2D59]">
                                🔍
                              </span>
                            </button>
                          ) : (
                            <div className="shrink-0 w-14 h-14 bg-slate-100 rounded-xl border border-slate-200/80 flex items-center justify-center text-[10px] text-slate-400 font-semibold animate-pulse">
                              Loading...
                            </div>
                          )}

                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-sm truncate">{a.name}</span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  a.isCheckedIn
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}
                              >
                                {a.isCheckedIn ? "Checked In" : "Pending"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate font-medium">{a.email}</p>
                            {a.phoneNumber && <p className="text-[11px] text-slate-400 font-mono">{a.phoneNumber}</p>}
                          </div>
                        </div>

                        {/* Attendee Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {qrUrl && (
                            <button
                              onClick={() => setActiveAttendeeQr(qrUrl)}
                              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#0A2D59]/10 hover:text-[#0A2D59] text-slate-600 border border-slate-200 text-xs font-bold transition-colors"
                              title="Expand Ticket QR"
                            >
                              <span>🎟️ Expand QR</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(a)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-semibold transition-colors"
                            title="Edit Attendee"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteAttendee(a._id)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-red-500 border border-slate-200 text-xs font-semibold transition-colors"
                            title="Delete Attendee"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Infinite Scroll / Load More Trigger */}
                  {visibleCount < filteredAttendees.length && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                      <button
                        onClick={() => setVisibleCount((prev) => Math.min(prev + pageSize, filteredAttendees.length))}
                        className="rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-all px-6 py-2.5 text-xs font-bold text-white shadow-sm"
                      >
                        ⚡ Load Next {Math.min(pageSize, filteredAttendees.length - visibleCount)} Attendees (Showing {visibleCount} of {filteredAttendees.length})
                      </button>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">Or scroll down to load automatically</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: 📍 GATES & CHECK-IN POSTS */}
        {activeTab === "gates" && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Live Camera Scanner Launcher Banner with #0A2D59 Branding */}
            <div className="bg-gradient-to-r from-[#0A2D59] via-[#0D386F] to-[#0A2D59] rounded-2xl p-6 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/20">
                  LIVE VALIDATOR
                </span>
                <h2 className="text-xl font-extrabold text-white">Entrance Camera Scanner</h2>
                <p className="text-xs text-indigo-100 font-medium">Scan physical or mobile QR passes at your entrance gates in real time.</p>
              </div>
              <Link
                to="/scan"
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white text-[#0A2D59] hover:bg-slate-100 transition-colors px-5 py-3 text-xs font-black shadow-lg"
              >
                <span>📷 Open Live Scanner</span>
              </Link>
            </div>

            {/* Gates Management Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-extrabold text-[#0A2D59] uppercase tracking-wider flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Entrance Gates & Posts ({gates.length})</span>
                </h3>
              </div>

              <form onSubmit={createGate} className="flex gap-2">
                <input
                  type="text"
                  placeholder="New Gate Name (e.g. Gate 1, VIP Entrance)"
                  value={newGateName}
                  onChange={(e) => setNewGateName(e.target.value)}
                  className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-4 py-2.5 text-xs font-bold text-white shadow-sm"
                >
                  + Add Post
                </button>
              </form>

              <div className="space-y-2">
                {gates.length === 0 && <p className="text-xs text-slate-400 italic font-medium">No gates created for this event yet.</p>}
                {gates.map((g) => (
                  <div key={g._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span className="text-emerald-500">🟢</span>
                      <span>{g.name}</span>
                    </span>
                    <button
                      onClick={() => handleDeleteGate(g._id)}
                      className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 🛡️ TEAM & STAFF MANAGEMENT (Scoped) */}
        {activeTab === "team" && isAdmin && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Create Staff Form Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-xs font-extrabold text-[#0A2D59] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <span>➕</span>
                  <span>{isSuperAdmin ? "Create System Account" : "Create Event Staff"}</span>
                </h3>

                <form onSubmit={createStaffUser} className="space-y-3">
                  <input
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                    placeholder="Full Name"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    required
                  />
                  <input
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                    placeholder="Email Address"
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    required
                  />
                  <input
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                    placeholder="Temporary Password"
                    type="password"
                    value={staffForm.password}
                    onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                    required
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                      value={staffForm.role}
                      onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    >
                      <option value="event_staff">Role: Event Staff</option>
                      {isSuperAdmin && (
                        <>
                          <option value="event_admin">Role: Event Admin</option>
                          <option value="super_admin">Role: Super Admin</option>
                        </>
                      )}
                    </select>

                    {staffForm.role === "event_staff" && (
                      <select
                        className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                        value={staffForm.assignedGateId}
                        onChange={(e) => setStaffForm({ ...staffForm, assignedGateId: e.target.value })}
                      >
                        <option value="">No Gate Assigned</option>
                        {gates.map((g) => (
                          <option key={g._id} value={g._id}>
                            Gate: {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors p-2.5 text-xs font-bold text-white shadow-sm"
                  >
                    {isSuperAdmin ? "Create System Account" : "Create Staff Account"}
                  </button>
                </form>
              </div>

              {/* Staff Accounts List Card */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-xs font-extrabold text-[#0A2D59] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <span>🛡️</span>
                  <span>{isSuperAdmin ? "System Accounts" : "Event Staff Accounts"} ({staffUsers.length})</span>
                </h3>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {staffUsers.length === 0 && (
                    <p className="text-slate-400 text-xs italic font-medium">
                      {isSuperAdmin ? "No system accounts found." : "No staff accounts assigned to your events."}
                    </p>
                  )}
                  {staffUsers.map((staff) => {
                    const isSuper = staff.role === "super_admin" || staff.role === "admin";
                    const isEventAdmin = staff.role === "event_admin";
                    const roleBadgeText = isSuper ? "Super Admin" : isEventAdmin ? "Event Admin" : "Event Staff";

                    return (
                      <div key={staff.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 text-xs">{staff.name}</span>
                            <span className="ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#0A2D59]/10 text-[#0A2D59] border border-[#0A2D59]/20">
                              {roleBadgeText}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStartEditUser(staff)}
                              className="text-[10px] font-bold text-[#0A2D59] hover:underline uppercase tracking-wider"
                            >
                              Edit
                            </button>
                            {auth.user?.id !== staff.id && (
                              <button
                                onClick={() => handleDeleteUser(staff.id, staff.name)}
                                className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase tracking-wider"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">{staff.email}</p>

                        {(staff.role === "staff" || staff.role === "event_staff") && (
                          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/60 text-xs">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Assign Post:</span>
                            <select
                              value={staff.assignedGateId || ""}
                              onChange={(e) => handleReassignGate(staff.id, e.target.value)}
                              className="rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] text-slate-800 font-medium focus:outline-none"
                            >
                              <option value="">None (Default)</option>
                              {gates.map((g) => (
                                <option key={g._id} value={g._id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Events Directory & Management Workspace */}
        {activeTab === "events" && isAdmin && (
          <div className="space-y-6 animate-scale-up">
            
            {/* Header Title & Quick Search Bar */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-[#0A2D59] flex items-center gap-2">
                    <span>🗓️</span>
                    <span>Managed Events Directory</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    View, search, filter, and switch across all events in your account
                  </p>
                </div>

                <button
                  onClick={() => setCreateEventModalOpen(true)}
                  className="rounded-xl bg-[#0A2D59] hover:bg-[#082247] transition-colors px-4 py-2.5 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
                >
                  <span>+</span>
                  <span>Create New Event</span>
                </button>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Filter events by title, venue, or date..."
                    value={eventSearchQuery}
                    onChange={(e) => {
                      setEventSearchQuery(e.target.value);
                      setEventDirectoryPage(1);
                    }}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 pl-9 pr-8 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  />
                  {eventSearchQuery && (
                    <button
                      onClick={() => setEventSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={eventDirectoryFilter}
                    onChange={(e) => {
                      setEventDirectoryFilter(e.target.value);
                      setEventDirectoryPage(1);
                    }}
                    className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="all">All Events ({events.length})</option>
                    <option value="upcoming">Active & Upcoming</option>
                    <option value="past">Past Events</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Events Directory Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Event Title</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Venue Location</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Public Pass Link</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {events
                      .filter((ev) => {
                        const query = eventSearchQuery.trim().toLowerCase();
                        const matchesQuery =
                          !query ||
                          ev.title?.toLowerCase().includes(query) ||
                          ev.location?.toLowerCase().includes(query) ||
                          new Date(ev.date).toLocaleDateString().toLowerCase().includes(query);

                        if (!matchesQuery) return false;

                        const todayStr = new Date().toISOString().split("T")[0];
                        const evDateStr = new Date(ev.date).toISOString().split("T")[0];
                        if (eventDirectoryFilter === "upcoming") return evDateStr >= todayStr;
                        if (eventDirectoryFilter === "past") return evDateStr < todayStr;
                        return true;
                      })
                      .map((ev) => {
                        const isSelected = ev._id === selectedEventId;
                        const evDate = new Date(ev.date);
                        const todayStr = new Date().toISOString().split("T")[0];
                        const evDateStr = evDate.toISOString().split("T")[0];
                        const isToday = evDateStr === todayStr;
                        const isPast = evDateStr < todayStr;

                        return (
                          <tr key={ev._id} className={isSelected ? "bg-[#0A2D59]/5" : "hover:bg-slate-50/80"}>
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-slate-900 text-xs">{ev.title}</span>
                              {ev.description && (
                                <p className="text-[11px] text-slate-400 font-normal truncate max-w-xs mt-0.5">
                                  {ev.description}
                                </p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                              📅 {evDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                              📍 {ev.location || "N/A"}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {isToday ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                  🟢 Live Today
                                </span>
                              ) : isPast ? (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                                  🏁 Ended
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase">
                                  🗓 Upcoming
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {ev.publicSlug ? (
                                <a
                                  href={`/register/${ev.publicSlug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-bold text-[#0A2D59] hover:underline flex items-center gap-1"
                                >
                                  <span>🔗 Registration Page</span>
                                  <span className="text-[10px]">↗</span>
                                </a>
                              ) : (
                                <span className="text-slate-400 font-normal">N/A</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedEventId(ev._id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-[#0A2D59] text-white shadow-2xs"
                                    : "bg-slate-100 hover:bg-[#0A2D59] hover:text-white text-slate-700 border border-slate-200"
                                }`}
                              >
                                {isSelected ? "Active ✓" : "Switch Event"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* 4. Touch-Friendly Slide-Up Bottom Sheet for Walk-In Registration */}
      {walkInSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#0A2D59] flex items-center gap-2">
                <span>📝</span>
                <span>Walk-In Guest Registration</span>
              </h3>
              <button
                onClick={() => setWalkInSheetOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={addManualAttendee} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={manualAttendee.name}
                  onChange={(e) => setManualAttendee({ ...manualAttendee, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="jane.doe@example.com"
                  value={manualAttendee.email}
                  onChange={(e) => setManualAttendee({ ...manualAttendee, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+1234567890"
                  value={manualAttendee.phoneNumber}
                  onChange={(e) => setManualAttendee({ ...manualAttendee, phoneNumber: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWalkInSheetOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-3 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#0A2D59] hover:bg-[#082247] px-4 py-3 text-xs font-bold text-white shadow-md transition-colors"
                >
                  Register Guest
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Touch-Friendly Slide-Up Bottom Sheet for Bulk Import */}
      {bulkImportSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl animate-slide-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#0A2D59] flex items-center gap-2">
                <span>📥</span>
                <span>Bulk Attendee Spreadsheet Import</span>
              </h3>
              <button
                onClick={() => setBulkImportSheetOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                <span className="text-3xl">📄</span>
                <p className="text-xs font-semibold text-slate-700">Upload CSV or Excel (.xlsx, .xls) spreadsheet file</p>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])}
                  className="hidden"
                  id="bulk-file-input"
                />
                <label
                  htmlFor="bulk-file-input"
                  className="inline-block rounded-xl bg-[#0A2D59] hover:bg-[#082247] cursor-pointer px-4 py-2 text-xs font-bold text-white shadow-sm"
                >
                  Choose Spreadsheet File
                </label>
              </div>

              <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3">
                <span className="text-slate-500 font-medium">Need standard formatting?</span>
                <button
                  onClick={downloadSampleCsv}
                  className="text-[#0A2D59] font-bold hover:underline"
                >
                  Download Sample CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create Event Modal */}
      {createEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-[#0A2D59] flex items-center gap-2">
                <span>➕</span>
                <span>Create New Event</span>
              </h3>
              <button
                onClick={() => setCreateEventModalOpen(false)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createEvent} className="space-y-3">
              <input
                type="text"
                placeholder="Event Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                required
              />
              {/* Event Date & Time Selector with Native Calendar + Manual Text Input */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Event Date
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onClick={(e) => e.target.showPicker?.()}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Event Time
                    </label>
                    <input
                      type="time"
                      value={form.time}
                      onClick={(e) => e.target.showPicker?.()}
                      onChange={(e) => setForm({ ...form, time: e.target.value })}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Date Shortcuts */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Preset:</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, date: new Date().toISOString().split("T")[0] })}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition-colors"
                  >
                    📅 Today
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      setForm({ ...form, date: tomorrow.toISOString().split("T")[0] });
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition-colors"
                  >
                    🚀 Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextWeek = new Date();
                      nextWeek.setDate(nextWeek.getDate() + 7);
                      setForm({ ...form, date: nextWeek.toISOString().split("T")[0] });
                    }}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition-colors"
                  >
                    📆 Next Week
                  </button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Location / Venue"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                required
              />
              <textarea
                placeholder="Event Description (Optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59] resize-none"
              />

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateEventModalOpen(false)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#0A2D59] hover:bg-[#082247] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Attendee Ticket QR Preview Modal */}
      {activeAttendeeQr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-4 max-w-xs w-full shadow-2xl">
            <h4 className="text-sm font-extrabold text-[#0A2D59]">Attendee Ticket QR Pass</h4>
            <div className="p-3 bg-white rounded-2xl inline-block shadow-sm border border-slate-200">
              <img src={activeAttendeeQr} alt="Ticket QR Pass" className="w-48 h-48 object-contain" />
            </div>
            <button
              onClick={() => setActiveAttendeeQr(null)}
              className="w-full rounded-xl bg-[#0A2D59] hover:bg-[#082247] py-2.5 text-xs font-bold text-white transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* 8. Edit Attendee Modal */}
      {editingAttendee && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-[#0A2D59] flex items-center gap-2">
                <span>✏️</span>
                <span>Edit Attendee Profile</span>
              </h3>
              <button
                onClick={() => setEditingAttendee(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAttendee} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                />
              </div>

              {editError && <p className="text-xs text-red-600 font-semibold">{editError}</p>}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingAttendee(null)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#0A2D59] hover:bg-[#082247] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-[#0A2D59] flex items-center gap-2">
                <span>🛡️</span>
                <span>Edit User Account</span>
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Account Role</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                >
                  <option value="event_staff">Event Staff (Scanner Access)</option>
                  {isSuperAdmin && (
                    <>
                      <option value="event_admin">Event Admin (Scoped Access)</option>
                      <option value="super_admin">Super Admin (Global Access)</option>
                    </>
                  )}
                </select>
              </div>

              {editUserForm.role === "event_staff" && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Assigned Gate</label>
                  <select
                    value={editUserForm.assignedGateId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, assignedGateId: e.target.value })}
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0A2D59]/20 focus:border-[#0A2D59]"
                  >
                    <option value="">No Gate Assigned</option>
                    {gates.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editUserError && <p className="text-xs text-red-600 font-semibold">{editUserError}</p>}

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#0A2D59] hover:bg-[#082247] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
                >
                  Update Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Mobile Fixed Bottom Navigation Bar with #0A2D59 Branding */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 py-2 px-4 flex items-center justify-around md:hidden shadow-xl">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "overview" ? "text-[#0A2D59] font-black scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg">📊</span>
          <span className="text-[10px] font-bold">Overview</span>
        </button>

        <button
          onClick={() => setActiveTab("attendees")}
          className={`flex flex-col items-center gap-1 transition-all relative ${
            activeTab === "attendees" ? "text-[#0A2D59] font-black scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg">👥</span>
          <span className="text-[10px] font-bold">Attendees</span>
          {stats && (
            <span className="absolute -top-1 -right-2 bg-[#0A2D59] text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">
              {stats.totalRegistrations}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("gates")}
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === "gates" ? "text-[#0A2D59] font-black scale-105" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="text-lg">📍</span>
          <span className="text-[10px] font-bold">Gates</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab("events")}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === "events" ? "text-[#0A2D59] font-black scale-105" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="text-lg">🗓️</span>
            <span className="text-[10px] font-bold">Events</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => setActiveTab("team")}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === "team" ? "text-[#0A2D59] font-black scale-105" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="text-lg">🛡️</span>
            <span className="text-[10px] font-bold">Team</span>
          </button>
        )}
      </nav>

      {/* High-Volume Event Switcher Command Palette Modal */}
      <EventSwitcherModal
        isOpen={switcherModalOpen}
        onClose={() => setSwitcherModalOpen(false)}
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={(eventId) => setSelectedEventId(eventId)}
        onOpenCreateModal={() => setCreateEventModalOpen(true)}
      />

    </div>
  );
}
