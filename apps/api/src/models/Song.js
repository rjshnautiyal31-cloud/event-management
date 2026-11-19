import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    trackMode: {
      type: String,
      enum: ["song", "dialogue_only", "dialogue_bgm", "hybrid_conversation_song", "visual_only"],
      default: "song"
    },
    lyrics: { type: String, default: "" },
    genre: { type: String, default: "Pop" },
    mood: { type: String, default: "Upbeat" },
    audioUrl: { type: String, default: "" },
    durationSeconds: { type: Number, default: 30 },
    provider: { type: String, default: "local_synth" },
    language: { type: String, default: "en" },
    isFallback: { type: Boolean, default: false },
    fallbackReason: { type: String },
    voiceType: { type: String, enum: ["female", "male", "duet", "custom", "multi_speaker", "none"], default: "female" },
    customVoicePrompt: { type: String, default: "" },
    customVoiceId: { type: String, default: "" },
    scriptSegments: [
      {
        segmentOrder: { type: Number, required: true },
        segmentType: {
          type: String,
          enum: ["dialogue", "narration", "sung_jingle", "visual_beat"],
          default: "dialogue"
        },
        speakerName: { type: String, default: "Narrator" },
        voiceRole: {
          type: String,
          enum: ["speaker_a", "speaker_b", "narrator", "jingle_vocal"],
          default: "narrator"
        },
        voiceGender: { type: String, enum: ["female", "male"], default: "female" },
        text: { type: String, default: "" },
        onScreenHeadline: { type: String, default: "" },
        targetDurationSeconds: { type: Number, default: 4 },
        startTimeSeconds: { type: Number, default: 0 },
        endTimeSeconds: { type: Number, default: 4 },
        bgmBehavior: { type: String, enum: ["none", "ducked", "full"], default: "ducked" },
        segmentAudioUrl: { type: String, default: "" }
      }
    ],
    status: { type: String, enum: ["pending", "script_ready", "generating", "ready", "failed"], default: "pending" }
  },
  { timestamps: true }
);

export const Song = mongoose.model("Song", songSchema);
