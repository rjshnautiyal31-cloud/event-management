import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    storyText: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "analyzed", "lyrics_generated", "music_generated", "storyboarded", "rendering", "completed", "failed"],
      default: "draft",
      index: true
    },
    language: { type: String, default: "en" },
    voiceType: { type: String, default: "female" },
    customVoicePrompt: { type: String, default: "" },
    customVoiceId: { type: String, default: "" },
    activeStoryAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: "StoryAnalysis" },
    activeSongId: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
    activeStoryboardId: { type: mongoose.Schema.Types.ObjectId, ref: "Storyboard" },
    activeVideoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" }
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
