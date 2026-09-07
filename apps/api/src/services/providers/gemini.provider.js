import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

import fsSync from "fs";

function getGeminiClient() {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
  if (fsSync.existsSync(keyFilename)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
    return {
      ai: new GoogleGenAI({
        vertexai: true,
        project: env.googleCloudProject || "project-2a1614a0-3389-4a26-8d4",
        location: "us-central1"
      }),
      modelName: "gemini-2.5-flash"
    };
  }
  if (env.geminiApiKey && !env.geminiApiKey.includes("your_gemini_api_key_here")) {
    return {
      ai: new GoogleGenAI({ apiKey: env.geminiApiKey }),
      modelName: "gemini-3.6-flash"
    };
  }
  return null;
}

// 1. Analyze Story Narrative with Gemini Flash
export async function analyzeStoryWithGemini(storyText) {
  const clientInfo = getGeminiClient();

  const mockAnalysis = {
    summary: storyText.slice(0, 200) + "...",
    emotionalArc: ["hopeful", "challenging", "triumphant"],
    themes: ["perseverance", "community", "celebration"],
    suggestedGenres: ["Pop", "Acoustic", "Cinematic"],
    mood: "Inspiring",
    keyMoments: [
      { momentNumber: 1, description: "Opening moments", visualIdea: "Cinematic wide shot of an elegant event venue glowing under warm morning sunlight, 8k resolution, professional photography", suggestedDurationSeconds: 5 },
      { momentNumber: 2, description: "Main event activities", visualIdea: "Joyful group of event attendees cheering, celebrating, and engaging in vibrant discussions at a modern gala, photorealistic", suggestedDurationSeconds: 5 },
      { momentNumber: 3, description: "Closing reflection", visualIdea: "Dramatic sunset overview of evening festivities with sparkling ambient lights and happy crowd, cinematic atmospheric lighting", suggestedDurationSeconds: 5 }
    ]
  };

  if (!clientInfo) return mockAnalysis;

  try {
    const prompt = `Analyze the following event story for an AI music video project.
Provide a concise summary (max 3 sentences), emotional arc (3 stages), 3 key themes, mood, and exactly 4 to 6 key visual moments for scene image generation (photorealistic 16:9 cinematic descriptions) with duration estimates (5-8 seconds each):

${storyText.slice(0, 5000)}`;

    const response = await clientInfo.ai.models.generateContent({
      model: clientInfo.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            emotionalArc: { type: Type.ARRAY, items: { type: Type.STRING } },
            themes: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
            mood: { type: Type.STRING },
            keyMoments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  momentNumber: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                  visualIdea: { type: Type.STRING },
                  suggestedDurationSeconds: { type: Type.INTEGER }
                }
              }
            }
          }
        }
      }
    });

    const cleanJsonText = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJsonText);
  } catch (err) {
    console.warn("Gemini API call failed, using local mock analysis:", err.message);
    return mockAnalysis;
  }
}

// 2. Generate Structured Song Lyrics with Gemini Flash
export async function generateLyricsWithGemini(storySummary, targetGenre) {
  const clientInfo = getGeminiClient();

  const mockLyrics = `[Verse 1]\nGathered here today in light\nMemories so clear and bright\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\n\n[Outro]\nTogether as one.`;

  if (!clientInfo) return mockLyrics;

  try {
    const prompt = `Write structured song lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro) based on this story summary: "${storySummary}". Genre style: ${targetGenre}. Keep lines rhythmically balanced for singing.`;

    const response = await clientInfo.ai.models.generateContent({
      model: clientInfo.modelName,
      contents: prompt
    });

    return response.text;
  } catch (err) {
    console.warn("Gemini API call failed, using local mock lyrics:", err.message);
    return mockLyrics;
  }
}

