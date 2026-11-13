import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import QRCode from "qrcode";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";
import { EventSwitcherModal } from "../components/EventSwitcherModal.jsx";

export function DashboardPage({ auth }) {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [stats, setStats] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [error, setError] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  const [manualAttendee, setManualAttendee] = useState({
    name: "",
    email: "",
    phoneNumber: ""
  });
  const [staffUsers, setStaffUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "event_staff",
    assignedGateId: "",
    assignedEventIds: [],
    companyId: ""
  });
  const [form, setForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "09:00",
    location: "",
    description: "",
    companyId: ""
  });
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    try {
      return localStorage.getItem("superadmin_selected_company_id") || "all";
    } catch {
      return "all";
    }
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
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phoneNumber: ""
  });
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
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "event_staff",
    assignedGateId: "",
    assignedEventIds: []
  });
  const [editUserError, setEditUserError] = useState("");

  // Map of attendee IDs to generated QR Data URLs
  const [attendeeQrMap, setAttendeeQrMap] = useState({});

  const isSuperAdmin = auth.user?.role === "super_admin";
  const isOwner = auth.user?.role === "owner";
  const isCoOwner = auth.user?.role === "co_owner";
  const isEventAdmin = auth.user?.role === "event_admin";
  const isStaff =
    auth.user?.role === "event_staff" || auth.user?.role === "staff";
  const isAdmin =
    isOwner ||
    isCoOwner ||
    isEventAdmin ||
    isSuperAdmin ||
    auth.user?.role === "admin";
  const canCreateEvent = isOwner || isCoOwner || isSuperAdmin;

  // Sync sidebar ?tab= navigation when arriving from another route
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (
      tabParam &&
      ["overview", "attendees", "gates", "events", "team"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  // Global keyboard shortcut ⌘K / Ctrl+K for Event Switcher
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcherModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function loadCompanies() {
    if (!isSuperAdmin) return;
    try {
      const list = await api("/api/companies", { token: auth.token });
      setCompanies(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  }

  async function loadEvents(overrideCompId) {
    try {
      const activeCompId =
        overrideCompId !== undefined ? overrideCompId : selectedCompanyId;
      const query =
        isSuperAdmin && activeCompId && activeCompId !== "all"
          ? `?companyId=${activeCompId}`
          : "";
      const list = await api(`/api/events${query}`, { token: auth.token });
      const safeList = Array.isArray(list) ? list : [];
      setEvents(safeList);

      setSelectedEventId((prev) => {
        const stillExists = safeList.some((e) => e._id === prev);
        if (stillExists) return prev;
        return safeList.length ? safeList[0]._id : "";
      });

      if (!safeList.length) {
        setStats(null);
        setAttendees([]);
        setGates([]);
      }
      return safeList;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }

  async function loadStaff(overrideCompId) {
    if (!isAdmin) return;
    try {
      const activeCompId =
        overrideCompId !== undefined ? overrideCompId : selectedCompanyId;
      const query =
        isSuperAdmin && activeCompId && activeCompId !== "all"
          ? `?companyId=${activeCompId}`
          : "";
      const staff = await api(`/api/auth/staff${query}`, { token: auth.token });
      setStaffUsers(Array.isArray(staff) ? staff : []);
    } catch (err) {
      console.error("Failed to load staff:", err);
      setStaffError(err.message);
    }
  }

  async function handleSelectCompany(newCompanyId) {
    setSelectedCompanyId(newCompanyId);
    try {
      if (newCompanyId && newCompanyId !== "all") {
        localStorage.setItem("superadmin_selected_company_id", newCompanyId);
      } else {
        localStorage.removeItem("superadmin_selected_company_id");
      }
    } catch (e) {
      console.error("Failed to persist selected company:", e);
    }
    await Promise.all([loadEvents(newCompanyId), loadStaff(newCompanyId)]);
  }

  useEffect(() => {
    if (isSuperAdmin) {
      loadCompanies();
    }
    loadEvents();
    loadStaff();
  }, [auth.token, isSuperAdmin]);

  async function loadEventDetails(eventId) {
    if (!eventId) return;
    try {
      const [s, a] = await Promise.all([
        api(`/api/events/${eventId}/stats`, { token: auth.token }),
        api(`/api/events/${eventId}/attendees`, { token: auth.token })
      ]);
      setStats(s);
      setAttendees(Array.isArray(a) ? a : []);
    } catch (err) {
      console.error("Failed to load event details:", err);
    }
  }

  async function loadGates(eventId) {
    if (!eventId) return;
    try {
      const list = await api(`/api/events/${eventId}/gates`, {
        token: auth.token
      });
      setGates(Array.isArray(list) ? list : []);
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

  // Generate QR codes on-demand only for currently visible attendees
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
            const payload =
              a.ticketUuid ||
              JSON.stringify({ attendeeId: a._id, eventId: a.eventId });
            try {
              const url = await QRCode.toDataURL(payload, {
                width: 200,
                margin: 1,
                color: { dark: "#34206F", light: "#ffffff" }
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

    return () => {
      isMounted = false;
    };
  }, [displayedAttendees]);

  // Infinite scroll listener for attendee list container
  function handleAttendeeScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 120) {
      if (visibleCount < filteredAttendees.length) {
        setVisibleCount((prev) =>
          Math.min(prev + pageSize, filteredAttendees.length)
        );
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
    if (
      !window.confirm(
        "Are you sure you want to delete this gate? All staff assigned to this gate will be unassigned."
      )
    )
      return;
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
      const combinedDateTime =
        form.date && form.time ? `${form.date}T${form.time}` : form.date;
      const targetCompany =
        form.companyId ||
        (selectedCompanyId !== "all" ? selectedCompanyId : undefined);
      const created = await api("/api/events", {
        token: auth.token,
        method: "POST",
        body: {
          title: form.title,
          date: combinedDateTime,
          location: form.location,
          description: form.description,
          companyId: targetCompany
        }
      });
      setForm({
        title: "",
        date: new Date().toISOString().split("T")[0],
        time: "09:00",
        location: "",
        description: "",
        companyId: ""
      });
      setEventSuccess("Event created successfully!");
      setCreateEventModalOpen(false);
      await loadEvents();
      if (isSuperAdmin) await loadCompanies();
      if (created && created._id) {
        setSelectedEventId(created._id);
      }
    } catch (err) {
      setEventError(err.message);
    }
  }

  async function handleDeleteEvent(eventId, eventTitle) {
    if (!canCreateEvent) return;
    if (
      !window.confirm(
        `Are you sure you want to delete event "${eventTitle}"? This will also remove attendees, gates, and storyboards for this event.`
      )
    )
      return;
    setEventError("");
    setEventSuccess("");
    try {
      await api(`/api/events/${eventId}`, {
        token: auth.token,
        method: "DELETE"
      });
      setEventSuccess(`Event "${eventTitle}" deleted successfully!`);
      const updatedList = await loadEvents();
      if (isSuperAdmin) await loadCompanies();
      if (selectedEventId === eventId) {
        setSelectedEventId(updatedList[0]?._id || "");
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
      const result = await api(
        `/api/events/${selectedEventId}/attendees/bulk`,
        {
          token: auth.token,
          method: "POST",
          formData: data
        }
      );
      setBulkResult(result);
      setAttendeeSuccess(
        `Import complete: ${result.created} attendees successfully imported.`
      );
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
      const targetCompany =
        staffForm.companyId ||
        (selectedCompanyId !== "all" ? selectedCompanyId : undefined);
      await api("/api/auth/staff", {
        token: auth.token,
        method: "POST",
        body: {
          ...staffForm,
          companyId: targetCompany
        }
      });
      const roleLabels = {
        owner: "Owner",
        co_owner: "Co-Owner",
        event_admin: "Event Admin",
        event_staff: "Event Staff",
        super_admin: "Super Admin"
      };
      const createdRole = roleLabels[staffForm.role] || "User";
      setStaffForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: isEventAdmin
          ? "event_staff"
          : isCoOwner
            ? "event_admin"
            : "event_staff",
        assignedGateId: "",
        assignedEventIds: [],
        companyId: ""
      });
      setStaffSuccess(`${createdRole} account created successfully!`);
      await loadStaff();
      if (isSuperAdmin) await loadCompanies();
    } catch (err) {
      setStaffError(err.message);
    }
  }

  function handleStartEditUser(user) {
    setEditingUser(user);
    setEditUserForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      companyId: user.companyId || "",
      assignedGateId: user.assignedGateId || "",
      assignedEventIds: (user.assignments || [])
        .map((a) => (a.eventId?._id || a.eventId)?.toString())
        .filter(Boolean)
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
      if (isSuperAdmin) await loadCompanies();
    } catch (err) {
      setEditUserError(err.message);
    }
  }

  async function handleDeleteUser(userId, userName) {
    if (auth.user?.id === userId) {
      alert(
        "For safety reasons, you cannot delete your own logged-in admin account!"
      );
      return;
    }
    if (
      !window.confirm(
        `Are you sure you want to delete the user account for "${userName}"? This action is permanent.`
      )
    )
      return;
    setStaffError("");
    setStaffSuccess("");
    try {
      await api(`/api/auth/staff/${userId}`, {
        token: auth.token,
        method: "DELETE"
      });
      setStaffSuccess(`User account for "${userName}" deleted successfully!`);
      await loadStaff();
      if (isSuperAdmin) await loadCompanies();
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
      await api(
        `/api/events/${selectedEventId}/attendees/${editingAttendee._id}`,
        {
          token: auth.token,
          method: "PUT",
          body: editForm
        }
      );
      setEditingAttendee(null);
      setAttendeeSuccess("Attendee updated successfully!");
      await loadEventDetails(selectedEventId);
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDeleteAttendee(attendeeId) {
    if (!selectedEventId) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this attendee? This action cannot be undone."
      )
    )
      return;
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
    const csvContent =
      "Name,Email,Phone Number\nJohn Doe,john.doe@example.com,+1234567890\nJane Smith,jane.smith@example.com,+9876543210\n";
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
        color: { dark: "#34206F", light: "#ffffff" }
      })
        .then((url) => setEventQrDataUrl(url))
        .catch((err) => console.error("Failed to generate event QR:", err));
    }
  }, [publicRegistrationUrl]);

  const checkedInPct =
    stats && stats.totalRegistrations > 0
      ? Math.round((stats.checkedIn / stats.totalRegistrations) * 100)
      : 0;
  const pendingPct =
    stats && stats.totalRegistrations > 0
      ? Math.max(0, 100 - checkedInPct)
      : 0;

  const dashboardTabs = [
    { id: "overview", label: "Overview", icon: "dashboard", show: true },
    {
      id: "attendees",
      label: "Attendees",
      icon: "users",
      badge: stats?.totalRegistrations,
      show: true
    },
    { id: "gates", label: "Gates", icon: "pin", show: true },
    { id: "events", label: "Events", icon: "calendar", show: isAdmin },
    { id: "team", label: "Team", icon: "shield", show: isAdmin }
  ].filter((t) => t.show);

  return (
    <AppShell
      auth={auth}
      pageTitle="Dashboard"
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onOpenCreateEvent={
        canCreateEvent ? () => setCreateEventModalOpen(true) : null
      }
      onOpenWalkIn={() => setWalkInSheetOpen(true)}
      onOpenBulkImport={() => setBulkImportSheetOpen(true)}
      onOpenSwitcher={() => setSwitcherModalOpen(true)}
      selectedEventTitle={selectedEvent?.title}
      companies={companies}
      selectedCompanyId={selectedCompanyId}
      onSelectCompany={handleSelectCompany}
    >
      <div className="flex-1 flex flex-col pb-24 md:pb-12 overflow-x-hidden">
        {/* Super Admin Global Organization Context Switcher Bar */}
        {isSuperAdmin && (
          <div className="bg-primary-soft/85 border-b border-pastel-lavender px-4 sm:px-6 py-2.5">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <div className="flex items-center gap-1.5 shrink-0 text-primary">
                  <Icon name="building" className="w-4 h-4" />
                  <span className="font-bold uppercase tracking-wider text-[11px]">
                    Organization View:
                  </span>
                </div>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => handleSelectCompany(e.target.value)}
                  className="bg-surface border border-theme text-heading font-semibold rounded-full px-3.5 py-1.5 min-h-[38px] text-xs focus:outline-none focus:border-primary cursor-pointer max-w-full sm:max-w-xs"
                >
                  <option value="all">All Companies (Global View)</option>
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.eventCount || 0} events · {c.staffCount || 0}{" "}
                      team)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCompanyId !== "all" ? (
                <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
                  <span className="text-xs text-body truncate">
                    Viewing data for:{" "}
                    <strong className="text-primary underline">
                      {companies.find((c) => c._id === selectedCompanyId)
                        ?.name || "Selected Company"}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectCompany("all")}
                    className="px-3 py-1.5 rounded-full bg-surface hover:bg-primary-tint text-primary border border-theme text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    title="Reset to All Companies"
                  >
                    Reset to All
                  </button>
                </div>
              ) : (
                <div className="text-xs text-muted font-medium hidden sm:block shrink-0">
                  <span>
                    Viewing all organizations across platform (
                    {companies.length} registered)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Event Switcher & Horizontally Scrollable Tab Bar */}
        <div className="bg-surface border-b border-theme px-4 sm:px-6 lg:px-8 pt-4">
          <div className="max-w-6xl mx-auto space-y-3.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Interactive Command Switcher Pill Trigger */}
              <button
                type="button"
                onClick={() => setSwitcherModalOpen(true)}
                className="flex-1 min-w-0 min-h-[48px] flex items-center justify-between rounded-full bg-primary-tint hover:bg-primary-soft/80 border border-theme px-4 py-2 text-sm font-semibold text-heading transition-all cursor-pointer group"
                title="Click or press ⌘K to search & switch events"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                  <span className="h-7 w-7 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0">
                    <Icon name="calendar" className="w-4 h-4" />
                  </span>
                  <span className="truncate font-bold text-primary">
                    {selectedEvent?.title || "Select Event..."}
                  </span>
                  {selectedEvent && (
                    <span className="text-xs font-medium text-muted hidden md:inline shrink-0">
                      (
                      {new Date(selectedEvent.date).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        }
                      )}
                      )
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline-block text-[11px] font-mono font-bold text-primary bg-surface px-2 py-0.5 rounded-full border border-theme">
                    ⌘K
                  </span>
                  <Icon
                    name="chevron-down"
                    className="w-4 h-4 text-primary shrink-0"
                  />
                </div>
              </button>

              {canCreateEvent && (
                <button
                  type="button"
                  onClick={() => setCreateEventModalOpen(true)}
                  className="ui-btn-pill min-h-[48px] px-5 shrink-0"
                >
                  <Icon name="plus" className="w-4 h-4" />
                  <span>New Event</span>
                </button>
              )}
            </div>

            {/* Horizontally Scrollable Lavender Pill Tab Bar with 2px Indigo Underline */}
            <div
              className="ui-tabs-bar border-b-0"
              role="tablist"
              aria-label="Dashboard Sections"
            >
              {dashboardTabs.map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(t.id)}
                    className={`ui-tab ${
                      active ? "ui-tab-active" : "ui-tab-inactive"
                    }`}
                  >
                    <Icon
                      name={t.icon}
                      className="w-4 h-4 text-primary shrink-0"
                      filled={active}
                    />
                    <span>{t.label}</span>
                    {t.badge !== undefined && t.badge !== null && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          active
                            ? "bg-primary text-white"
                            : "bg-primary-tint text-primary border border-theme"
                        }`}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Global Context Alerts Bar */}
        {(error || eventError || gateError || attendeeError || staffError) && (
          <div className="bg-danger-tint border-b border-danger/25 px-4 sm:px-6 py-3 text-sm font-semibold text-danger">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon name="alert" className="w-4 h-4 shrink-0" />
                <span>
                  {error ||
                    eventError ||
                    gateError ||
                    attendeeError ||
                    staffError}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setEventError("");
                  setGateError("");
                  setAttendeeError("");
                  setStaffError("");
                }}
                className="h-8 w-8 rounded-full hover:bg-danger/10 flex items-center justify-center text-danger cursor-pointer"
                aria-label="Dismiss error"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {(eventSuccess || gateSuccess || attendeeSuccess || staffSuccess) && (
          <div className="bg-success-tint border-b border-success/30 px-4 sm:px-6 py-3 text-sm font-semibold text-heading">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Icon
                  name="check-circle"
                  className="w-4 h-4 text-success shrink-0"
                />
                <span>
                  {eventSuccess ||
                    gateSuccess ||
                    attendeeSuccess ||
                    staffSuccess}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEventSuccess("");
                  setGateSuccess("");
                  setAttendeeSuccess("");
                  setStaffSuccess("");
                }}
                className="h-8 w-8 rounded-full hover:bg-surface/60 flex items-center justify-center text-muted hover:text-heading cursor-pointer"
                aria-label="Dismiss notification"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Main Workspace Canvas */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* TAB 1: OVERVIEW & EVENT HUB */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in">
              {/* Welcome Hero Card (28px radius, hero gradient, centered bold greeting + subtitle, full-width primary + secondary CTAs) */}
              <div className="ui-hero-card p-6 sm:p-8 text-center">
                <div className="max-w-xl mx-auto space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface/80 border border-theme text-xs font-bold text-primary">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    <span>
                      {selectedEvent
                        ? "Active Event Workspace"
                        : "EventQR Hub Workspace"}
                    </span>
                  </div>

                  <h1 className="text-[28px] sm:text-[36px] font-bold text-primary leading-tight">
                    Welcome, {auth.user?.name || "Organizer"}
                  </h1>

                  <p className="text-sm sm:text-base text-body leading-relaxed">
                    {selectedEvent
                      ? `Managing "${selectedEvent.title}" — register guests, validate QR passes, and generate AI event videos.`
                      : "Select or create an event workspace to start managing registrations, entrance gates, and AI video stories."}
                  </p>

                  <div className="max-w-md mx-auto pt-1 space-y-3">
                    {canCreateEvent ? (
                      <button
                        type="button"
                        onClick={() => setCreateEventModalOpen(true)}
                        className="ui-btn-primary w-full"
                      >
                        <Icon name="plus" className="w-5 h-5" />
                        <span>Create New Event</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWalkInSheetOpen(true)}
                        disabled={!selectedEvent}
                        className="ui-btn-primary w-full"
                      >
                        <Icon name="plus" className="w-5 h-5" />
                        <span>Register Walk-In Guest</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSwitcherModalOpen(true)}
                      className="ui-btn-secondary w-full border-primary/25 text-primary"
                    >
                      <Icon name="calendar" className="w-4 h-4 text-primary" />
                      <span>Switch Event Workspace (⌘K)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2-Column Grid of Pastel Quick-Action Cards */}
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pastel 1: Lavender — Walk-In Guest */}
                <button
                  type="button"
                  onClick={() =>
                    selectedEvent
                      ? setWalkInSheetOpen(true)
                      : canCreateEvent && setCreateEventModalOpen(true)
                  }
                  className="group relative text-left rounded-card bg-pastel-lavender/55 hover:bg-pastel-lavender/75 border border-pastel-lavender p-5 min-h-[156px] flex flex-col justify-between overflow-hidden transition-all cursor-pointer"
                >
                  <div className="pr-8">
                    <h3 className="text-base sm:text-lg font-bold text-heading leading-snug">
                      Walk-In Guest
                    </h3>
                    <p className="text-xs sm:text-[13px] text-body mt-1 leading-snug">
                      Instant pass &amp; QR registration
                    </p>
                  </div>
                  <Icon
                    name="users"
                    className="w-16 h-16 text-primary/12 absolute -bottom-2 right-10 pointer-events-none"
                  />
                  <span className="self-end mt-4 h-11 w-11 rounded-full bg-surface text-primary shadow-arrow flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <Icon name="arrow-up-right" className="w-5 h-5" />
                  </span>
                </button>

                {/* Pastel 2: Peach — Bulk Import */}
                <button
                  type="button"
                  onClick={() =>
                    selectedEvent
                      ? setBulkImportSheetOpen(true)
                      : canCreateEvent && setCreateEventModalOpen(true)
                  }
                  className="group relative text-left rounded-card bg-pastel-peach/70 hover:bg-pastel-peach border border-[#F3D2B8] p-5 min-h-[156px] flex flex-col justify-between overflow-hidden transition-all cursor-pointer"
                >
                  <div className="pr-8">
                    <h3 className="text-base sm:text-lg font-bold text-heading leading-snug">
                      Bulk Import
                    </h3>
                    <p className="text-xs sm:text-[13px] text-body mt-1 leading-snug">
                      Upload CSV or Excel roster
                    </p>
                  </div>
                  <Icon
                    name="upload"
                    className="w-16 h-16 text-primary/12 absolute -bottom-2 right-10 pointer-events-none"
                  />
                  <span className="self-end mt-4 h-11 w-11 rounded-full bg-surface text-primary shadow-arrow flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <Icon name="arrow-up-right" className="w-5 h-5" />
                  </span>
                </button>

                {/* Pastel 3: Mint — Entrance Scanner */}
                <Link
                  to="/scan"
                  className="group relative text-left rounded-card bg-pastel-mint/85 hover:bg-pastel-mint border border-[#CBE6DC] p-5 min-h-[156px] flex flex-col justify-between overflow-hidden transition-all"
                >
                  <div className="pr-8">
                    <h3 className="text-base sm:text-lg font-bold text-heading leading-snug">
                      Live Scanner
                    </h3>
                    <p className="text-xs sm:text-[13px] text-body mt-1 leading-snug">
                      Validate gate QR tickets
                    </p>
                  </div>
                  <Icon
                    name="scanner"
                    className="w-16 h-16 text-primary/12 absolute -bottom-2 right-10 pointer-events-none"
                  />
                  <span className="self-end mt-4 h-11 w-11 rounded-full bg-surface text-primary shadow-arrow flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <Icon name="arrow-up-right" className="w-5 h-5" />
                  </span>
                </Link>

                {/* Pastel 4: Pale Blue-White — AI Story Studio */}
                <Link
                  to="/studio"
                  className="group relative text-left rounded-card bg-pastel-blue hover:bg-primary-soft/65 border border-theme p-5 min-h-[156px] flex flex-col justify-between overflow-hidden transition-all"
                >
                  <div className="pr-8">
                    <h3 className="text-base sm:text-lg font-bold text-heading leading-snug">
                      AI Story Studio
                    </h3>
                    <p className="text-xs sm:text-[13px] text-body mt-1 leading-snug">
                      Generate event song &amp; video
                    </p>
                  </div>
                  <Icon
                    name="sparkles"
                    className="w-16 h-16 text-primary/12 absolute -bottom-2 right-10 pointer-events-none"
                  />
                  <span className="self-end mt-4 h-11 w-11 rounded-full bg-surface text-primary shadow-arrow flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                    <Icon name="arrow-up-right" className="w-5 h-5" />
                  </span>
                </Link>
              </div>

              {/* Active Event Details & Registration QR */}
              {selectedEvent ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Event Details Card */}
                  <div className="lg:col-span-2 ui-card p-6 sm:p-7 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                            <span className="h-2 w-2 rounded-full bg-success" />
                            <span>Active Event Workspace</span>
                          </span>
                          {selectedEvent.companyId?.name && (
                            <span className="ui-chip bg-primary-tint border-theme text-heading">
                              <Icon
                                name="building"
                                className="w-3.5 h-3.5 text-primary"
                              />
                              <span>{selectedEvent.companyId.name}</span>
                            </span>
                          )}
                        </div>
                        <h2 className="text-2xl font-bold text-heading leading-snug">
                          {selectedEvent.title}
                        </h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm">
                      <div className="bg-primary-tint p-4 rounded-[18px] border border-theme flex items-center gap-3.5">
                        <span className="h-10 w-10 rounded-tile bg-primary-soft text-primary flex items-center justify-center shrink-0">
                          <Icon name="calendar" className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted font-medium">
                            Date &amp; Time
                          </p>
                          <p className="text-heading font-bold truncate">
                            {new Date(selectedEvent.date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="bg-primary-tint p-4 rounded-[18px] border border-theme flex items-center gap-3.5">
                        <span className="h-10 w-10 rounded-tile bg-primary-soft text-primary flex items-center justify-center shrink-0">
                          <Icon name="pin" className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs text-muted font-medium">
                            Location
                          </p>
                          <p className="text-heading font-bold truncate">
                            {selectedEvent.location}
                          </p>
                        </div>
                      </div>
                    </div>

                    {selectedEvent.description && (
                      <p className="text-body text-sm leading-relaxed bg-primary-tint/70 p-4 rounded-[18px] border border-theme">
                        {selectedEvent.description}
                      </p>
                    )}

                    {/* Registration Share Bar */}
                    <div className="space-y-2.5 pt-3 border-t border-theme">
                      <label className="text-sm font-bold text-heading flex items-center gap-2">
                        <Icon name="link" className="w-4 h-4 text-primary" />
                        <span>Public Guest Registration Link</span>
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <input
                          readOnly
                          value={publicRegistrationUrl}
                          className="ui-input-compact font-mono text-primary select-all truncate flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(publicRegistrationUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="ui-btn-primary-sm shrink-0"
                        >
                          <Icon
                            name={copiedLink ? "check" : "link"}
                            className="w-4 h-4"
                          />
                          <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Event QR Code Card */}
                  <div className="ui-card p-6 sm:p-7 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-heading">
                      <Icon name="qr" className="w-4 h-4 text-primary" />
                      <span>Registration QR Code</span>
                    </div>
                    {eventQrDataUrl ? (
                      <div className="p-4 bg-primary-tint rounded-card border border-pastel-lavender">
                        <img
                          src={eventQrDataUrl}
                          alt="Event Registration QR"
                          className="w-40 h-40 object-contain rounded-tile bg-surface p-1.5"
                        />
                      </div>
                    ) : (
                      <div className="w-44 h-44 bg-primary-tint rounded-card flex items-center justify-center text-xs text-muted animate-pulse font-semibold">
                        Generating QR...
                      </div>
                    )}
                    {eventQrDataUrl && (
                      <a
                        href={eventQrDataUrl}
                        download={`${(selectedEvent.title || "event")
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")}-registration-qr.png`}
                        className="ui-btn-secondary-sm text-primary border-pastel-lavender bg-primary-soft/50"
                      >
                        <Icon name="download" className="w-4 h-4" />
                        <span>Download Registration QR</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="ui-card p-8 text-center space-y-4">
                  <p className="text-muted text-sm font-medium">
                    {selectedCompanyId !== "all"
                      ? `No events found for ${
                          companies.find((c) => c._id === selectedCompanyId)
                            ?.name || "the selected company"
                        }.`
                      : "No events found in your workspace."}
                  </p>
                  {canCreateEvent && (
                    <button
                      type="button"
                      onClick={() => setCreateEventModalOpen(true)}
                      className="ui-btn-primary-sm"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Create Your First Event</span>
                    </button>
                  )}
                </div>
              )}

              {/* Check-In Summary Progress + Metrics + Recent Activity */}
              {stats && (
                <>
                  {/* Check-In Progress Summary Card (2px indigo border, primary-tint, rounded progress bar + legend) */}
                  <div className="rounded-card border-2 border-primary bg-primary-tint p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-heading">
                          Event Check-In Summary
                        </h3>
                        <p className="text-xs text-muted mt-0.5">
                          Live arrival progress across all registered attendees
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("attendees")}
                        className="ui-btn-secondary-sm self-start sm:self-center"
                      >
                        <span>View Roster</span>
                        <Icon name="arrow-right" className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted font-medium">
                          Checked-In Capacity
                        </span>
                        <span className="font-bold text-heading">
                          {stats.checkedIn} / {stats.totalRegistrations} Guests (
                          {checkedInPct}%)
                        </span>
                      </div>
                      <div className="h-3.5 w-full rounded-full bg-surface border border-theme overflow-hidden flex">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${checkedInPct}%` }}
                        />
                        <div
                          className="h-full bg-accent-violet/55 transition-all duration-500"
                          style={{ width: `${pendingPct}%` }}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-5 text-xs text-body pt-0.5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                          <span>Checked In ({stats.checkedIn})</span>
                        </span>
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="h-2.5 w-2.5 rounded-full bg-accent-violet" />
                          <span>Pending Arrival ({stats.pending})</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="bg-surface rounded-[18px] p-4 border border-theme flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted">
                            Total Registrations
                          </p>
                          <p className="text-2xl font-bold text-heading mt-1">
                            {stats.totalRegistrations}
                          </p>
                        </div>
                        <span className="h-11 w-11 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                          <Icon name="users" className="w-5 h-5" />
                        </span>
                      </div>
                      <div className="bg-surface rounded-[18px] p-4 border border-theme flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted">
                            Checked In
                          </p>
                          <p className="text-2xl font-bold text-success mt-1">
                            {stats.checkedIn}
                          </p>
                        </div>
                        <span className="h-11 w-11 rounded-tile bg-pastel-mint text-heading flex items-center justify-center">
                          <Icon name="check-circle" className="w-5 h-5" />
                        </span>
                      </div>
                      <div className="bg-surface rounded-[18px] p-4 border border-theme flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-muted">
                            Pending Arrival
                          </p>
                          <p className="text-2xl font-bold text-primary mt-1">
                            {stats.pending}
                          </p>
                        </div>
                        <span className="h-11 w-11 rounded-tile bg-pastel-peach text-heading flex items-center justify-center">
                          <Icon name="clock" className="w-5 h-5" />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section Heading ("My ..." style) + Existing Scan Logs */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-2xl font-bold text-heading">
                        My Recent Scan Activity
                      </h2>
                      <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                        {stats?.recentLogs?.length || 0} Scans Recorded
                      </span>
                    </div>

                    <div className="ui-card overflow-hidden">
                      {!stats?.recentLogs || stats.recentLogs.length === 0 ? (
                        <div className="p-8 text-center text-muted text-sm">
                          No check-in scan activity logged yet for this event.
                        </div>
                      ) : (
                        <div className="divide-y divide-theme max-h-[380px] overflow-y-auto">
                          {stats.recentLogs.map((log) => (
                            <div
                              key={log._id || log.id || log.timestamp}
                              className="p-4 hover:bg-primary-tint/50 transition-colors flex items-center justify-between gap-3 text-sm"
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                <span
                                  className={`shrink-0 h-10 w-10 rounded-tile flex items-center justify-center font-bold ${
                                    log.status === "GRANTED"
                                      ? "bg-pastel-mint text-heading border border-theme"
                                      : "bg-danger-tint text-danger border border-danger/25"
                                  }`}
                                >
                                  <Icon
                                    name={
                                      log.status === "GRANTED"
                                        ? "check"
                                        : "close"
                                    }
                                    className="w-4 h-4"
                                  />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-heading truncate">
                                      {log.attendeeId?.name || "Attendee"}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                        log.status === "GRANTED"
                                          ? "bg-pastel-mint text-heading"
                                          : "bg-danger-tint text-danger"
                                      }`}
                                    >
                                      {log.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted truncate mt-0.5">
                                    {log.attendeeId?.email || "No email"}{" "}
                                    {log.gateName
                                      ? `· Gate: ${log.gateName}`
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="font-mono text-xs font-bold text-heading">
                                  {new Date(log.timestamp).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit"
                                    }
                                  )}
                                </p>
                                <p className="text-[11px] text-muted">
                                  {new Date(log.timestamp).toLocaleDateString(
                                    [],
                                    {
                                      month: "short",
                                      day: "numeric"
                                    }
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDEES & HIGH-VOLUME SCALABLE ROSTER */}
          {activeTab === "attendees" && (
            <div className="space-y-5 animate-fade-in">
              {!selectedEvent ? (
                <div className="ui-card p-8 text-center space-y-4">
                  <p className="text-muted text-sm font-medium">
                    {isSuperAdmin && selectedCompanyId !== "all"
                      ? `No events found for ${
                          companies.find((c) => c._id === selectedCompanyId)
                            ?.name || "this company"
                        }. Please create an event to view and manage attendees.`
                      : "Please select or create an event to view and manage attendees."}
                  </p>
                  {canCreateEvent && (
                    <button
                      type="button"
                      onClick={() => setCreateEventModalOpen(true)}
                      className="ui-btn-primary-sm"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Create An Event</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Header & Quick Action Trigger Bar */}
                  <div className="ui-card p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                          <Icon name="search" className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search 100s of attendees by name, email, or phone..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="ui-input pl-10"
                        />
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setWalkInSheetOpen(true)}
                          className="flex-1 sm:flex-none ui-btn-primary-sm min-h-[50px]"
                        >
                          <Icon name="plus" className="w-4 h-4" />
                          <span>Walk-In Guest</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkImportSheetOpen(true)}
                          className="ui-btn-secondary-sm min-h-[50px]"
                        >
                          <Icon
                            name="upload"
                            className="w-4 h-4 text-primary"
                          />
                          <span>Bulk Import</span>
                        </button>
                      </div>
                    </div>

                    {/* Status Filter Pills & High-Volume Batch Selector */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-theme">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAttendeeFilter("all")}
                          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            attendeeFilter === "all"
                              ? "bg-primary-soft text-primary border border-primary/30"
                              : "bg-primary-tint text-muted hover:text-heading border border-theme"
                          }`}
                        >
                          All ({attendees.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendeeFilter("checked_in")}
                          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            attendeeFilter === "checked_in"
                              ? "bg-pastel-mint text-heading border border-success/40"
                              : "bg-primary-tint text-muted hover:text-heading border border-theme"
                          }`}
                        >
                          Checked In (
                          {attendees.filter((a) => a.isCheckedIn).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendeeFilter("pending")}
                          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            attendeeFilter === "pending"
                              ? "bg-pastel-peach text-heading border border-warning/40"
                              : "bg-primary-tint text-muted hover:text-heading border border-theme"
                          }`}
                        >
                          Pending (
                          {attendees.filter((a) => !a.isCheckedIn).length})
                        </button>
                      </div>

                      {/* Page Batch Size Control */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted font-medium">
                          Batch Size:
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className="ui-select-compact"
                        >
                          <option value={25}>25 per view</option>
                          <option value={50}>50 per view</option>
                          <option value={100}>100 per view</option>
                          <option value={250}>250 (All)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Attendee Roster List */}
                  <div className="ui-card overflow-hidden">
                    <div className="p-5 border-b border-theme flex items-center justify-between gap-3">
                      <h3 className="text-base font-bold text-heading flex items-center gap-2">
                        <Icon name="users" className="w-4 h-4 text-primary" />
                        <span>
                          Attendee Roster ({filteredAttendees.length} Total
                          Records)
                        </span>
                      </h3>
                      <span className="text-xs font-semibold text-muted">
                        Showing 1–{displayedAttendees.length} of{" "}
                        {filteredAttendees.length}
                      </span>
                    </div>

                    {filteredAttendees.length === 0 ? (
                      <div className="p-10 text-center text-muted text-sm">
                        No attendees matching your search/filter criteria.
                      </div>
                    ) : (
                      <div
                        ref={attendeeListContainerRef}
                        onScroll={handleAttendeeScroll}
                        className="divide-y divide-theme max-h-[600px] overflow-y-auto"
                      >
                        {displayedAttendees.map((a) => {
                          const qrUrl =
                            attendeeQrMap[a._id] || a.ticketQrDataUrl;

                          return (
                            <div
                              key={a._id}
                              className="p-4 sm:p-5 hover:bg-primary-tint/50 transition-colors flex items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-4 min-w-0 flex-1">
                                {/* Inline Attendee QR Code */}
                                {qrUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setActiveAttendeeQr(qrUrl)}
                                    className="shrink-0 group relative p-1.5 bg-surface rounded-tile border border-theme hover:border-primary transition-all cursor-pointer"
                                    title="Click to view full QR pass"
                                  >
                                    <img
                                      src={qrUrl}
                                      alt={`${a.name} QR`}
                                      className="w-14 h-14 object-contain rounded-lg"
                                    />
                                    <span className="absolute inset-0 bg-primary-soft/80 opacity-0 group-hover:opacity-100 rounded-tile transition-opacity flex items-center justify-center text-primary">
                                      <Icon
                                        name="search"
                                        className="w-4 h-4"
                                      />
                                    </span>
                                  </button>
                                ) : (
                                  <div className="shrink-0 w-16 h-16 bg-primary-tint rounded-tile border border-theme flex items-center justify-center text-[11px] text-muted font-semibold animate-pulse">
                                    Loading...
                                  </div>
                                )}

                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-heading text-base truncate">
                                      {a.name}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                        a.isCheckedIn
                                          ? "bg-pastel-mint text-heading"
                                          : "bg-pastel-peach text-heading"
                                      }`}
                                    >
                                      {a.isCheckedIn ? "Checked In" : "Pending"}
                                    </span>
                                  </div>
                                  <p className="text-sm text-body truncate">
                                    {a.email}
                                  </p>
                                  {a.phoneNumber && (
                                    <p className="text-xs text-muted font-mono">
                                      {a.phoneNumber}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Attendee Actions (>=44px touch targets) */}
                              <div className="flex items-center gap-2 shrink-0">
                                {qrUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveAttendeeQr(qrUrl)}
                                    className="hidden sm:inline-flex ui-btn-secondary-sm text-primary"
                                    title="Expand Ticket QR"
                                  >
                                    <Icon name="qr" className="w-4 h-4" />
                                    <span>Expand QR</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(a)}
                                  className="h-11 w-11 rounded-control bg-primary-tint hover:bg-primary-soft text-primary border border-theme flex items-center justify-center transition-colors cursor-pointer"
                                  title="Edit Attendee"
                                  aria-label={`Edit ${a.name}`}
                                >
                                  <Icon name="edit" className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttendee(a._id)}
                                  className="h-11 w-11 rounded-control bg-danger-tint hover:bg-danger/15 text-danger border border-danger/25 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Delete Attendee"
                                  aria-label={`Delete ${a.name}`}
                                >
                                  <Icon name="trash" className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Infinite Scroll / Load More Trigger */}
                        {visibleCount < filteredAttendees.length && (
                          <div className="p-5 bg-primary-tint/60 border-t border-theme text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setVisibleCount((prev) =>
                                  Math.min(
                                    prev + pageSize,
                                    filteredAttendees.length
                                  )
                                )
                              }
                              className="ui-btn-primary-sm"
                            >
                              <span>
                                Load Next{" "}
                                {Math.min(
                                  pageSize,
                                  filteredAttendees.length - visibleCount
                                )}{" "}
                                Attendees (Showing {visibleCount} of{" "}
                                {filteredAttendees.length})
                              </span>
                            </button>
                            <p className="text-xs text-muted mt-1.5">
                              Or scroll down to load automatically
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: GATES & CHECK-IN POSTS */}
          {activeTab === "gates" && (
            <div className="space-y-6 animate-fade-in">
              {!selectedEvent ? (
                <div className="ui-card p-8 text-center space-y-4">
                  <p className="text-muted text-sm font-medium">
                    {isSuperAdmin && selectedCompanyId !== "all"
                      ? `No events found for ${
                          companies.find((c) => c._id === selectedCompanyId)
                            ?.name || "this company"
                        }. Please create an event to view and manage entrance gates.`
                      : "Please select or create an event to view and manage entrance gates."}
                  </p>
                  {canCreateEvent && (
                    <button
                      type="button"
                      onClick={() => setCreateEventModalOpen(true)}
                      className="ui-btn-primary-sm"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Create An Event</span>
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Live Camera Scanner Launcher Hero Banner */}
                  <div className="ui-hero-card p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <span className="ui-chip bg-pastel-mint border-theme text-heading">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        <span>LIVE VALIDATOR</span>
                      </span>
                      <h2 className="text-2xl font-bold text-primary">
                        Entrance Camera Scanner
                      </h2>
                      <p className="text-sm text-body">
                        Scan physical or mobile QR passes at your entrance gates in real time.
                      </p>
                    </div>
                    <Link to="/scan" className="ui-btn-primary shrink-0">
                      <Icon name="scanner" className="w-5 h-5" />
                      <span>Open Live Scanner</span>
                    </Link>
                  </div>

                  {/* Gates Management Card */}
                  <div className="ui-card p-6 sm:p-7 space-y-5">
                    <div className="flex items-center justify-between border-b border-theme pb-4">
                      <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                        <Icon name="pin" className="w-5 h-5 text-primary" />
                        <span>Entrance Gates &amp; Posts ({gates.length})</span>
                      </h3>
                    </div>

                    <form
                      onSubmit={createGate}
                      className="flex flex-col sm:flex-row gap-3"
                    >
                      <input
                        type="text"
                        placeholder="New Gate Name (e.g. Gate 1, VIP Entrance)"
                        value={newGateName}
                        onChange={(e) => setNewGateName(e.target.value)}
                        className="ui-input flex-1"
                        required
                      />
                      <button
                        type="submit"
                        className="ui-btn-primary shrink-0"
                      >
                        <Icon name="plus" className="w-4 h-4" />
                        <span>Add Post</span>
                      </button>
                    </form>

                    <div className="space-y-2.5">
                      {gates.length === 0 && (
                        <p className="text-sm text-muted py-4 text-center">
                          No gates created for this event yet.
                        </p>
                      )}
                      {gates.map((g) => (
                        <div
                          key={g._id}
                          className="p-4 bg-primary-tint rounded-[18px] border border-theme flex items-center justify-between gap-3"
                        >
                          <span className="font-bold text-heading text-sm flex items-center gap-2.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-success" />
                            <span>{g.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteGate(g._id)}
                            className="ui-btn-danger min-h-[40px] px-3.5 py-1.5 text-xs"
                          >
                            <Icon name="trash" className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: TEAM & STAFF MANAGEMENT */}
          {activeTab === "team" && isAdmin && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create Staff Form Card */}
                <div className="ui-card p-6 sm:p-7 space-y-5">
                  <div className="flex items-center gap-2.5 border-b border-theme pb-4">
                    <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                      <Icon name="plus" className="w-4 h-4" />
                    </span>
                    <h3 className="text-lg font-bold text-heading">
                      {isEventAdmin ? "Add Event Staff" : "Add Team Member"}
                    </h3>
                  </div>

                  <form onSubmit={createStaffUser} className="space-y-4">
                    <div>
                      <label className="ui-label-sm">Full Name</label>
                      <input
                        className="ui-input"
                        placeholder="Full Name"
                        value={staffForm.name}
                        onChange={(e) =>
                          setStaffForm({ ...staffForm, name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="ui-label-sm">Email Address</label>
                      <input
                        className="ui-input"
                        placeholder="Email Address"
                        type="email"
                        value={staffForm.email}
                        onChange={(e) =>
                          setStaffForm({ ...staffForm, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="ui-label-sm">
                          Phone Number (Optional)
                        </label>
                        <input
                          className="ui-input"
                          placeholder="+1 (555) 000-0000"
                          type="tel"
                          value={staffForm.phone}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              phone: e.target.value
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="ui-label-sm">Temporary Password</label>
                        <input
                          className="ui-input"
                          placeholder="••••••••"
                          type="password"
                          value={staffForm.password}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              password: e.target.value
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div>
                        <label className="ui-label-sm">
                          Assign Company / Organization
                        </label>
                        <select
                          className="ui-select"
                          value={
                            staffForm.companyId ||
                            (selectedCompanyId !== "all"
                              ? selectedCompanyId
                              : "")
                          }
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              companyId: e.target.value
                            })
                          }
                        >
                          <option value="">
                            Auto-Assign (Based on Active Context or Global)
                          </option>
                          {companies.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="ui-label-sm">Select Role</label>
                        <select
                          className="ui-select"
                          value={staffForm.role}
                          onChange={(e) =>
                            setStaffForm({ ...staffForm, role: e.target.value })
                          }
                        >
                          <option value="event_staff">Role: Event Staff</option>
                          {(isOwner || isSuperAdmin) && (
                            <option value="co_owner">Role: Co-Owner</option>
                          )}
                          {(isOwner || isCoOwner || isSuperAdmin) && (
                            <option value="event_admin">
                              Role: Event Admin
                            </option>
                          )}
                          {isSuperAdmin && (
                            <option value="super_admin">
                              Role: Super Admin
                            </option>
                          )}
                        </select>
                      </div>

                      {staffForm.role === "event_staff" ? (
                        <div>
                          <label className="ui-label-sm">
                            Initial Post (Optional)
                          </label>
                          <select
                            className="ui-select"
                            value={staffForm.assignedGateId}
                            onChange={(e) =>
                              setStaffForm({
                                ...staffForm,
                                assignedGateId: e.target.value
                              })
                            }
                          >
                            <option value="">No Gate Assigned</option>
                            {gates.map((g) => (
                              <option key={g._id} value={g._id}>
                                Gate: {g.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center text-xs text-muted p-3.5 bg-primary-tint rounded-control border border-theme">
                          {staffForm.role === "co_owner" &&
                            "Co-Owners manage all company events & staff."}
                          {staffForm.role === "event_admin" &&
                            "Event Admins manage designated events below."}
                          {staffForm.role === "super_admin" &&
                            "Global system administrative permissions."}
                        </div>
                      )}
                    </div>

                    {/* Event Assignments Multi-Select */}
                    {(staffForm.role === "event_admin" ||
                      staffForm.role === "event_staff") &&
                      events.length > 0 && (
                        <div className="space-y-2 p-4 bg-primary-tint rounded-[18px] border border-theme">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-heading">
                              Assign to Events{" "}
                              {staffForm.role === "event_admin"
                                ? "(Required for Event Admin)"
                                : "(Optional)"}
                            </label>
                            <span className="text-xs text-primary font-semibold">
                              {staffForm.assignedEventIds?.length || 0} selected
                            </span>
                          </div>
                          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                            {events.map((ev) => {
                              const checked = (
                                staffForm.assignedEventIds || []
                              ).includes(ev._id);
                              return (
                                <label
                                  key={ev._id}
                                  className={`flex items-center gap-2.5 p-2 rounded-tile text-xs font-medium cursor-pointer transition-colors ${
                                    checked
                                      ? "bg-primary-soft text-primary font-bold border border-pastel-lavender"
                                      : "text-body hover:bg-surface"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const current =
                                        staffForm.assignedEventIds || [];
                                      const updated = e.target.checked
                                        ? [...current, ev._id]
                                        : current.filter((id) => id !== ev._id);
                                      setStaffForm({
                                        ...staffForm,
                                        assignedEventIds: updated
                                      });
                                    }}
                                    className="rounded accent-[#34206F]"
                                  />
                                  <span className="truncate">{ev.title}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    <button type="submit" className="ui-btn-primary w-full">
                      <Icon name="plus" className="w-4 h-4" />
                      <span>
                        {isEventAdmin
                          ? "Create Staff Account"
                          : "Add Team Member"}
                      </span>
                    </button>
                  </form>
                </div>

                {/* Staff Accounts List Card */}
                <div className="ui-card p-6 sm:p-7 space-y-5">
                  <div className="flex items-center gap-2.5 border-b border-theme pb-4">
                    <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                      <Icon name="shield" className="w-4 h-4" />
                    </span>
                    <h3 className="text-lg font-bold text-heading">
                      {isEventAdmin
                        ? "Assigned Event Staff Accounts"
                        : "Organization Team Directory"}{" "}
                      ({staffUsers.length})
                    </h3>
                  </div>

                  <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                    {staffUsers.length === 0 && (
                      <p className="text-muted text-sm py-6 text-center">
                        {isEventAdmin
                          ? "No staff accounts assigned to your events."
                          : "No team accounts found."}
                      </p>
                    )}
                    {staffUsers.map((staff) => {
                      const isStaffOwner = staff.role === "owner";
                      const isStaffCoOwner = staff.role === "co_owner";
                      const isSelf = auth.user?.id === staff.id;

                      let roleBadge = null;
                      if (isStaffOwner) {
                        roleBadge = (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-pastel-peach text-heading border border-theme">
                            Owner
                          </span>
                        );
                      } else if (isStaffCoOwner) {
                        roleBadge = (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-pastel-lavender text-primary border border-pastel-lavender">
                            Co-Owner
                          </span>
                        );
                      } else if (staff.role === "event_admin") {
                        roleBadge = (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-pastel-blue text-primary border border-theme">
                            Event Admin
                          </span>
                        );
                      } else if (staff.role === "super_admin") {
                        roleBadge = (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-primary text-white">
                            Super Admin
                          </span>
                        );
                      } else {
                        roleBadge = (
                          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-pastel-mint text-heading border border-theme">
                            Event Staff
                          </span>
                        );
                      }

                      const canEdit =
                        isOwner ||
                        isSuperAdmin ||
                        isSelf ||
                        (isCoOwner && !isStaffOwner && !isStaffCoOwner) ||
                        (isEventAdmin && staff.role === "event_staff");

                      const canDelete =
                        !isSelf &&
                        !isStaffOwner &&
                        (isOwner ||
                          isSuperAdmin ||
                          (isCoOwner && !isStaffCoOwner) ||
                          (isEventAdmin && staff.role === "event_staff"));

                      return (
                        <div
                          key={staff.id}
                          className="p-4 bg-primary-tint/75 rounded-[18px] border border-theme space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-bold text-heading text-sm">
                                {staff.name}
                              </span>
                              {roleBadge}
                              {isSuperAdmin && staff.companyName && (
                                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-surface text-body border border-theme">
                                  {staff.companyName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditUser(staff)}
                                  className="px-2.5 py-1 rounded-full bg-surface hover:bg-primary-soft text-xs font-bold text-primary border border-theme cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteUser(staff.id, staff.name)
                                  }
                                  className="px-2.5 py-1 rounded-full bg-danger-tint hover:bg-danger/15 text-xs font-bold text-danger border border-danger/25 cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-xs text-muted space-y-0.5">
                            <p>{staff.email}</p>
                            {staff.phone && <p>{staff.phone}</p>}
                          </div>

                          {staff.assignments && staff.assignments.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-theme">
                              <span className="text-[11px] font-semibold text-muted">
                                Assigned Events:
                              </span>
                              {staff.assignments.map((a, idx) => (
                                <span
                                  key={idx}
                                  className="bg-surface text-heading text-[11px] px-2.5 py-0.5 rounded-full border border-theme font-semibold"
                                >
                                  {a.eventTitle || "Event"}
                                </span>
                              ))}
                            </div>
                          )}

                          {(staff.role === "staff" ||
                            staff.role === "event_staff") && (
                            <div className="flex items-center gap-2.5 pt-2 border-t border-theme text-xs">
                              <span className="font-semibold text-muted">
                                Current Gate:
                              </span>
                              <select
                                value={staff.assignedGateId || ""}
                                onChange={(e) =>
                                  handleReassignGate(staff.id, e.target.value)
                                }
                                className="rounded-control bg-surface border border-theme px-3 py-1.5 min-h-[38px] text-xs text-heading font-semibold focus:outline-none focus:border-primary"
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

          {/* TAB 5: EVENTS DIRECTORY & MANAGEMENT WORKSPACE */}
          {activeTab === "events" && isAdmin && (
            <div className="space-y-6 animate-fade-in">
              {/* Header Title & Quick Search Bar */}
              <div className="ui-card p-6 sm:p-7 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
                  <div>
                    <h3 className="text-xl font-bold text-heading flex items-center gap-2.5">
                      <Icon name="calendar" className="w-5 h-5 text-primary" />
                      <span>Managed Events Directory</span>
                    </h3>
                    <p className="text-sm text-muted mt-1">
                      View, search, filter, and switch across all events in your account
                    </p>
                  </div>

                  {canCreateEvent && (
                    <button
                      type="button"
                      onClick={() => setCreateEventModalOpen(true)}
                      className="ui-btn-primary-sm self-start sm:self-center"
                    >
                      <Icon name="plus" className="w-4 h-4" />
                      <span>Create New Event</span>
                    </button>
                  )}
                </div>

                {/* Filters Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                      <Icon name="search" className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      placeholder="Filter events by title, venue, or date..."
                      value={eventSearchQuery}
                      onChange={(e) => {
                        setEventSearchQuery(e.target.value);
                        setEventDirectoryPage(1);
                      }}
                      className="ui-input pl-10 pr-10"
                    />
                    {eventSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEventSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-primary-tint flex items-center justify-center text-muted hover:text-heading cursor-pointer"
                        aria-label="Clear filter"
                      >
                        <Icon name="close" className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <select
                    value={eventDirectoryFilter}
                    onChange={(e) => {
                      setEventDirectoryFilter(e.target.value);
                      setEventDirectoryPage(1);
                    }}
                    className="ui-select sm:w-56"
                  >
                    <option value="all">All Events ({events.length})</option>
                    <option value="upcoming">Active &amp; Upcoming</option>
                    <option value="past">Past Events</option>
                  </select>
                </div>
              </div>

              {/* Events Directory Table */}
              <div className="ui-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-primary-tint border-b border-theme text-muted font-bold text-xs uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-5">Event Title</th>
                        {isSuperAdmin && (
                          <th className="py-4 px-5">Organization</th>
                        )}
                        <th className="py-4 px-5">Date &amp; Time</th>
                        <th className="py-4 px-5">Venue Location</th>
                        <th className="py-4 px-5">Status</th>
                        <th className="py-4 px-5">Public Pass Link</th>
                        <th className="py-4 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme">
                      {events.length === 0 ? (
                        <tr>
                          <td
                            colSpan={isSuperAdmin ? 7 : 6}
                            className="py-10 text-center text-muted text-sm"
                          >
                            No events found in your workspace.
                          </td>
                        </tr>
                      ) : (
                        events
                          .filter((ev) => {
                            const query = eventSearchQuery.trim().toLowerCase();
                            const matchesQuery =
                              !query ||
                              ev.title?.toLowerCase().includes(query) ||
                              ev.location?.toLowerCase().includes(query) ||
                              new Date(ev.date)
                                .toLocaleDateString()
                                .toLowerCase()
                                .includes(query);

                            if (!matchesQuery) return false;

                            const todayStr = new Date()
                              .toISOString()
                              .split("T")[0];
                            const evDateStr = new Date(ev.date)
                              .toISOString()
                              .split("T")[0];
                            if (eventDirectoryFilter === "upcoming")
                              return evDateStr >= todayStr;
                            if (eventDirectoryFilter === "past")
                              return evDateStr < todayStr;
                            return true;
                          })
                          .map((ev) => {
                            const isSelected = ev._id === selectedEventId;
                            const evDate = new Date(ev.date);
                            const todayStr = new Date()
                              .toISOString()
                              .split("T")[0];
                            const evDateStr = evDate
                              .toISOString()
                              .split("T")[0];
                            const isToday = evDateStr === todayStr;
                            const isPast = evDateStr < todayStr;

                            return (
                              <tr
                                key={ev._id}
                                className={
                                  isSelected
                                    ? "bg-primary-soft/55"
                                    : "hover:bg-primary-tint/45 transition-colors"
                                }
                              >
                                <td className="py-4 px-5">
                                  <span className="font-bold text-heading text-sm">
                                    {ev.title}
                                  </span>
                                  {ev.description && (
                                    <p className="text-xs text-muted truncate max-w-xs mt-0.5">
                                      {ev.description}
                                    </p>
                                  )}
                                </td>
                                {isSuperAdmin && (
                                  <td className="py-4 px-5 whitespace-nowrap">
                                    <span className="ui-chip bg-primary-tint border-theme text-heading">
                                      {ev.companyId?.name || "Unassigned"}
                                    </span>
                                  </td>
                                )}
                                <td className="py-4 px-5 font-semibold text-body whitespace-nowrap">
                                  {evDate.toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </td>
                                <td className="py-4 px-5 text-body max-w-xs truncate">
                                  {ev.location || "N/A"}
                                </td>
                                <td className="py-4 px-5 whitespace-nowrap">
                                  {isToday ? (
                                    <span className="px-3 py-1 rounded-full bg-pastel-mint text-heading text-xs font-bold">
                                      Live Today
                                    </span>
                                  ) : isPast ? (
                                    <span className="px-3 py-1 rounded-full bg-primary-tint text-muted text-xs font-semibold">
                                      Ended
                                    </span>
                                  ) : (
                                    <span className="px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-bold">
                                      Upcoming
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-5 whitespace-nowrap">
                                  {ev.publicSlug ? (
                                    <a
                                      href={`/#/register/${ev.publicSlug}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>Registration Page</span>
                                      <Icon
                                        name="arrow-up-right"
                                        className="w-3.5 h-3.5"
                                      />
                                    </a>
                                  ) : (
                                    <span className="text-muted">N/A</span>
                                  )}
                                </td>
                                <td className="py-4 px-5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedEventId(ev._id)}
                                      className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                          ? "bg-primary text-white"
                                          : "bg-surface hover:bg-primary-soft text-primary border border-theme"
                                      }`}
                                    >
                                      {isSelected ? "Active ✓" : "Switch Event"}
                                    </button>
                                    {canCreateEvent && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteEvent(ev._id, ev.title)
                                        }
                                        title="Delete Event"
                                        aria-label={`Delete ${ev.title}`}
                                        className="h-10 w-10 rounded-full bg-danger-tint hover:bg-danger/15 text-danger border border-danger/25 flex items-center justify-center transition-colors cursor-pointer"
                                      >
                                        <Icon
                                          name="trash"
                                          className="w-4 h-4"
                                        />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Walk-In Registration Modal / Bottom Sheet */}
        {walkInSheetOpen && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-surface border-t sm:border border-theme rounded-t-[28px] sm:rounded-container p-6 sm:p-7 shadow-soft animate-slide-up space-y-5">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                    <Icon name="users" className="w-4 h-4" />
                  </span>
                  <span>Walk-In Guest Registration</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setWalkInSheetOpen(false)}
                  className="h-10 w-10 rounded-tile bg-primary-tint hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={addManualAttendee} className="space-y-4">
                <div>
                  <label className="ui-label">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={manualAttendee.name}
                    onChange={(e) =>
                      setManualAttendee({
                        ...manualAttendee,
                        name: e.target.value
                      })
                    }
                    className="ui-input"
                    required
                  />
                </div>

                <div>
                  <label className="ui-label">Email Address</label>
                  <input
                    type="email"
                    placeholder="jane.doe@example.com"
                    value={manualAttendee.email}
                    onChange={(e) =>
                      setManualAttendee({
                        ...manualAttendee,
                        email: e.target.value
                      })
                    }
                    className="ui-input"
                    required
                  />
                </div>

                <div>
                  <label className="ui-label">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    value={manualAttendee.phoneNumber}
                    onChange={(e) =>
                      setManualAttendee({
                        ...manualAttendee,
                        phoneNumber: e.target.value
                      })
                    }
                    className="ui-input"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setWalkInSheetOpen(false)}
                    className="flex-1 ui-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 ui-btn-primary">
                    Register Guest
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bulk Import Modal / Bottom Sheet */}
        {bulkImportSheetOpen && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="w-full max-w-lg bg-surface border-t sm:border border-theme rounded-t-[28px] sm:rounded-container p-6 sm:p-7 shadow-soft animate-slide-up space-y-5">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                    <Icon name="upload" className="w-4 h-4" />
                  </span>
                  <span>Bulk Attendee Spreadsheet Import</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setBulkImportSheetOpen(false)}
                  className="h-10 w-10 rounded-tile bg-primary-tint hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-7 bg-primary-tint rounded-card border-2 border-dashed border-pastel-lavender text-center space-y-3">
                  <span className="mx-auto h-12 w-12 rounded-full bg-surface border border-theme text-primary flex items-center justify-center shadow-subtle">
                    <Icon name="upload" className="w-5 h-5" />
                  </span>
                  <p className="text-sm font-semibold text-heading">
                    Upload CSV or Excel (.xlsx, .xls) spreadsheet file
                  </p>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={(e) =>
                      e.target.files?.[0] && uploadCsv(e.target.files[0])
                    }
                    className="hidden"
                    id="bulk-file-input"
                  />
                  <label
                    htmlFor="bulk-file-input"
                    className="ui-btn-primary-sm inline-flex cursor-pointer"
                  >
                    Choose Spreadsheet File
                  </label>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-theme pt-4">
                  <span className="text-muted">Need standard formatting?</span>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="text-primary font-bold hover:underline cursor-pointer"
                  >
                    Download Sample CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        {createEventModalOpen && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-surface border border-theme rounded-container p-6 sm:p-7 shadow-soft space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                    <Icon name="plus" className="w-4 h-4" />
                  </span>
                  <span>Create New Event</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateEventModalOpen(false)}
                  className="h-10 w-10 rounded-tile bg-primary-tint hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={createEvent} className="space-y-4">
                {isSuperAdmin && (
                  <div>
                    <label className="ui-label-sm">
                      Target Organization / Company
                    </label>
                    <select
                      value={
                        form.companyId ||
                        (selectedCompanyId !== "all" ? selectedCompanyId : "")
                      }
                      onChange={(e) =>
                        setForm({ ...form, companyId: e.target.value })
                      }
                      className="ui-select"
                      required
                    >
                      <option value="">Select Target Company...</option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="ui-label-sm">Event Title</label>
                  <input
                    type="text"
                    placeholder="Event Title"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="ui-input"
                    required
                  />
                </div>

                {/* Event Date & Time Selector */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="ui-label-sm">Event Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onClick={(e) => e.target.showPicker?.()}
                        onChange={(e) =>
                          setForm({ ...form, date: e.target.value })
                        }
                        className="ui-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="ui-label-sm">Event Time</label>
                      <input
                        type="time"
                        value={form.time}
                        onClick={(e) => e.target.showPicker?.()}
                        onChange={(e) =>
                          setForm({ ...form, time: e.target.value })
                        }
                        className="ui-input"
                        required
                      />
                    </div>
                  </div>

                  {/* Quick Date Shortcuts */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs font-semibold text-muted">
                      Quick Preset:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          date: new Date().toISOString().split("T")[0]
                        })
                      }
                      className="px-3 py-1 rounded-full bg-primary-tint hover:bg-primary-soft text-xs font-semibold text-primary border border-theme transition-colors cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setForm({
                          ...form,
                          date: tomorrow.toISOString().split("T")[0]
                        });
                      }}
                      className="px-3 py-1 rounded-full bg-primary-tint hover:bg-primary-soft text-xs font-semibold text-primary border border-theme transition-colors cursor-pointer"
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setForm({
                          ...form,
                          date: nextWeek.toISOString().split("T")[0]
                        });
                      }}
                      className="px-3 py-1 rounded-full bg-primary-tint hover:bg-primary-soft text-xs font-semibold text-primary border border-theme transition-colors cursor-pointer"
                    >
                      Next Week
                    </button>
                  </div>
                </div>

                <div>
                  <label className="ui-label-sm">Location / Venue</label>
                  <input
                    type="text"
                    placeholder="Location / Venue"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    className="ui-input"
                    required
                  />
                </div>

                <div>
                  <label className="ui-label-sm">
                    Event Description (Optional)
                  </label>
                  <textarea
                    placeholder="Event Description (Optional)"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    rows={3}
                    className="ui-textarea resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateEventModalOpen(false)}
                    className="flex-1 ui-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 ui-btn-primary">
                    Create Event
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Attendee Ticket QR Preview Modal */}
        {activeAttendeeQr && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface border border-theme rounded-container p-6 sm:p-7 text-center space-y-5 max-w-xs w-full shadow-soft animate-scale-up">
              <h4 className="text-base font-bold text-primary">
                Attendee Ticket QR Pass
              </h4>
              <div className="p-4 bg-primary-tint rounded-card inline-block border border-pastel-lavender">
                <img
                  src={activeAttendeeQr}
                  alt="Ticket QR Pass"
                  className="w-48 h-48 object-contain rounded-tile bg-surface p-1.5"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveAttendeeQr(null)}
                className="ui-btn-primary w-full"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}

        {/* Edit Attendee Modal */}
        {editingAttendee && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-theme rounded-container p-6 sm:p-7 shadow-soft space-y-5 animate-scale-up">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                    <Icon name="edit" className="w-4 h-4" />
                  </span>
                  <span>Edit Attendee Profile</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingAttendee(null)}
                  className="h-10 w-10 rounded-tile bg-primary-tint hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateAttendee} className="space-y-4">
                <div>
                  <label className="ui-label-sm">Full Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                    className="ui-input"
                    required
                  />
                </div>
                <div>
                  <label className="ui-label-sm">Email Address</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    className="ui-input"
                    required
                  />
                </div>
                <div>
                  <label className="ui-label-sm">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phoneNumber}
                    onChange={(e) =>
                      setEditForm({ ...editForm, phoneNumber: e.target.value })
                    }
                    className="ui-input"
                  />
                </div>

                {editError && (
                  <p className="text-xs text-danger font-semibold">
                    {editError}
                  </p>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingAttendee(null)}
                    className="flex-1 ui-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 ui-btn-primary">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface border border-theme rounded-container p-6 sm:p-7 shadow-soft space-y-5 animate-scale-up max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-theme pb-4">
                <h3 className="text-lg font-bold text-primary flex items-center gap-2.5">
                  <span className="h-9 w-9 rounded-tile bg-primary-soft text-primary flex items-center justify-center">
                    <Icon name="shield" className="w-4 h-4" />
                  </span>
                  <span>Edit User Account</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="h-10 w-10 rounded-tile bg-primary-tint hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer"
                  aria-label="Close modal"
                >
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="ui-label-sm">Full Name</label>
                  <input
                    type="text"
                    value={editUserForm.name}
                    onChange={(e) =>
                      setEditUserForm({ ...editUserForm, name: e.target.value })
                    }
                    className="ui-input"
                    required
                  />
                </div>
                <div>
                  <label className="ui-label-sm">Email Address</label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) =>
                      setEditUserForm({
                        ...editUserForm,
                        email: e.target.value
                      })
                    }
                    className="ui-input"
                    required
                  />
                </div>
                <div>
                  <label className="ui-label-sm">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={editUserForm.phone || ""}
                    onChange={(e) =>
                      setEditUserForm({
                        ...editUserForm,
                        phone: e.target.value
                      })
                    }
                    className="ui-input"
                  />
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="ui-label-sm">
                      Company / Organization
                    </label>
                    <select
                      value={editUserForm.companyId || ""}
                      onChange={(e) =>
                        setEditUserForm({
                          ...editUserForm,
                          companyId: e.target.value
                        })
                      }
                      className="ui-select"
                    >
                      <option value="">No Company Assigned (Global)</option>
                      {companies.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="ui-label-sm">Account Role</label>
                  {editingUser.role === "owner" ? (
                    <div className="w-full min-h-[52px] rounded-control bg-primary-tint border border-theme px-4 py-3 text-sm font-semibold text-muted flex items-center gap-2">
                      <Icon name="shield" className="w-4 h-4 text-primary" />
                      <span>Company Owner (Fixed Role — cannot be changed)</span>
                    </div>
                  ) : isEventAdmin ? (
                    <div className="w-full min-h-[52px] rounded-control bg-primary-tint border border-theme px-4 py-3 text-sm font-semibold text-muted flex items-center gap-2">
                      <Icon name="scanner" className="w-4 h-4 text-primary" />
                      <span>Event Staff (Scanner Access)</span>
                    </div>
                  ) : (
                    <select
                      value={editUserForm.role}
                      onChange={(e) =>
                        setEditUserForm({
                          ...editUserForm,
                          role: e.target.value
                        })
                      }
                      className="ui-select"
                    >
                      {(isOwner || isSuperAdmin) && (
                        <option value="co_owner">
                          Co-Owner (Company-Wide Management)
                        </option>
                      )}
                      <option value="event_admin">
                        Event Admin (Designated Events)
                      </option>
                      <option value="event_staff">
                        Event Staff (Ticket Scanner)
                      </option>
                      {isSuperAdmin && (
                        <option value="super_admin">
                          Super Admin (Global System Access)
                        </option>
                      )}
                    </select>
                  )}
                </div>

                {/* Event Assignments Multi-Select */}
                {(editUserForm.role === "event_admin" ||
                  editUserForm.role === "event_staff") &&
                  events.length > 0 && (
                    <div className="space-y-2 p-4 bg-primary-tint rounded-[18px] border border-theme">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-heading">
                          Assign to Events{" "}
                          {editUserForm.role === "event_admin"
                            ? "(Required for Event Admin)"
                            : "(Optional)"}
                        </label>
                        <span className="text-xs text-primary font-semibold">
                          {editUserForm.assignedEventIds?.length || 0} selected
                        </span>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                        {events.map((ev) => {
                          const checked = (
                            editUserForm.assignedEventIds || []
                          ).includes(ev._id);
                          return (
                            <label
                              key={ev._id}
                              className={`flex items-center gap-2.5 p-2 rounded-tile text-xs font-medium cursor-pointer transition-colors ${
                                checked
                                  ? "bg-primary-soft text-primary font-bold border border-pastel-lavender"
                                  : "text-body hover:bg-surface"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const current =
                                    editUserForm.assignedEventIds || [];
                                  const updated = e.target.checked
                                    ? [...current, ev._id]
                                    : current.filter((id) => id !== ev._id);
                                  setEditUserForm({
                                    ...editUserForm,
                                    assignedEventIds: updated
                                  });
                                }}
                                className="rounded accent-[#34206F]"
                              />
                              <span className="truncate">{ev.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {editUserForm.role === "event_staff" && (
                  <div>
                    <label className="ui-label-sm">
                      Assigned Gate Post (Optional)
                    </label>
                    <select
                      value={editUserForm.assignedGateId || ""}
                      onChange={(e) =>
                        setEditUserForm({
                          ...editUserForm,
                          assignedGateId: e.target.value
                        })
                      }
                      className="ui-select"
                    >
                      <option value="">No Gate Assigned (Default)</option>
                      {gates.map((g) => (
                        <option key={g._id} value={g._id}>
                          Gate: {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editUserError && (
                  <p className="text-xs text-danger font-semibold">
                    {editUserError}
                  </p>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 ui-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 ui-btn-primary">
                    Update Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mobile Bottom Tab Bar (Lavender Pill Active State) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-theme py-2 px-2 flex items-center justify-around md:hidden shadow-soft"
          aria-label="Mobile Dashboard Sections"
        >
          {dashboardTabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[46px] flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all relative cursor-pointer ${
                  active
                    ? "bg-primary-soft text-primary font-bold"
                    : "text-muted hover:text-heading font-medium"
                }`}
              >
                <div className="relative">
                  <Icon name={t.icon} className="w-4 h-4" filled={active} />
                  {t.badge > 0 && (
                    <span className="absolute -top-1.5 -right-3 bg-primary text-white text-[9px] font-bold h-4 min-w-4 px-1 rounded-full flex items-center justify-center">
                      {t.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-none">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Event Switcher Command Palette Modal */}
        <EventSwitcherModal
          isOpen={switcherModalOpen}
          onClose={() => setSwitcherModalOpen(false)}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(eventId) => setSelectedEventId(eventId)}
          onOpenCreateModal={
            canCreateEvent ? () => setCreateEventModalOpen(true) : null
          }
        />
      </div>
    </AppShell>
  );
}
