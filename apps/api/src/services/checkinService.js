import { Attendee } from "../models/Attendee.js";
import { EntryLog } from "../models/EntryLog.js";
import { Event } from "../models/Event.js";

export function createCheckinService({ attendeeModel = Attendee, entryLogModel = EntryLog } = {}) {
  return {
    async validateAndCheckIn({ ticketUuid, gateNumber = "" }) {
      const now = new Date();

      const existing = await attendeeModel.findOne({ ticketUuid });

      if (!existing) {
        return {
          status: "invalid",
          message: "Invalid Ticket"
        };
      }

      const event = await Event.findById(existing.eventId);
      if (!event) {
        return {
          status: "invalid",
          message: "Event not found"
        };
      }

      if (now > new Date(event.date)) {
        return {
          status: "expired",
          message: "This event has expired. Validation is locked."
        };
      }

      // Atomic conditional update prevents duplicate check-ins from concurrent scans.
      const updated = await attendeeModel.findOneAndUpdate(
        { ticketUuid, isCheckedIn: false },
        { $set: { isCheckedIn: true, checkedInAt: now, checkedInGate: gateNumber } },
        { new: true }
      );

      if (updated) {
        await entryLogModel.create({
          attendeeId: updated._id,
          eventId: updated.eventId,
          gateNumber,
          timestamp: now,
          attendeeName: updated.name,
          attendeeEmail: updated.email
        });

        return {
          status: "granted",
          message: "Access Granted",
          attendee: updated,
          checkedInAt: now
        };
      }

      return {
        status: "already_checked_in",
        message: "Already Checked In",
        checkedInAt: existing.checkedInAt,
        attendee: existing
      };
    }
  };
}

