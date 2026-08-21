import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    fileUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    originalFilename: { type: String },
    width: { type: Number },
    height: { type: Number },
    durationSeconds: { type: Number }
  },
  { timestamps: true }
);

export const Media = mongoose.model("Media", mediaSchema);
