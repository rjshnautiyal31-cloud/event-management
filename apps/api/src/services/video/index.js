import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { GoogleGenAI } from "@google/genai";
import { env, getGoogleCloudCredentials } from "../../config/env.js";
import { uploadAssetBuffer, buildStoryStorageKey } from "../storage/index.js";

// Resolve local /uploads/... file path including nested project subdirectories
function resolveLocalUploadPath(imageUrl = "") {
  if (!imageUrl || !imageUrl.includes("/uploads/")) return null;
  const relPart = decodeURIComponent(imageUrl.split("/uploads/")[1]?.split("?")[0] || "");
  const candidates = [];
  if (relPart) {
    candidates.push(path.join(process.cwd(), "uploads", relPart));
    candidates.push(path.join(process.cwd(), "apps", "api", "uploads", relPart));
  }
  const base = path.basename(imageUrl.split("?")[0]);
  if (base) {
    candidates.push(path.join(process.cwd(), "uploads", base));
    candidates.push(path.join(process.cwd(), "apps", "api", "uploads", base));
  }
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function buildAspectFramingPrefix(aspectRatio = "16:9") {
  if (aspectRatio === "9:16") {
    return "Vertical 9:16 mobile portrait shot, centered vertical composition with subjects framed comfortably inside vertical margins";
  }
  if (aspectRatio === "1:1") {
    return "Square 1:1 balanced centered composition shot";
  }
  if (aspectRatio === "4:3") {
    return "Classic 4:3 framed cinematic shot";
  }
  return "Cinematic 16:9 widescreen shot";
}

// Google Cloud Gemini Omni 1.1 Flash AI Video Adapter (Vertex AI Next-Gen Interactions)
export class GoogleOmniVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5, aspectRatio = "16:9", projectId: storyProjectId, title = "", sceneNumber = 1 }) {
    const framingPrefix = buildAspectFramingPrefix(aspectRatio);
    const rawPrompt = (promptText || "Cinematic 5-second motion video clip with smooth natural camera movement").trim();
    const cleanPrompt = `${framingPrefix}: ${rawPrompt}`;
    const targetVideoAspect = aspectRatio === "9:16" ? "9:16" : "16:9";

    try {
      const videoModel = env.googleVideoModel || "gemini-omni-1.1-flash-preview";
      console.log(`[Google Gemini Omni Video] Authenticating with Vertex AI Service Account for ${videoModel} (aspect=${aspectRatio})...`);
      const authInfo = getGoogleCloudCredentials();
      const projectId = env.googleCloudProject || authInfo.projectId || process.env.GOOGLE_CLOUD_PROJECT;
      const genAiOptions = {
        vertexai: true,
        project: projectId,
        location: "global"
      };
      if (authInfo.credentials) {
        genAiOptions.googleAuthOptions = {
          credentials: authInfo.credentials,
          projectId
        };
      }
      const ai = new GoogleGenAI(genAiOptions);

      console.log(`[Google Gemini Omni Video] Generating ${aspectRatio} motion video with ${videoModel}: "${cleanPrompt.slice(0, 80)}..."`);

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
            const localFile = resolveLocalUploadPath(imageUrl);
            if (localFile) {
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
                inlineData: {
                  mimeType,
                  data: imgBuffer.toString("base64")
                }
              },
              cleanPrompt
            ];
          }
        } catch (imgErr) {
          console.warn("[Google Gemini Omni Video] Could not fetch input image, proceeding with text-to-video:", imgErr.message);
        }
      }

      const createWithOptionalFormat = async (payload) => {
        try {
          return await ai.interactions.create({
            model: videoModel,
            input: payload,
            response_format: {
              type: "video",
              aspect_ratio: targetVideoAspect
            }
          });
        } catch (fmtErr) {
          console.warn(`[Google Gemini Omni Video] response_format (${targetVideoAspect}) rejected (${fmtErr.message}), retrying standard interaction...`);
          return await ai.interactions.create({
            model: videoModel,
            input: payload
          });
        }
      };

      let inter = null;
      try {
        inter = await createWithOptionalFormat(inputPayload);
      } catch (callErr) {
        if (Array.isArray(inputPayload) && inputPayload.length > 1) {
          console.warn("[Google Gemini Omni Video] Multimodal call failed, falling back to cinematic text prompt:", callErr.message);
          inter = await createWithOptionalFormat(
            `${framingPrefix}, 5-second motion video clip: ${rawPrompt}. Highly detailed, realistic motion, smooth camera movement.`
          );
        } else {
          throw callErr;
        }
      }

      if (inter?.output_video?.data) {
        const aspectTag = aspectRatio.replace(":", "x");
        const videoFilename = `scene_${sceneNumber}_clip_${aspectTag}_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
        const buffer = Buffer.from(inter.output_video.data, "base64");
        const storageKey = buildStoryStorageKey({
          projectId: storyProjectId,
          title,
          category: "scenes/clips",
          filename: videoFilename
        });
        const publicUrl = await uploadAssetBuffer(buffer, storageKey, "video/mp4");

        console.log(`[Google Gemini Omni Video] Successfully generated and stored MP4 video clip: ${publicUrl} (${inter.output_video.data.length} bytes)`);
        return publicUrl;
      }

      throw new Error(`No output_video returned from ${videoModel}`);
    } catch (err) {
      console.error("[Google Gemini Omni Video] Error generating video clip:", err.message);
      return imageUrl;
    }
  }
}

export const GoogleVeoVideoAdapter = GoogleOmniVideoAdapter;

// Replicate Cloud AI Video Adapter
class ReplicateVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 5, aspectRatio = "16:9", projectId: storyProjectId, title = "", sceneNumber = 1 }) {
    const apiKey = env.videoApiKey || env.replicateApiKey;
    if (!apiKey) {
      console.warn("REPLICATE_API_KEY missing. Falling back to Google Veo or static image frame.");
      return new GoogleVeoVideoAdapter().generateSceneVideoClip({ imageUrl, promptText, durationSeconds, aspectRatio, projectId: storyProjectId, title, sceneNumber });
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
          version: env.replicateVideoModel || "3f0457e4619da258370163351d3e8f8101a938634ed1fcfd43a6d97c55531d27",
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

    return new GoogleVeoVideoAdapter().generateSceneVideoClip({ imageUrl, promptText, durationSeconds, aspectRatio, projectId: storyProjectId, title, sceneNumber });
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
