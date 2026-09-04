import path from "path";
import fs from "fs/promises";
import { GoogleAuth } from "google-auth-library";
import { env } from "../../config/env.js";

// Google Cloud DeepMind Veo AI Video Adapter (Vertex AI veo-3.1-generate-001)
export class GoogleVeoVideoAdapter {
  async generateSceneVideoClip({ imageUrl, promptText, durationSeconds = 4 }) {
    // Valid durations on Vertex AI Veo are 4, 6, 8 seconds
    const validDuration = [4, 6, 8].includes(Number(durationSeconds)) ? Number(durationSeconds) : 4;
    const cleanPrompt = (promptText || "Cinematic wide shot of celebratory event scene with vibrant atmospheric lighting").trim();

    try {
      console.log(`[Google Veo AI Video] Authenticating with Vertex AI Service Account...`);
      const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
      const auth = new GoogleAuth({
        keyFilename,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"]
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      const projectId = await auth.getProjectId() || env.googleCloudProject || "project-2a1614a0-3389-4a26-8d4";
      const location = process.env.GOOGLE_CLOUD_LOCATION || env.googleCloudLocation || "us-central1";
      const model = "veo-3.1-generate-001";

      const instanceObj = {
        prompt: cleanPrompt
      };

      // If source imageUrl is provided, attach base64 image bytes for Image-to-Video conditioning
      if (imageUrl) {
        try {
          let imgBuffer = null;
          if (imageUrl.startsWith("data:")) {
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches[2]) {
              imgBuffer = Buffer.from(matches[2], "base64");
            }
          } else if (imageUrl.includes("/uploads/")) {
            const localFile = path.join(process.cwd(), "uploads", path.basename(imageUrl));
            imgBuffer = await fs.readFile(localFile);
          } else if (imageUrl.startsWith("http")) {
            const res = await fetch(imageUrl);
            if (res.ok) {
              imgBuffer = Buffer.from(await res.arrayBuffer());
            }
          }

          if (imgBuffer && imgBuffer.length > 0) {
            instanceObj.image = {
              bytesBase64Encoded: imgBuffer.toString("base64"),
              mimeType: "image/jpeg"
            };
            console.log(`[Google Veo AI Video] Attached source frame (${imgBuffer.length} bytes) for Image-to-Video generation`);
          }
        } catch (imgErr) {
          console.warn("[Google Veo AI Video] Could not load image for Image-to-Video, proceeding with Text-to-Video:", imgErr.message);
        }
      }

      console.log(`[Google Veo AI Video] Submitting predictLongRunning (${validDuration}s) for prompt: "${cleanPrompt.slice(0, 80)}..."`);
      const predictUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predictLongRunning`;

      const createRes = await fetch(predictUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          instances: [instanceObj],
          parameters: {
            aspectRatio: "16:9",
            durationSeconds: validDuration
          }
        })
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Veo predictLongRunning failed (${createRes.status}): ${errText}`);
      }

      const createData = await createRes.json();
      const operationName = createData.name;
      if (!operationName) {
        throw new Error("No operation name returned from Veo");
      }

      console.log(`[Google Veo AI Video] Operation created: ${operationName}. Polling operation...`);

      // 2. Poll operation status via fetchPredictOperation
      const fetchUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:fetchPredictOperation`;
      let attempts = 0;
      const maxAttempts = 25; // 25 * 3s = 75s timeout
      let videoBase64 = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3500));
        attempts++;

        const pollRes = await fetch(fetchUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ operationName })
        });

        if (!pollRes.ok) {
          console.warn(`[Google Veo AI Video] Polling check attempt ${attempts} returned status ${pollRes.status}`);
          continue;
        }

        const pollData = await pollRes.json();
        if (pollData.error) {
          throw new Error(`Veo generation failed: ${JSON.stringify(pollData.error)}`);
        }

        if (pollData.done) {
          videoBase64 = pollData.response?.videos?.[0]?.bytesBase64Encoded;
          break;
        }

        console.log(`[Google Veo AI Video] Video rendering in progress... (attempt ${attempts}/${maxAttempts})`);
      }

      if (videoBase64) {
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });
        const videoFilename = `veo_scene_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
        const videoFilePath = path.join(uploadDir, videoFilename);
        await fs.writeFile(videoFilePath, Buffer.from(videoBase64, "base64"));

        const publicUrl = `http://localhost:${env.port}/uploads/${videoFilename}`;
        console.log(`[Google Veo AI Video] Successfully generated and stored Veo MP4 video clip: ${publicUrl}`);
        return publicUrl;
      } else {
        console.warn("[Google Veo AI Video] Veo operation timed out or returned no video bytes. Falling back to scene frame.");
      }
    } catch (err) {
      console.error("[Google Veo AI Video] Error generating video clip:", err.message);
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

export function getVideoProvider(providerOverride) {
  const chosen = (providerOverride || env.videoProvider || "google_veo").toLowerCase();
  if (chosen.includes("replicate") || chosen.includes("runway")) {
    return replicateVideoAdapter;
  }
  if (chosen.includes("veo") || chosen.includes("google")) {
    return googleVeoAdapter;
  }
  return localVideoAdapter;
}
