import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    videoUrl: { type: String, required: true },
    durationSeconds: { type: Number },
    resolution: { type: String, default: "1080p" },
    aspectRatio: { type: String, default: "16:9" },
    preset: { type: String, default: "1080p" },
    fileSizeBytes: { type: Number }
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);
