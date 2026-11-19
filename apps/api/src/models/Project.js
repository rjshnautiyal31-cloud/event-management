import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectType: {
      type: String,
      enum: ["story_music", "ad_promo"],
      default: "story_music",
      index: true
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    storyText: { type: String, required: true },
    adBrief: {
      brandName: { type: String, default: "" },
      productOrOffer: { type: String, default: "" },
      objective: { type: String, default: "" },
      targetAudience: { type: String, default: "" },
      callToAction: { type: String, default: "" },
      ctaSubtext: { type: String, default: "" },
      burnInCtaOverlay: { type: Boolean, default: true },
      targetDurationSeconds: { type: Number, default: 30 },
      audioMode: {
        type: String,
        enum: ["dialogue_only", "dialogue_bgm", "hybrid_conversation_song", "visual_only"],
        default: "hybrid_conversation_song"
      },
      speakerFormat: {
        type: String,
        enum: ["single_narrator", "two_speaker_chat", "multi_cast"],
        default: "two_speaker_chat"
      },
      bgmStyle: { type: String, default: "Upbeat Commercial" }
    },
    status: {
      type: String,
      enum: ["draft", "analyzed", "lyrics_generated", "script_generated", "music_generated", "storyboarded", "rendering", "completed", "failed"],
      default: "draft",
      index: true
    },
    language: { type: String, default: "en" },
    voiceType: { type: String, default: "female" },
    customVoicePrompt: { type: String, default: "" },
    customVoiceId: { type: String, default: "" },
    characters: [
      {
        name: { type: String, required: true },
        role: { type: String, default: "" },
        visualDescription: { type: String, default: "" },
        voiceGender: { type: String, enum: ["female", "male"], default: "female" },
        voiceRole: { type: String, enum: ["speaker_a", "speaker_b", "narrator"], default: "speaker_a" },
        referenceMediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" }
      }
    ],
    directorGuidelines: { type: String, default: "" },
    activeStoryAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: "StoryAnalysis" },
    activeSongId: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
    activeStoryboardId: { type: mongoose.Schema.Types.ObjectId, ref: "Storyboard" },
    activeVideoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" }
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
