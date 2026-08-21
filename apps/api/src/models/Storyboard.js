import mongoose from "mongoose";

const storyboardSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
    scenes: [
      {
        sceneNumber: { type: Number, required: true },
        startTimeSeconds: { type: Number, default: 0 },
        endTimeSeconds: { type: Number, default: 5 },
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
        captionText: { type: String, default: "" },
        transitionEffect: { type: String, default: "fade" }
      }
    ]
  },
  { timestamps: true }
);

export const Storyboard = mongoose.model("Storyboard", storyboardSchema);
