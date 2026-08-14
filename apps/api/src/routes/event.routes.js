import express from "express";
import multer from "multer";
import { requireAuth, requireRole, requireEventAccess } from "../middleware/auth.js";
import { Event } from "../models/Event.js";
import { Attendee } from "../models/Attendee.js";
import { EntryLog } from "../models/EntryLog.js";
import { Gate } from "../models/Gate.js";
import { User } from "../models/User.js";
import { EventAssignment } from "../models/EventAssignment.js";
import { parseAttendeeCsv, parseAttendeeSpreadsheet } from "../utils/csv.js";
import { registerAttendee } from "../services/attendeeService.js";
const upload = multer({ storage: multer.memoryStorage() });
export const eventRouter = express.Router();
eventRouter.use(requireAuth);
/**
 * @openapi
 * /api/events:
 *   post:
 *     tags: [Events]
 *     summary: Create a new event (admin only)
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date, location]
 *             properties:
 *               title:       { type: string, example: "Tech Summit 2026" }
 *               date:        { type: string, format: date-time, example: "2026-09-01T09:00:00Z" }
 *               location:    { type: string, example: "Mumbai Convention Centre" }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Event created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Event' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin role required }
 *   get:
 *     tags: [Events]
 *     summary: List all events (sorted by date)
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Array of events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Event' }
 */
eventRouter.post("/", requireRole("admin"), async (req, res) => {
  const { title, date, location, description } = req.body;
  const normalizedTitle = String(title || "").trim();
  const normalizedLocation = String(location || "").trim();
  const parsedDate = new Date(date);

  if (!normalizedTitle || !normalizedLocation || Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "title, valid date, and location are required" });
  }

  const slugBase = String(normalizedTitle || "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const publicSlug = `${slugBase}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = req.user.id || req.user.sub;
  const event = await Event.create({
    title: normalizedTitle,
    date: parsedDate,
    location: normalizedLocation,
    description: String(description || "").trim(),
    publicSlug,
    createdBy: userId
  });

  // Automatically assign creator as event_admin
  await EventAssignment.create({
    userId,
    eventId: event._id,
    role: "event_admin"
  });

  res.status(201).json(event);
});

eventRouter.get("/", async (req, res) => {
  const userId = req.user.id || req.user.sub;
  const userRole = req.user.role;

  // Super admin / legacy admin gets all events
  if (userRole === "super_admin" || userRole === "admin") {
    const events = await Event.find().sort({ date: 1 }).lean();
    return res.json(events);
  }

  // Event admin / event staff gets assigned events only
  const assignments = await EventAssignment.find({ userId }).select("eventId").lean();
  const eventIds = assignments.map((a) => a.eventId);
  const events = await Event.find({ _id: { $in: eventIds } }).sort({ date: 1 }).lean();
  return res.json(events);
});
/**
 * @openapi
 * /api/events/{eventId}/stats:
 *   get:
 *     tags: [Events]
 *     summary: Registration and check-in statistics for an event
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId of the event
 *     responses:
 *       200:
 *         description: Stats including totals and 20 most recent check-in logs
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EventStats' }
 *       401: { description: Unauthorized }
 */
eventRouter.get("/:eventId/stats", requireEventAccess(["event_admin", "event_staff"]), async (req, res) => {
  const [total, checkedIn, logs] = await Promise.all([
    Attendee.countDocuments({ eventId: req.params.eventId }),
    Attendee.countDocuments({ eventId: req.params.eventId, isCheckedIn: true }),
    EntryLog.find({ eventId: req.params.eventId })
      .populate({ path: "attendeeId", select: "name email" })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean()
  ]);
  res.json({
    totalRegistrations: total,
    checkedIn,
    pending: total - checkedIn,
    recentLogs: logs
  });
});

eventRouter.get("/:eventId/attendees", requireEventAccess(["event_admin", "event_staff"]), async (req, res) => {
  const attendees = await Attendee.find({ eventId: req.params.eventId })
    .sort({ createdAt: -1 })
    .lean();
  res.json(attendees);
});

eventRouter.post("/:eventId/attendees", requireRole("admin"), requireEventAccess(["event_admin"]), async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }
  try {
    const attendee = await registerAttendee({
      event,
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber || ""
    });
    return res.status(201).json(attendee);
  } catch (error) {
    if (error?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Attendee with this email already exists for this event" });
    }
    throw error;
  }
});