// 3. Generate Synchronized Chronological Storyboard from Song Lyrics & Duration
export async function generateStoryboardFromLyrics({ storyContext = "", lyrics = "", totalDurationSeconds = 30, targetSceneDuration = 6 }) {
  const clientInfo = getGeminiClient();

  const fallbackSceneCount = Math.max(3, Math.round(totalDurationSeconds / targetSceneDuration));
  const fallbackSceneDuration = Math.round(totalDurationSeconds / fallbackSceneCount);
  const fallbackScenes = Array.from({ length: fallbackSceneCount }, (_, i) => ({
    sceneNumber: i + 1,
    startTimeSeconds: i * fallbackSceneDuration,
    endTimeSeconds: i === fallbackSceneCount - 1 ? totalDurationSeconds : (i + 1) * fallbackSceneDuration,
    durationSeconds: i === fallbackSceneCount - 1 ? totalDurationSeconds - (i * fallbackSceneDuration) : fallbackSceneDuration,
    lyricSnippet: `Part ${i + 1}`,
    visualIdea: `Cinematic wide angle shot illustrating scene ${i + 1}, photorealistic 16:9, dramatic lighting`
  }));

  if (!clientInfo || !lyrics) return fallbackScenes;

  try {
    const prompt = `You are an expert music video director.
Total Audio Song Duration: ${totalDurationSeconds} seconds.
Story context: "${storyContext.slice(0, 500)}"
Song lyrics:
"""
${lyrics}
"""

Create a chronological sequence of distinct visual scenes synchronized with the song:
1. Divide the entire song timeline (${totalDurationSeconds} seconds) into sequential, non-overlapping scenes.
2. Each scene should be between 5 and 7 seconds long (matching standard AI video clips of ~5-6s duration, so video clips never need to repeat!).
3. Assign the exact matching lyric lines sung during that time window to each scene.
4. For every scene, write a rich, unique, non-repetitive visual prompt for AI video generation (16:9 widescreen, photorealistic cinematic camera movement, specific lighting and environment reflecting the emotion of those lyrics).
5. Absolutely avoid repeating actions or visual settings across scenes. Each scene must advance the visual story.
6. The first scene must start at startTimeSeconds = 0, and the last scene must end at endTimeSeconds = ${totalDurationSeconds}.

Return a JSON array of scenes.`;

    const response = await clientInfo.ai.models.generateContent({
      model: clientInfo.modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sceneNumber: { type: Type.INTEGER },
              startTimeSeconds: { type: Type.NUMBER },
              endTimeSeconds: { type: Type.NUMBER },
              durationSeconds: { type: Type.NUMBER },
              lyricSnippet: { type: Type.STRING },
              visualIdea: { type: Type.STRING }
            },
            required: ["sceneNumber", "startTimeSeconds", "endTimeSeconds", "durationSeconds", "lyricSnippet", "visualIdea"]
          }
        }
      }
    });

    const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed[0].startTimeSeconds = 0;
      parsed[parsed.length - 1].endTimeSeconds = totalDurationSeconds;
      return parsed;
    }
    return fallbackScenes;
  } catch (err) {
    console.warn("Gemini storyboard generation failed, using fallback:", err.message);
    return fallbackScenes;
  }
}

// 4. Generate Cinematic Visual Scene Images using Gemini Imagen 3 with Free AI Fallback
export async function generateSceneImageWithGemini(visualPrompt) {
  const ai = getGeminiClient();

  if (ai) {
    try {
      console.log(`[Gemini Imagen 3] Generating 16:9 scene image for prompt: "${visualPrompt.slice(0, 80)}..."`);

      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: visualPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "16:9"
        }
      });

      const imageBytesBase64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (imageBytesBase64) {
        const uploadDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });
        const filename = `gemini_scene_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, Buffer.from(imageBytesBase64, "base64"));
        return `http://localhost:${env.port}/uploads/${filename}`;
      }
    } catch (err) {
      console.warn("Gemini Imagen 3 direct generation unconfigured/failed, utilizing high-res AI generator:", err.message);
    }
  }

  // High-Resolution 16:9 AI Scene Generation Fallback
  try {
    const cleanPrompt = encodeURIComponent(visualPrompt.slice(0, 200));
    const seed = Math.floor(Math.random() * 100000);
    const aiImageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1280&height=720&nologo=true&seed=${seed}`;

    console.log(`[AI Image Generator] Fetching high-definition 1280x720 scene frame for prompt: "${visualPrompt.slice(0, 60)}..."`);
    const res = await fetch(aiImageUrl);

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `ai_scene_${Date.now()}_${seed}.jpg`;
      const filePath = path.join(uploadDir, filename);

      await fs.writeFile(filePath, Buffer.from(arrayBuffer));
      return `http://localhost:${env.port}/uploads/${filename}`;
    }
  } catch (err) {
    console.error("AI Scene Image fetch failed:", err.message);
  }

  return null;
}
