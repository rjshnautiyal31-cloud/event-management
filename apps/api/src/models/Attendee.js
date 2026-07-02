import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phoneNumber: { type: String, default: "", trim: true },
    ticketUuid: { type: String, required: true, unique: true, index: true },
    qrCodeDataUrl: { type: String, required: true },
    isCheckedIn: { type: Boolean, default: false, index: true },
    checkedInAt: { type: Date, default: null },
    checkedInGate: { type: String, default: "" }
  },
  { timestamps: true }
);

attendeeSchema.index({ eventId: 1, email: 1 }, { unique: true });

export const Attendee = mongoose.model("Attendee", attendeeSchema);