eventRouter.post("/:eventId/attendees/bulk", requireRole("admin"), requireEventAccess(["event_admin"]), upload.single("file"), async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ message: "CSV or Excel file is required" });
  }
  const fileName = (req.file.originalname || "").toLowerCase();
  const isCsv = fileName.endsWith(".csv");
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
  if (!isCsv && !isExcel) {
    return res.status(400).json({ message: "Only .csv, .xlsx, and .xls files are supported" });
  }
  const rows = isCsv ? parseAttendeeCsv(req.file.buffer) : parseAttendeeSpreadsheet(req.file.buffer);
  let created = 0;
  const errors = [];
  for (const row of rows) {
    try {
      await registerAttendee({ event, ...row });
      created += 1;
    } catch (error) {
      const reason =
        error?.code === 11000
          ? "Duplicate email"
          : error?.code === "VALIDATION_ERROR"
            ? error.message
            : "Unknown error";
      errors.push({ email: row.email, reason });
    }
  }
  return res.json({ totalRows: rows.length, created, errors });
});

eventRouter.put("/:eventId/attendees/:attendeeId", requireRole("admin"), requireEventAccess(["event_admin"]), async (req, res) => {
  const { name, email, phoneNumber } = req.body;
  if (!name || !email) {
    return res.status(400).json({ message: "Name and email are required" });
  }

  try {
    const attendee = await Attendee.findOne({ _id: req.params.attendeeId, eventId: req.params.eventId });
    if (!attendee) {
      return res.status(404).json({ message: "Attendee not found" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail !== attendee.email) {
      const emailExists = await Attendee.findOne({
        eventId: req.params.eventId,
        email: normalizedEmail,
        _id: { $ne: req.params.attendeeId }
      });
      if (emailExists) {
        return res.status(409).json({ message: "An attendee with this email is already registered for this event" });
      }
    }

    const emailChanged = normalizedEmail !== attendee.email;
    const nameChanged = name.trim() !== attendee.name;

    attendee.name = name.trim();
    attendee.email = normalizedEmail;
    attendee.phoneNumber = (phoneNumber || "").trim();

    await attendee.save();

    if (emailChanged || nameChanged) {
      const event = await Event.findById(req.params.eventId);
      if (event) {
        sendTicketEmail({
          to: attendee.email,
          attendeeName: attendee.name,
          eventTitle: event.title,
          ticketUuid: attendee.ticketUuid,
          qrCodeDataUrl: attendee.qrCodeDataUrl
        }).catch((err) => console.error("Failed to send updated ticket email:", err));
      }
    }

    return res.json(attendee);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

eventRouter.delete("/:eventId/attendees/:attendeeId", requireRole("admin"), requireEventAccess(["event_admin"]), async (req, res) => {
  try {
    const result = await Attendee.deleteOne({ _id: req.params.attendeeId, eventId: req.params.eventId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Attendee not found" });
    }
    return res.json({ message: "Attendee deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// List all gates for an event
eventRouter.get("/:eventId/gates", requireAuth, requireEventAccess(["event_admin", "event_staff"]), async (req, res) => {
  try {
    const gates = await Gate.find({ eventId: req.params.eventId }).sort({ name: 1 }).lean();
    return res.json(gates);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Create a new gate for an event (admin only)
eventRouter.post("/:eventId/gates", requireAuth, requireRole("admin"), requireEventAccess(["event_admin"]), async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: "Gate name is required" });
  }

  try {
    const existing = await Gate.findOne({ eventId: req.params.eventId, name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: "A gate with this name already exists for this event" });
    }

    const gate = await Gate.create({
      eventId: req.params.eventId,
      name: name.trim(),
      description: (description || "").trim()
    });

    return res.status(201).json(gate);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Delete a gate for an event (admin only)
eventRouter.delete("/:eventId/gates/:gateId", requireAuth, requireRole("admin"), requireEventAccess(["event_admin"]), async (req, res) => {
  try {
    const result = await Gate.deleteOne({ _id: req.params.gateId, eventId: req.params.eventId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Gate not found" });
    }
    // Clear this gate assignment from any staff user
    await User.updateMany({ assignedGateId: req.params.gateId }, { $set: { assignedGateId: null } });
    
    return res.json({ message: "Gate deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
