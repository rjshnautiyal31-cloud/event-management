import mongoose from "mongoose";

const storyAnalysisSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    summary: { type: String, required: true },
    emotionalArc: [{ type: String }],
    themes: [{ type: String }],
    suggestedGenres: [{ type: String }],
    mood: { type: String, default: "Emotional" },
    keyMoments: [
      {
        momentNumber: { type: Number },
        description: { type: String },
        visualIdea: { type: String },
        suggestedDurationSeconds: { type: Number, default: 5 }
      }
    ]
  },
  { timestamps: true }
);

export const StoryAnalysis = mongoose.model("StoryAnalysis", storyAnalysisSchema);
