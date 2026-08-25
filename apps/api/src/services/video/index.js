import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

// Google Cloud Veo AI Video Adapter (Generates motion video scenes using Google Veo)
class GoogleVeoVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5 }) {
    const apiKey = env.geminiApiKey;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY missing. Falling back to static image frame.");
      return imageUrl;
    }

    try {
      console.log(`[Google Veo AI Video] Requesting video generation for prompt: "${promptText.slice(0, 80)}..."`);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-video:predict?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          image: imageUrl,
          aspectRatio: "16:9",
          durationSeconds: durationSeconds
        })
      });

      if (response.ok) {
        const data = await response.json();
        const videoUrl = data.videoUri || data.outputVideoUrl;
        if (videoUrl) {
          console.log(`[Google Veo AI Video] Successfully generated video clip: ${videoUrl}`);
          return videoUrl;
        }
      }
    } catch (err) {
      console.warn("Google Veo Video generation endpoint unconfigured/fallback:", err.message);
    }

    return imageUrl;
  }
}

// Replicate Cloud AI Video Adapter
class ReplicateVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5 }) {
    const apiKey = env.videoApiKey || env.replicateApiKey;
    if (!apiKey) {
      console.warn("REPLICATE_API_KEY missing. Falling back to Google Veo or static image frame.");
      return new GoogleVeoVideoAdapter().generateSceneVideoClip({ imageUrl, promptText, durationSeconds });
    }

    try {
      console.log(`[Replicate AI Video] Triggering prediction for prompt: "${promptText.slice(0, 80)}..."`);

      const createRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Token ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          version: "3f0457e4619da258370163351d3e8f8101a938634ed1fcfd43a6d97c55531d27",
          input: {
            input_image: imageUrl,
            motion_bucket_id: 127,
            cond_aug: 0.02
          }
        })
      });

      const prediction = await createRes.json();
      if (!prediction.id) {
        throw new Error(prediction.detail || "Failed to initiate Replicate prediction");
      }

      let status = prediction.status;
      let pollUrl = prediction.urls?.get;
      let outputUrl = null;
      let attempts = 0;

      while (status !== "succeeded" && status !== "failed" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;

        const pollRes = await fetch(pollUrl, {
          headers: { "Authorization": `Token ${apiKey}` }
        });
        const pollData = await pollRes.json();
        status = pollData.status;

        if (status === "succeeded") {
          outputUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
          break;
        } else if (status === "failed") {
          console.error("Replicate AI video rendering failed:", pollData.error);
          break;
        }
      }

      if (outputUrl) return outputUrl;
    } catch (err) {
      console.error("Replicate AI video generation error:", err.message);
    }

    return new GoogleVeoVideoAdapter().generateSceneVideoClip({ imageUrl, promptText, durationSeconds });
  }
}

// Local FFmpeg Video Adapter
class LocalFfmpegVideoAdapter {
  async generateSceneVideoClip({ imageUrl }) {
    return imageUrl;
  }
}

const googleVeoAdapter = new GoogleVeoVideoAdapter();
const replicateVideoAdapter = new ReplicateVideoAdapter();
const localVideoAdapter = new LocalFfmpegVideoAdapter();

export function getVideoProvider() {
  if (env.videoProvider === "replicate" || env.videoProvider === "runway") {
    return replicateVideoAdapter;
  }
  if (env.videoProvider === "google_veo" || env.videoProvider === "google") {
    return googleVeoAdapter;
  }
  return localVideoAdapter;
}
