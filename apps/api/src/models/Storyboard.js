import mongoose from "mongoose";

const storyboardSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song", default: null },
    scenes: [
      {
        sceneNumber: { type: Number, required: true },
        startTimeSeconds: { type: Number, default: 0 },
        endTimeSeconds: { type: Number, default: 5 },
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
        segmentType: { type: String, default: "song" },
        speakerName: { type: String, default: "" },
        onScreenHeadline: { type: String, default: "" },
        captionText: { type: String, default: "" },
        lyricSnippet: { type: String, default: "" },
        visualPrompt: { type: String, default: "" },
        characters: [{ type: String }],
        transitionEffect: { type: String, default: "fade" }
      }
    ]
  },
  { timestamps: true }
);

export const Storyboard = mongoose.model("Storyboard", storyboardSchema);
