import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

function getGeminiClient() {
  if (!env.geminiApiKey || env.geminiApiKey.includes("your_gemini_api_key_here")) {
    return null;
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

// 1. Analyze Story Narrative with Gemini 2.5 Flash
export async function analyzeStoryWithGemini(storyText) {
  const ai = getGeminiClient();

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

  if (!ai) return mockAnalysis;

  try {
    const prompt = `Analyze the following event story for an AI music video project. Provide a concise summary, emotional arc, key themes, mood, and a list of detailed visual prompts for scene image generation (photorealistic 16:9 cinematic descriptions) with duration estimates:\n\n${storyText}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
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

// 2. Generate Structured Song Lyrics with Gemini 2.5 Flash
export async function generateLyricsWithGemini(storySummary, targetGenre) {
  const ai = getGeminiClient();

  const mockLyrics = `[Verse 1]\nGathered here today in light\nMemories so clear and bright\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\n\n[Outro]\nTogether as one.`;

  if (!ai) return mockLyrics;

  try {
    const prompt = `Write structured song lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro) based on this story summary: "${storySummary}". Genre style: ${targetGenre}. Keep lines rhythmically balanced for singing.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt
    });

    return response.text;
  } catch (err) {
    console.warn("Gemini API call failed, using local mock lyrics:", err.message);
    return mockLyrics;
  }
}

// 3. Generate Cinematic Visual Scene Images using Gemini Imagen 3 with Free AI Fallback
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
