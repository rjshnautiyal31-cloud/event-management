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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Event Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          <Link to="/scan" className="rounded bg-emerald-700 hover:bg-emerald-600 transition-colors px-3 py-2 text-sm font-semibold text-white shadow-sm text-center">
            Scanner
          </Link>
          <button 
            className="rounded bg-slate-900 hover:bg-slate-800 transition-colors px-3 py-2 text-sm font-semibold text-white shadow-sm text-center" 
            onClick={auth.logout}
          >
            Logout
          </button>
        </div>
      </div>

      {isAdmin && (
        <form className="grid gap-2 rounded bg-white p-4 shadow md:grid-cols-4" onSubmit={createEvent}>
          <input
            className="rounded border p-2"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="rounded border p-2"
            type="datetime-local"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <input
            className="rounded border p-2"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
          />
          <button className="rounded bg-blue-600 px-3 py-2 text-white">Create Event</button>
          <textarea
            className="rounded border p-2 md:col-span-4"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {eventError && <p className="text-sm text-red-600 md:col-span-4 font-medium">{eventError}</p>}
          {eventSuccess && <p className="text-sm text-emerald-600 md:col-span-4 font-medium">{eventSuccess}</p>}
        </form>
      )}

      {isAdmin && (
        <div className="grid gap-4 rounded bg-white p-4 shadow md:grid-cols-2">
          <form className="space-y-2" onSubmit={createStaffUser}>
            <h2 className="font-semibold text-slate-800">Create System User Account</h2>
            <input
              className="w-full rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="Full name"
              value={staffForm.name}
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              required
            />
            <input
              className="w-full rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="Email address"
              type="email"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              required
            />
            <input
              className="w-full rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
              placeholder="Password"
              type="password"
              value={staffForm.password}
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="w-full rounded border p-2 text-sm bg-white focus:ring-1 focus:ring-blue-500"
                value={staffForm.role}
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
              >
                <option value="staff">Role: Staff</option>
                <option value="admin">Role: Admin</option>
              </select>
              
              {staffForm.role === "staff" && (
                <select
                  className="w-full rounded border p-2 text-sm bg-white focus:ring-1 focus:ring-blue-500"
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
            <button className="rounded bg-indigo-700 hover:bg-indigo-600 transition-colors px-3 py-2 text-sm text-white font-medium shadow-sm">
              Create User
            </button>
            {staffError && <p className="text-sm text-red-600 font-medium">{staffError}</p>}
            {staffSuccess && <p className="text-sm text-emerald-600 font-medium">{staffSuccess}</p>}
          </form>

          <div>
            <h2 className="mb-2 font-semibold text-slate-800">System User Accounts</h2>
            <div className="space-y-2 text-sm max-h-[300px] overflow-y-auto pr-1">
              {staffUsers.length === 0 && <p className="text-slate-500">No staff users yet.</p>}
              {staffUsers.map((staff) => (
                <div key={staff.id} className="rounded border p-2 bg-slate-50/50 flex items-center justify-between">
                  <div className="space-y-1">
                    <div>
                      <span className="font-semibold text-slate-800">{staff.name}</span>
                      <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        staff.role === "admin"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          : "bg-slate-100 text-slate-800 border border-slate-200"
                      }`}>
                        {staff.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs">{staff.email}</p>
                    
                    {staff.role === "staff" && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-1">
                        <span>Assign Gate:</span>
                        <select
                          value={staff.assignedGateId || ""}
                          onChange={(e) => handleReassignGate(staff.id, e.target.value)}
                          className="rounded border border-slate-300 bg-white p-0.5 text-slate-700 text-[11px]"
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
                  
                  {staff.role === "staff" && staff.assignedGateName && (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 border border-emerald-100">
                      📍 {staff.assignedGateName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-4">
          <div className="rounded bg-white p-4 shadow">
            <h2 className="mb-2 font-semibold">Events</h2>
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event._id}
                  onClick={() => setSelectedEventId(event._id)}
                  className={`w-full rounded border px-2 py-1 text-left text-sm ${
                    selectedEventId === event._id ? "bg-slate-100" : ""
                  }`}
                >
                  {event.title}
                </button>
              ))}
            </div>
            {selectedEvent && (
              <p className="mt-3 text-xs text-slate-600">
                Public form: <code>/register/{selectedEvent.publicSlug}</code>
              </p>
          )}
          </div>

          {selectedEventId && isAdmin && (
            <div className="rounded bg-white p-4 shadow border border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-1.5 mb-2">Event Gates Management</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {gates.length === 0 && <p className="text-xs text-slate-400">No gates created for this event yet.</p>}
                {gates.map((g) => (
                  <div key={g._id} className="flex items-center justify-between text-xs p-1.5 rounded border bg-slate-50/50">
                    <span className="font-medium text-slate-800">📍 {g.name}</span>
                    <button
                      onClick={() => handleDeleteGate(g._id)}
                      className="text-red-500 hover:text-red-700 font-bold px-1 text-sm"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={createGate} className="mt-3 flex gap-2">
                <input
                  className="flex-1 rounded border p-1 text-xs focus:ring-1 focus:ring-blue-500"
                  placeholder="Gate Name (e.g. VIP Gate)"
                  value={newGateName}
                  onChange={(e) => setNewGateName(e.target.value)}
                  required
                />
                <button className="rounded bg-blue-600 hover:bg-blue-500 px-2 py-1 text-xs text-white font-medium transition-colors">
                  Add Gate
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

        <div className="rounded bg-white p-4 shadow md:col-span-2">
          <h2 className="mb-2 font-semibold">Registration Stats</h2>
          {stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <StatCard label="Total" value={stats.totalRegistrations} />
              <StatCard label="Checked In" value={stats.checkedIn} />
              <StatCard label="Pending" value={stats.pending} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an event</p>
          )}

          {selectedEventId && isAdmin && (
            <div className="mt-4 rounded border p-3 bg-slate-50/50">
              <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                <label className="text-sm font-semibold text-slate-800">Bulk Upload (CSV or Excel)</label>
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                >
                  📥 Download Sample CSV
                </button>
              </div>
              <input
                className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0]).catch((err) => setError(err.message))}
              />
              {bulkResult && (
                <div className="mt-3 rounded bg-white p-3 text-xs border border-slate-200 shadow-sm space-y-2">
                  <p className="font-semibold text-slate-800 border-b pb-1">Import Report Summary:</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-600">
                    <p>Total Rows Found: <strong>{bulkResult.totalRows}</strong></p>
                    <p>Successfully Created: <strong className="text-emerald-700">{bulkResult.created}</strong></p>
                  </div>
                  
                  {bulkResult.errors?.length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <p className="font-semibold text-red-600 mb-1">Row Failures ({bulkResult.errors.length}):</p>
                      <ul className="list-disc pl-4 space-y-1 max-h-36 overflow-y-auto text-slate-500">
                        {bulkResult.errors.map((err, i) => (
                          <li key={i}>
                            <span className="font-medium text-slate-700">{err.email || "Unknown Row"}</span>: <span className="text-red-500">{err.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {bulkResult.totalRows === 0 && (
                    <p className="text-amber-600 font-medium mt-1">
                      ⚠️ No rows were imported. Please check that your CSV columns are named exactly "name", "email", and "phone".
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedEventId && isAdmin && (
            <form className="mt-4 grid gap-2 rounded border p-3 md:grid-cols-3" onSubmit={addManualAttendee}>
              <input
                className="rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
                placeholder="Walk-in Name"
                value={manualAttendee.name}
                onChange={(e) => setManualAttendee({ ...manualAttendee, name: e.target.value })}
                required
              />
              <input
                className="rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
                type="email"
                placeholder="Walk-in Email"
                value={manualAttendee.email}
                onChange={(e) => setManualAttendee({ ...manualAttendee, email: e.target.value })}
                required
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded border p-2 text-sm focus:ring-1 focus:ring-blue-500"
                  placeholder="Phone"
                  value={manualAttendee.phoneNumber}
                  onChange={(e) => setManualAttendee({ ...manualAttendee, phoneNumber: e.target.value })}
                />
                <button className="rounded bg-emerald-700 hover:bg-emerald-600 transition-colors px-3 py-2 text-white font-medium text-sm">Add</button>
              </div>
            </form>
          )}

          {(attendeeError || attendeeSuccess) && (
            <div className="mt-3 p-2 rounded text-sm font-medium">
              {attendeeError && <p className="text-red-600">{attendeeError}</p>}
              {attendeeSuccess && <p className="text-emerald-600">{attendeeSuccess}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="rounded bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Attendees</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left hidden sm:table-cell">Email</th>
                <th className="p-2 text-left hidden md:table-cell">Phone</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left hidden lg:table-cell">Checked-in At</th>
                <th className="p-2 text-left hidden md:table-cell">Gate</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <tr key={attendee._id} className="border-b">
                  <td className="p-2 font-semibold text-slate-900">{attendee.name}</td>
                  <td className="p-2 text-slate-600 hidden sm:table-cell">{attendee.email}</td>
                  <td className="p-2 text-slate-500 hidden md:table-cell">{attendee.phoneNumber || "-"}</td>
                  <td className="p-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      attendee.isCheckedIn ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-800"
                    }`}>
                      {attendee.isCheckedIn ? "Checked In" : "Not Checked In"}
                    </span>
                  </td>
                  <td className="p-2 text-slate-500 font-mono hidden lg:table-cell">
                    {attendee.isCheckedIn && attendee.checkedInAt
                      ? new Date(attendee.checkedInAt).toLocaleString()
                      : "-"}
                  </td>
                  <td className="p-2 text-slate-500 hidden md:table-cell">
                    {attendee.isCheckedIn && attendee.checkedInGate
                      ? attendee.checkedInGate
                      : attendee.isCheckedIn
                      ? "Default"
                      : "-"}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setActiveAttendeeQr(attendee)}
                        className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800 transition-colors"
                      >
                        View QR
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleStartEdit(attendee)}
                          className="rounded bg-blue-50 hover:bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteAttendee(attendee._id)}
                          className="rounded bg-red-50 hover:bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 transition-colors"
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

      <div className="rounded bg-white p-4 shadow">
        <h2 className="mb-2 font-semibold">Recent Check-ins</h2>
        {stats?.recentLogs?.length ? (
          <div className="space-y-2 text-sm">
            {stats.recentLogs.map((log) => (
              <div key={log._id} className="rounded border p-2 bg-slate-50/50">
                <p className="font-semibold text-slate-900">{log.attendeeName || log.attendeeId?.name || "Deleted Attendee"}</p>
                <p className="text-slate-600 text-xs">{log.attendeeEmail || log.attendeeId?.email || "No email info"}</p>
                <p className="text-slate-500 text-xs font-medium mt-1">
                  📅 {new Date(log.timestamp).toLocaleString()} {log.gateNumber ? `(Gate: ${log.gateNumber})` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No check-ins yet.</p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {activeAttendeeQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl relative">
            <button
              onClick={() => setActiveAttendeeQr(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl"
            >
              &times;
            </button>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-950">Attendee QR Ticket</h3>
              <p className="mt-1 text-sm text-slate-600 font-medium">{activeAttendeeQr.name}</p>
              <p className="text-xs text-slate-500">{activeAttendeeQr.email}</p>
              
              <div className="my-4 flex justify-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                <img src={activeAttendeeQr.qrCodeDataUrl} alt="Attendee QR Code" className="w-48 h-48" />
              </div>
              
              <p className="text-xs font-mono text-slate-500 select-all mb-4">
                Ticket ID: {activeAttendeeQr.ticketUuid}
              </p>

              <div className="flex gap-2">
                <a
                  href={activeAttendeeQr.qrCodeDataUrl}
                  download={`ticket-${activeAttendeeQr.name.replace(/\s+/g, "_")}.png`}
                  className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors text-center"
                >
                  Download QR
                </a>
                <button
                  onClick={() => setActiveAttendeeQr(null)}
                  className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAttendee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded bg-white p-6 shadow-xl relative animate-scale-up">
            <button
              type="button"
              onClick={() => setEditingAttendee(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-xl"
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
                  <input
                    className="w-full rounded border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                  <input
                    className="w-full rounded border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                  <input
                    className="w-full rounded border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              {editError && <p className="text-xs text-red-600 font-semibold">{editError}</p>}

              <div className="flex gap-2 text-sm pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded bg-blue-600 px-3 py-2 font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAttendee(null)}
                  className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
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

function StatCard({ label, value }) {
  return (
    <div className="rounded border p-3">
      <p className="text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}

