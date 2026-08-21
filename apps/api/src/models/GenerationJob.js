import mongoose from "mongoose";

const generationJobSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    jobType: {
      type: String,
      enum: ["story_analysis", "lyrics_generation", "music_generation", "storyboard_generation", "video_rendering"],
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true
    },
    progressPercent: { type: Number, default: 0 },
    currentStepMessage: { type: String, default: "Queued..." },
    resultRef: { type: mongoose.Schema.Types.ObjectId },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

export const GenerationJob = mongoose.model("GenerationJob", generationJobSchema);
