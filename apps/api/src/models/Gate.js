import mongoose from "mongoose";

const gateSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

gateSchema.index({ eventId: 1, name: 1 }, { unique: true });

export const Gate = mongoose.model("Gate", gateSchema);
