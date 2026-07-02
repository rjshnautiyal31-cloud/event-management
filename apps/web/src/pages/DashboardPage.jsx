import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function DashboardPage({ auth }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [error, setError] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [manualAttendee, setManualAttendee] = useState({ name: "", email: "", phoneNumber: "" });
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "staff", assignedGateId: "" });
  const [form, setForm] = useState({ title: "", date: "", location: "", description: "" });
  const [activeAttendeeQr, setActiveAttendeeQr] = useState(null);

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

  // New features: user edit/delete states
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", role: "staff", assignedGateId: "" });
  const [editUserError, setEditUserError] = useState("");

  const isAdmin = auth.user?.role === "admin";

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
      await loadStaff(); // Reload staff to show updated assignments
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
      await api("/api/events", {
        token: auth.token,
        method: "POST",
        body: form
      });
      setForm({ title: "", date: "", location: "", description: "" });
      setEventSuccess("Event created successfully!");
      await loadEvents();
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
      setAttendeeSuccess("Attendee added successfully!");
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
      const createdRole = staffForm.role === "admin" ? "Admin" : "Staff";
      setStaffForm({ name: "", email: "", password: "", role: "staff", assignedGateId: "" });
      setStaffSuccess(`${createdRole} user account created successfully!`);
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

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Premium Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-base shadow-md shadow-indigo-100">
                QR
              </span>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 tracking-tight leading-none text-base">
                  Gate Control
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                  Enterprise Suite
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Link 
                to="/scan" 
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 transition-colors px-4 py-2 text-xs font-semibold text-white shadow-sm"
              >
                <span>Live Validator</span>
                <span className="text-[10px]">📷</span>
              </Link>
              <button 
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm" 
                onClick={auth.logout}
              >
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Welcome Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl border border-slate-800 text-white shadow-sm">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Welcome Back, {auth.user?.name}!</h1>
            <p className="text-xs text-indigo-200 mt-1 font-medium">Manage and check-in your attendees across all events securely.</p>
          </div>
          <span className="inline-flex items-center rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/20">
            System Administrator
          </span>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm font-semibold text-red-700 flex items-center gap-2 animate-scale-up">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Create Event Block */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden space-y-4">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
              <span>📅</span>
              <span>Create New Event</span>
            </h2>
            
            <form className="grid gap-3 md:grid-cols-4" onSubmit={createEvent}>
              <input
                className="rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                placeholder="Event Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <input
                className="rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none"
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
              <input
                className="rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                placeholder="Location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
              <button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors py-2.5 text-xs text-white font-bold shadow-sm shadow-indigo-100">
                Create Event Account
              </button>
              <textarea
                className="rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400 md:col-span-4"
                placeholder="Event Description (optional)"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              {eventError && <p className="text-xs text-red-600 md:col-span-4 font-semibold">{eventError}</p>}
              {eventSuccess && <p className="text-xs text-emerald-600 md:col-span-4 font-semibold">{eventSuccess}</p>}
            </form>
          </div>
        )}

        {/* User Account Controls */}
        {isAdmin && (
          <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 md:grid-cols-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-indigo-500" />
            
            <form className="space-y-4" onSubmit={createStaffUser}>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b pb-2">
                <span>👥</span>
                <span>Create System User Account</span>
              </h2>
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                placeholder="Full name"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                placeholder="Email address"
                type="email"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                required
              />
              <input
                className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all focus:outline-none placeholder:text-slate-400"
                placeholder="Secure temporary password"
                type="password"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                required
              />
              
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-700 font-semibold"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                >
                  <option value="staff">Role: Staff</option>
                  <option value="admin">Role: Admin</option>
                </select>
                
                {staffForm.role === "staff" && (
                  <select
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none text-slate-700 font-semibold animate-scale-up"
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
              <button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors px-4 py-2.5 text-xs text-white font-bold shadow-sm shadow-indigo-100">
                Create System Account
              </button>
              {staffError && <p className="text-xs text-red-600 font-semibold">{staffError}</p>}
              {staffSuccess && <p className="text-xs text-emerald-600 font-semibold">{staffSuccess}</p>}
            </form>

            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 border-b pb-2 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>System User Accounts</span>
              </h2>
              <div className="space-y-2 text-sm max-h-[280px] overflow-y-auto pr-1">
                {staffUsers.length === 0 && <p className="text-slate-400 text-xs italic">No system users found.</p>}
                {staffUsers.map((staff) => (
                  <div key={staff.id} className="rounded-xl border border-slate-100 p-3 bg-slate-50/50 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div>
                        <span className="font-bold text-slate-900">{staff.name}</span>
                        <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          staff.role === "admin"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {staff.role === "admin" ? "Admin" : "Staff"}
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs font-medium">{staff.email}</p>
                      
                      {staff.role === "staff" && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1.5">
                          <span className="font-semibold text-[11px] text-slate-400 uppercase tracking-wider">Assign Post:</span>
                          <select
                            value={staff.assignedGateId || ""}
                            onChange={(e) => handleReassignGate(staff.id, e.target.value)}
                            className="rounded-md border border-slate-200 bg-white p-1 text-slate-700 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleStartEditUser(staff)}
                          className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          Edit Profile
                        </button>
                        {auth.user?.id !== staff.id && (
                          <button
                            onClick={() => handleDeleteUser(staff.id, staff.name)}
                            className="text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {staff.role === "staff" && staff.assignedGateName && (
                      <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-100 animate-scale-up shadow-sm">
                        📍 {staff.assignedGateName}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Events list and Stats Columns */}
        <div className="grid gap-6 md:grid-cols-3 items-start">
          
          {/* Events Navigation Card */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
              <h2 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                <span>📁</span>
                <span>My Active Events</span>
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {events.length === 0 && <p className="text-xs text-slate-400 italic">No events found.</p>}
                {events.map((event) => (
                  <button
                    key={event._id}
                    onClick={() => setSelectedEventId(event._id)}
                    className={`w-full rounded-xl border p-2.5 text-left text-sm transition-all duration-200 font-medium ${
                      selectedEventId === event._id 
                        ? "bg-indigo-50/40 text-indigo-900 border-l-4 border-l-indigo-600 border-slate-200" 
                        : "border-slate-100 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
              {selectedEvent && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Public Registration Link:</p>
                  <code className="block text-[11px] font-mono text-indigo-600 bg-indigo-50/50 p-1.5 rounded select-all break-all border border-indigo-50">
                    /register/{selectedEvent.publicSlug}
                  </code>
                </div>
              )}
            </div>

            {/* Event Gates Management Card */}
            {selectedEventId && isAdmin && (
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-1.5 mb-2.5 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Event Entrance Gates</span>
                </h3>
                
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1 mb-3">
                  {gates.length === 0 && <p className="text-xs text-slate-400 italic">No gates created yet.</p>}
                  {gates.map((g) => (
                    <div key={g._id} className="flex items-center justify-between text-xs p-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <span className="font-bold text-slate-800">📍 {g.name}</span>
                      <button
                        onClick={() => handleDeleteGate(g._id)}
                        className="text-red-400 hover:text-red-600 font-bold px-1 text-sm transition-colors"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={createGate} className="flex gap-1.5">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    placeholder="Gate Name (e.g. Gate A)"
                    value={newGateName}
                    onChange={(e) => setNewGateName(e.target.value)}
                    required
                  />
                  <button className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-bold transition-all px-3 shadow-sm shadow-indigo-100">
                    Add Post
                  </button>
                </form>
                {(gateError || gateSuccess) && (
                  <div className="mt-2 text-xs font-semibold">
                    {gateError && <p className="text-red-600">{gateError}</p>}
                    {gateSuccess && <p className="text-emerald-600">{gateSuccess}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats & Walk-in & Upload Cards Column */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 md:col-span-2 space-y-6">
            
            {/* Stats Dashboard */}
            <div>
              <h2 className="mb-3 text-sm font-bold text-slate-700 uppercase tracking-wider border-b pb-1.5 flex items-center gap-1.5">
                <span>📈</span>
                <span>Registration Stats</span>
              </h2>
              {stats ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <StatCard label="Total Registrations" value={stats.totalRegistrations} color="border-l-indigo-500" />
                  <StatCard label="Checked In" value={stats.checkedIn} color="border-l-emerald-500 animate-pulse" />
                  <StatCard label="Pending" value={stats.pending} color="border-l-amber-500" />
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Select an active event from the list to load metrics.</p>
              )}
            </div>

            {/* Bulk Upload CSV Card */}
            {selectedEventId && isAdmin && (
              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <span>📥</span>
                    <span>Bulk Import Attendees</span>
                  </label>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 transition-all"
                  >
                    Download CSV Template
                  </button>
                </div>
                
                <input
                  className="mt-2 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0]).catch((err) => setError(err.message))}
                />
                
                {bulkResult && (
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs border border-slate-100 shadow-sm space-y-2 animate-scale-up">
                    <p className="font-bold text-slate-800 border-b pb-1">Bulk Processing Report:</p>
                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <p>Total Records Evaluated: <strong className="text-slate-900">{bulkResult.totalRows}</strong></p>
                      <p>Successfully Imported: <strong className="text-emerald-600">{bulkResult.created}</strong></p>
                    </div>
                    
                    {bulkResult.errors?.length > 0 && (
                      <div className="pt-2 border-t mt-2">
                        <p className="font-bold text-red-600 mb-1">Skips & Failures ({bulkResult.errors.length}):</p>
                        <ul className="list-disc pl-4 space-y-1 max-h-24 overflow-y-auto text-slate-500">
                          {bulkResult.errors.map((err, i) => (
                            <li key={i}>
                              <span className="font-semibold text-slate-700">{err.email || "Row " + (i + 1)}</span>: <span className="text-red-500">{err.reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Walk-in Add Form */}
            {selectedEventId && isAdmin && (
              <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50 space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block border-b pb-1.5">
                  🚶 Walk-In Walkthrough Registration
                </label>
                <form className="grid gap-2 md:grid-cols-3" onSubmit={addManualAttendee}>
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                    placeholder="Full Name"
                    value={manualAttendee.name}
                    onChange={(e) => setManualAttendee({ ...manualAttendee, name: e.target.value })}
                    required
                  />
                  <input
                    className="rounded-lg border border-slate-200 bg-white p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                    type="email"
                    placeholder="Email Address"
                    value={manualAttendee.email}
                    onChange={(e) => setManualAttendee({ ...manualAttendee, email: e.target.value })}
                    required
                  />
                  <div className="flex gap-1.5">
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder:text-slate-400"
                      placeholder="Phone"
                      value={manualAttendee.phoneNumber}
                      onChange={(e) => setManualAttendee({ ...manualAttendee, phoneNumber: e.target.value })}
                    />
                    <button className="rounded-lg bg-emerald-700 hover:bg-emerald-600 transition-colors px-3 text-white text-xs font-bold">
                      Add
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* In-Frame Alerts Box */}
            {(attendeeError || attendeeSuccess) && (
              <div className="p-3 rounded-lg border text-xs font-semibold animate-scale-up flex items-center gap-1.5">
                {attendeeError && (
                  <div className="text-red-700 bg-red-50 border-red-150 flex items-center gap-1.5 w-full">
                    <span>⚠️</span>
                    <span>{attendeeError}</span>
                  </div>
                )}
                {attendeeSuccess && (
                  <div className="text-emerald-700 bg-emerald-50 border-emerald-150 flex items-center gap-1.5 w-full">
                    <span>✓</span>
                    <span>{attendeeSuccess}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Attendees List Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b pb-2">
            <span>📋</span>
            <span>Registered Attendees List</span>
          </h2>
          
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden sm:table-cell">Email Address</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Phone</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden lg:table-cell">Checked-In At</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 hidden md:table-cell">Gate</th>
                  <th className="p-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {attendees.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xs text-slate-400 italic">No registered attendees found.</td>
                  </tr>
                )}
                {attendees.map((attendee) => (
                  <tr key={attendee._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{attendee.name}</td>
                    <td className="p-3 text-slate-500 hidden sm:table-cell">{attendee.email}</td>
                    <td className="p-3 text-slate-400 hidden md:table-cell">{attendee.phoneNumber || "-"}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        attendee.isCheckedIn 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100 animate-pulse" 
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        {attendee.isCheckedIn ? "Checked In" : "Not Checked In"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 font-mono hidden lg:table-cell">
                      {attendee.isCheckedIn && attendee.checkedInAt
                        ? new Date(attendee.checkedInAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-3 text-slate-400 hidden md:table-cell">
                      {attendee.isCheckedIn && attendee.checkedInGate ? (
                        <span className="font-semibold text-slate-600">📍 {attendee.checkedInGate}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          onClick={() => setActiveAttendeeQr(attendee)}
                          className="rounded-lg bg-slate-150 text-slate-800 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold transition-all border border-slate-200 shadow-sm"
                        >
                          View QR
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleStartEdit(attendee)}
                            className="rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 text-xs font-bold transition-all border border-indigo-100"
                          >
                            Edit
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteAttendee(attendee._id)}
                            className="rounded-lg text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 text-xs font-bold transition-all border border-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent logs */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b pb-2">
            <span>📜</span>
            <span>Live Check-In Event Logs</span>
          </h2>
          
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 max-h-60 overflow-y-auto pr-1">
            {stats?.recentLogs?.length ? (
              stats.recentLogs.map((log) => (
                <div key={log._id} className="rounded-xl border border-slate-100 p-3 bg-slate-50/50 flex items-start gap-2.5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="font-bold text-slate-900">{log.attendeeName || log.attendeeId?.name || "Deleted Attendee"}</p>
                    <p className="text-slate-500 text-xs font-medium">{log.attendeeEmail || log.attendeeId?.email || "No email info"}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                      📅 {new Date(log.timestamp).toLocaleString()} {log.gateNumber ? `• Gate: ${log.gateNumber}` : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic col-span-3">No recent scan operations logged yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: QR Ticket Visual Modal */}
      {activeAttendeeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-scale-up overflow-hidden border border-slate-100">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-indigo-600" />
            <button
              onClick={() => setActiveAttendeeQr(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl transition-colors"
            >
              &times;
            </button>
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-950">Attendee QR Ticket</h3>
                <p className="text-xs text-slate-500 mt-0.5">Scannable gate kontrol pass</p>
              </div>

              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center relative">
                <div className="absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border-r border-slate-200 rounded-full" />
                <div className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border-l border-slate-200 rounded-full" />
                
                <p className="font-bold text-slate-800 text-sm">{activeAttendeeQr.name}</p>
                <p className="text-xs text-slate-400 font-medium mb-3.5">{activeAttendeeQr.email}</p>

                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                  <img src={activeAttendeeQr.qrCodeDataUrl} alt="Attendee QR Code" className="w-44 h-44" />
                </div>
                
                <p className="text-[10px] font-mono text-slate-400 select-all mt-4 uppercase tracking-wider bg-white border border-slate-200 rounded px-2.5 py-1">
                  ID: {activeAttendeeQr.ticketUuid.substring(0, 18)}...
                </p>
              </div>

              <div className="flex gap-2 pt-1.5">
                <a
                  href={activeAttendeeQr.qrCodeDataUrl}
                  download={`ticket-${activeAttendeeQr.name.replace(/\s+/g, "_")}.png`}
                  className="flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors px-3 py-2 text-xs font-bold text-white shadow-sm shadow-indigo-100 text-center"
                >
                  Download QR
                </a>
                <button
                  onClick={() => setActiveAttendeeQr(null)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Attendee Modal */}
      {editingAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-scale-up border border-slate-100 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <button
              type="button"
              onClick={() => setEditingAttendee(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl transition-colors"
            >
              &times;
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Edit Attendee</h3>
              <p className="text-xs text-slate-500">Update attendee ticket information</p>
            </div>

            <form onSubmit={handleUpdateAttendee} className="mt-4 space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              {editError && <p className="text-xs text-red-600 font-semibold">{editError}</p>}

              <div className="flex gap-2 text-sm pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors text-xs"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAttendee(null)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-50 transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl relative animate-scale-up border border-slate-100 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 to-indigo-500" />
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl transition-colors"
            >
              &times;
            </button>
            <div>
              <h3 className="text-lg font-bold text-slate-950">Edit User Account</h3>
              <p className="text-xs text-slate-500">Update account details for {editingUser.name}</p>
            </div>

            <form onSubmit={handleUpdateUser} className="mt-4 space-y-4">
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    value={editUserForm.name}
                    onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Account Role</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-semibold"
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                  >
                    <option value="staff">Staff (Scanner Access)</option>
                    <option value="admin">Admin (Full Access)</option>
                  </select>
                </div>
                {editUserForm.role === "staff" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Assigned Gate</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-semibold"
                      value={editUserForm.assignedGateId}
                      onChange={(e) => setEditUserForm({ ...editUserForm, assignedGateId: e.target.value })}
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
              </div>

              {editUserError && <p className="text-xs text-red-600 font-semibold">{editUserError}</p>}

              <div className="flex gap-2 text-sm pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2.5 font-bold text-white shadow-sm hover:bg-indigo-700 transition-colors text-xs"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-bold text-slate-700 hover:bg-slate-50 transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50/50 p-4 shadow-sm border-l-4 ${color}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
    </div>
  );
}
