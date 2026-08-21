import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

// Replicate Cloud AI Video Adapter (Generates motion AI video clips per scene)
class ReplicateVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5 }) {
    if (!env.videoApiKey) {
      console.warn("REPLICATE_API_KEY missing. Falling back to static image frame.");
      return imageUrl;
    }

    try {
      // Replicate API call for image-to-video motion generation (e.g. stability-ai/stable-video-diffusion or minimax)
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Authorization": `Token ${env.videoApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          version: "3f0457e4619da258370163351d3e8f8101a938634ed1fcfd43a6d97c55531d27", // Stable Video Diffusion
          input: {
            input_image: imageUrl,
            motion_bucket_id: 127,
            cond_aug: 0.02
          }
        })
      });

      const data = await response.json();
      return data.output || imageUrl;
    } catch (err) {
      console.error("Replicate AI video generation error:", err.message);
      return imageUrl;
    }
  }
}

// Local FFmpeg Video Adapter
class LocalFfmpegVideoAdapter {
  async generateSceneVideoClip({ imageUrl }) {
    return imageUrl;
  }
}

const localVideoAdapter = new LocalFfmpegVideoAdapter();
const replicateVideoAdapter = new ReplicateVideoAdapter();

export function getVideoProvider() {
  return env.videoProvider === "replicate" || env.videoProvider === "runway"
    ? replicateVideoAdapter
    : localVideoAdapter;
}
