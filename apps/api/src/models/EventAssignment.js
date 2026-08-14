import mongoose from "mongoose";

const eventAssignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    role: {
      type: String,
      enum: ["event_admin", "event_staff"],
      required: true
    },
    assignedGateId: { type: mongoose.Schema.Types.ObjectId, ref: "Gate", default: null }
  },
  { timestamps: true }
);

// Prevent duplicate assignment records for the same user-event pair
eventAssignmentSchema.index({ userId: 1, eventId: 1 }, { unique: true });

export const EventAssignment = mongoose.model("EventAssignment", eventAssignmentSchema);
