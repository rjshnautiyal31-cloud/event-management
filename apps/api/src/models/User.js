import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["super_admin", "event_admin", "event_staff", "admin", "staff"],
      default: "event_staff"
    },
    assignedGateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gate",
      default: null
    }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);

