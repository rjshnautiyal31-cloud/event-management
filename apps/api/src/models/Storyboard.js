import mongoose from "mongoose";

const aspectMediaSlotSchema = new mongoose.Schema(
  {
    activeMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
    imageMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
    videoMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null }
  },
  { _id: false }
);

export function aspectRatioToSlotKey(aspectRatio = "16:9") {
  const clean = String(aspectRatio || "").trim();
  if (clean === "9:16") return "portrait_9_16";
  if (clean === "1:1") return "square_1_1";
  if (clean === "4:3") return "tablet_4_3";
  return "landscape_16_9";
}

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
        mediaByAspect: {
          portrait_9_16: { type: aspectMediaSlotSchema, default: () => ({}) },
          landscape_16_9: { type: aspectMediaSlotSchema, default: () => ({}) },
          square_1_1: { type: aspectMediaSlotSchema, default: () => ({}) },
          tablet_4_3: { type: aspectMediaSlotSchema, default: () => ({}) }
        },
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
