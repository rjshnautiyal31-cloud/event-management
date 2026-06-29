import { v4 as uuidv4 } from "uuid";
import { Attendee } from "../models/Attendee.js";
import { generateQrCodeDataUrl } from "../utils/qr.js";
import { sendTicketEmail } from "../utils/email.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeAttendeeInput({ name, email, phoneNumber }) {
  const normalized = {
    name: String(name || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    phoneNumber: String(phoneNumber || "").trim()
  };

  if (!normalized.name || !normalized.email) {
    const error = new Error("name and email are required");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  if (!isValidEmail(normalized.email)) {
    const error = new Error("email must be valid");
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return normalized;
}

export async function registerAttendee({ event, name, email, phoneNumber }) {
  const normalized = normalizeAttendeeInput({ name, email, phoneNumber });
  const ticketUuid = uuidv4();
  const qrCodeDataUrl = await generateQrCodeDataUrl(ticketUuid);

  const attendee = await Attendee.create({
    eventId: event._id,
    name: normalized.name,
    email: normalized.email,
    phoneNumber: normalized.phoneNumber,
    ticketUuid,
    qrCodeDataUrl
  });

  await sendTicketEmail({
    to: attendee.email,
    attendeeName: attendee.name,
    eventTitle: event.title,
    ticketUuid: attendee.ticketUuid,
    qrCodeDataUrl: attendee.qrCodeDataUrl
  });

  return attendee;
}

