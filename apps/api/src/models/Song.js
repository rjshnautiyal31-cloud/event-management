import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    lyrics: { type: String, required: true },
    genre: { type: String, required: true },
    mood: { type: String, required: true },
    audioUrl: { type: String },
    durationSeconds: { type: Number, default: 30 },
    provider: { type: String, default: "local_synth" },
    status: { type: String, enum: ["pending", "generating", "ready", "failed"], default: "pending" }
  },
  { timestamps: true }
);

export const Song = mongoose.model("Song", songSchema);
