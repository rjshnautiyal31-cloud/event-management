import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Company = mongoose.model("Company", companySchema);
