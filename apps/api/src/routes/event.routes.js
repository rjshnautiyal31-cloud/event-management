import express from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Event } from "../models/Event.js";
import { Attendee } from "../models/Attendee.js";
import { EntryLog } from "../models/EntryLog.js";
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
  const event = await Event.create({
    title: normalizedTitle,
    date: parsedDate,
    location: normalizedLocation,
    description: String(description || "").trim(),
    publicSlug,
    createdBy: req.user.sub
  });
  res.status(201).json(event);
});
eventRouter.get("/", async (_req, res) => {
  const events = await Event.find().sort({ date: 1 }).lean();
  res.json(events);
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
eventRouter.get("/:eventId/stats", async (req, res) => {
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
/**
 * @openapi
 * /api/events/{eventId}/attendees:
 *   get:
 *     tags: [Attendees]
 *     summary: List all attendees for an event
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Array of attendees
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Attendee' }
 *   post:
 *     tags: [Attendees]
 *     summary: Manually register a single attendee (admin only)
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:        { type: string, example: "Bob Smith" }
 *               email:       { type: string, format: email }
 *               phoneNumber: { type: string }
 *     responses:
 *       201:
 *         description: Attendee created and QR ticket emailed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Attendee' }
 *       404: { description: Event not found }
 *       409: { description: Email already registered for this event }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin role required }
 */
eventRouter.get("/:eventId/attendees", async (req, res) => {
  const attendees = await Attendee.find({ eventId: req.params.eventId })
    .sort({ createdAt: -1 })
    .lean();
  res.json(attendees);
});
eventRouter.post("/:eventId/attendees", requireRole("admin"), async (req, res) => {
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
/**
 * @openapi
 * /api/events/{eventId}/attendees/bulk:
 *   post:
 *     tags: [Attendees]
 *     summary: Bulk-import attendees from a CSV or Excel file (admin only)
 *     description: >
 *       Upload a .csv, .xlsx, or .xls file with columns: Name, Email, Phone Number.
 *       Duplicate emails within the same event are skipped and reported in the errors array.
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Import summary
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BulkUploadResult' }
 *       400: { description: Missing file or unsupported format }
 *       404: { description: Event not found }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin role required }
 */
eventRouter.post("/:eventId/attendees/bulk", requireRole("admin"), upload.single("file"), async (req, res) => {
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

eventRouter.put("/:eventId/attendees/:attendeeId", requireRole("admin"), async (req, res) => {
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

eventRouter.delete("/:eventId/attendees/:attendeeId", requireRole("admin"), async (req, res) => {
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
