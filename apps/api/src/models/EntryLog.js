import mongoose from "mongoose";

const entryLogSchema = new mongoose.Schema(
  {
    attendeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendee", required: false },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now },
    gateNumber: { type: String, default: "" },
    attendeeName: { type: String, default: "Unknown attendee" },
    attendeeEmail: { type: String, default: "" }
  },
  { timestamps: true }
);

export const EntryLog = mongoose.model("EntryLog", entryLogSchema);

