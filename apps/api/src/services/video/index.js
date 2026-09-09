import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { uploadAssetBuffer } from "../storage/index.js";

// Google Cloud Gemini Omni 1.1 Flash AI Video Adapter (Vertex AI Next-Gen Interactions)
export class GoogleOmniVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5 }) {
    const cleanPrompt = (promptText || "Cinematic 5-second motion video clip, photorealistic 16:9 widescreen, cinematic camera motion").trim();

    try {
      console.log(`[Google Gemini Omni Video] Authenticating with Vertex AI Service Account...`);
      const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
      if (fsSync.existsSync(keyFilename)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
      }

      const projectId = env.googleCloudProject || process.env.GOOGLE_CLOUD_PROJECT;
      const ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "global"
      });

      console.log(`[Google Gemini Omni Video] Generating motion video with gemini-omni-1.1-flash-preview: "${cleanPrompt.slice(0, 80)}..."`);

      let inputPayload = cleanPrompt;

      // Attach source image if provided for Image-to-Video animation
      if (imageUrl) {
        try {
          let imgBuffer = null;
          let mimeType = "image/jpeg";
          if (imageUrl.startsWith("data:")) {
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches[2]) {
              mimeType = matches[1];
              imgBuffer = Buffer.from(matches[2], "base64");
            }
          } else if (imageUrl.includes("/uploads/")) {
            const localFile = path.join(process.cwd(), "uploads", path.basename(imageUrl));
            if (fsSync.existsSync(localFile)) {
              imgBuffer = await fs.readFile(localFile);
              if (localFile.endsWith(".png")) mimeType = "image/png";
              else if (localFile.endsWith(".webp")) mimeType = "image/webp";
            }
          } else if (imageUrl.startsWith("http")) {
            const res = await fetch(imageUrl);
            if (res.ok) {
              imgBuffer = Buffer.from(await res.arrayBuffer());
              const ct = res.headers.get("content-type");
              if (ct) mimeType = ct;
            }
          }

          if (imgBuffer && imgBuffer.length > 0) {
            inputPayload = [
              {
                type: "image",
                data: imgBuffer.toString("base64"),
                mime_type: mimeType
              },
              {
                type: "text",
                text: `Animate this scene into a cinematic 5-second motion video clip: ${cleanPrompt}. Smooth cinematic camera movement, 16:9 widescreen.`
              }
            ];
            console.log(`[Google Gemini Omni Video] Attached source frame (${imgBuffer.length} bytes) for Image-to-Video animation`);
          }
        } catch (imgErr) {
          console.warn("[Google Gemini Omni Video] Could not load image for Image-to-Video, proceeding with text prompt:", imgErr.message);
        }
      }

      let inter;
      try {
        inter = await ai.interactions.create({
          model: "gemini-omni-1.1-flash-preview",
          input: inputPayload
        });
      } catch (callErr) {
        if (Array.isArray(inputPayload) && inputPayload.length > 1) {
          console.warn("[Google Gemini Omni Video] Multimodal call failed, falling back to cinematic text prompt:", callErr.message);
          inter = await ai.interactions.create({
            model: "gemini-omni-1.1-flash-preview",
            input: `Cinematic 5-second 16:9 motion video clip: ${cleanPrompt}. Highly detailed, realistic motion, smooth camera pan, 720p.`
          });
        } else {
          throw callErr;
        }
      }

      if (inter?.output_video?.data) {
        const videoFilename = `omni_scene_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
        const buffer = Buffer.from(inter.output_video.data, "base64");
        const publicUrl = await uploadAssetBuffer(buffer, videoFilename, "video/mp4");

        console.log(`[Google Gemini Omni Video] Successfully generated and stored MP4 video clip: ${publicUrl} (${inter.output_video.data.length} bytes)`);
        return publicUrl;
      }

      throw new Error("No output_video returned from gemini-omni-1.1-flash-preview");
    } catch (err) {
      console.error("[Google Gemini Omni Video] Error generating video clip:", err.message);
      return imageUrl;
    }
  }
}

export const GoogleVeoVideoAdapter = GoogleOmniVideoAdapter;

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

const googleOmniAdapter = new GoogleOmniVideoAdapter();
const googleVeoAdapter = googleOmniAdapter;
const replicateVideoAdapter = new ReplicateVideoAdapter();
const localVideoAdapter = new LocalFfmpegVideoAdapter();

export function getVideoProvider(providerOverride) {
  const chosen = (providerOverride || env.videoProvider || "google_omni").toLowerCase();
  if (chosen.includes("replicate") || chosen.includes("runway")) {
    return replicateVideoAdapter;
  }
  if (chosen.includes("omni") || chosen.includes("veo") || chosen.includes("google")) {
    return googleVeoAdapter;
  }
  return localVideoAdapter;
}
