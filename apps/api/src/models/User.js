import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
      default: null
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ["owner", "co_owner", "event_admin", "event_staff", "super_admin"],
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
