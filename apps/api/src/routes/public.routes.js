import express from "express";
import { Event } from "../models/Event.js";
import { registerAttendee } from "../services/attendeeService.js";
export const publicRouter = express.Router();
/**
 * @openapi
 * /api/public/events/{slug}:
 *   get:
 *     tags: [Public Registration]
 *     summary: Get event details by public slug (no auth required)
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: The event's unique public slug (shown in the dashboard)
 *     responses:
 *       200:
 *         description: Public event details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:          { type: string }
 *                 title:       { type: string }
 *                 date:        { type: string, format: date-time }
 *                 location:    { type: string }
 *                 description: { type: string }
 *                 slug:        { type: string }
 *       404: { description: Event not found }
 */
publicRouter.get("/events/:slug", async (req, res) => {
  const event = await Event.findOne({ publicSlug: req.params.slug }).lean();
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }
  return res.json({
    id: event._id,
    title: event.title,
    date: event.date,
    location: event.location,
    description: event.description,
    slug: event.publicSlug
  });
});
/**
 * @openapi
 * /api/public/events/{slug}/register:
 *   post:
 *     tags: [Public Registration]
 *     summary: Self-register for an event (no auth required)
 *     description: >
 *       Creates an attendee record, generates a unique QR ticket UUID,
 *       and sends the QR code to the attendee's email (if SMTP is configured).
 *     parameters:
 *       - in: path
 *         name: slug
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
 *               name:        { type: string, example: "Jane Doe" }
 *               email:       { type: string, format: email, example: "jane@example.com" }
 *               phoneNumber: { type: string, example: "+91-9876543210" }
 *     responses:
 *       201:
 *         description: Registration successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Registration successful" }
 *                 attendee:
 *                   type: object
 *                   properties:
 *                     id:            { type: string }
 *                     name:          { type: string }
 *                     email:         { type: string }
 *                     qrCodeDataUrl: { type: string, description: "Base64 PNG data URL for QR display" }
 *                     ticketUuid:    { type: string, format: uuid }
 *       404: { description: Event not found }
 *       409: { description: Email already registered for this event }
 */
publicRouter.post("/events/:slug/register", async (req, res) => {
  const event = await Event.findOne({ publicSlug: req.params.slug });
  if (!event) {
    return res.status(404).json({ message: "Event not found" });
  }

  if (new Date() > new Date(event.date)) {
    return res.status(403).json({ message: "This event has expired. Registration is closed." });
  }

  try {
    const attendee = await registerAttendee({
      event,
      name: req.body.name,
      email: req.body.email,
      phoneNumber: req.body.phoneNumber || ""
    });
    return res.status(201).json({
      message: "Registration successful",
      attendee: {
        id: attendee._id,
        name: attendee.name,
        email: attendee.email,
        qrCodeDataUrl: attendee.qrCodeDataUrl,
        ticketUuid: attendee.ticketUuid
      }
    });
  } catch (error) {
    if (error?.code === "VALIDATION_ERROR") {
      return res.status(400).json({ message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ message: "This email is already registered for the event" });
    }
    throw error;
  }
});
