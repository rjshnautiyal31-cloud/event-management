import { Attendee } from "../models/Attendee.js";
import { EntryLog } from "../models/EntryLog.js";

export function createCheckinService({ attendeeModel = Attendee, entryLogModel = EntryLog } = {}) {
  return {
    async validateAndCheckIn({ ticketUuid, gateNumber = "" }) {
      const now = new Date();

      // Atomic conditional update prevents duplicate check-ins from concurrent scans.
      const updated = await attendeeModel.findOneAndUpdate(
        { ticketUuid, isCheckedIn: false },
        { $set: { isCheckedIn: true, checkedInAt: now } },
        { new: true }
      );

      if (updated) {
        await entryLogModel.create({
          attendeeId: updated._id,
          eventId: updated.eventId,
          gateNumber,
          timestamp: now
        });

        return {
          status: "granted",
          message: "Access Granted",
          attendee: updated,
          checkedInAt: now
        };
      }

      const existing = await attendeeModel.findOne({ ticketUuid });

      if (!existing) {
        return {
          status: "invalid",
          message: "Invalid Ticket"
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

