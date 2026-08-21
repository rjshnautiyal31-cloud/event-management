import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env.js";

// Initialize Gemini client conditionally or fallback to mock when API key not set
function getGeminiClient() {
  if (!env.geminiApiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

export async function analyzeStoryWithGemini(storyText) {
  const ai = getGeminiClient();

  if (!ai) {
    // Return mock structured analysis if no key configured in dev
    return {
      summary: storyText.slice(0, 200) + "...",
      emotionalArc: ["hopeful", "challenging", "triumphant"],
      themes: ["perseverance", "growth", "memory"],
      suggestedGenres: ["Pop", "Acoustic", "Cinematic"],
      mood: "Inspiring",
      keyMoments: [
        { momentNumber: 1, description: "The journey begins", visualIdea: "Sun rising over city horizon", suggestedDurationSeconds: 5 },
        { momentNumber: 2, description: "Facing obstacles", visualIdea: "Walking through stormy path", suggestedDurationSeconds: 5 },
        { momentNumber: 3, description: "Triumph and reflection", visualIdea: "Standing at the mountain peak", suggestedDurationSeconds: 5 }
      ]
    };
  }

  const prompt = `Analyze the following story for a music video project. Provide a concise summary, emotional arc, key themes, mood, and a list of key visual moments with duration estimates:\n\n${storyText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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

  return JSON.parse(response.text);
}

export async function generateLyricsWithGemini(storySummary, targetGenre) {
  const ai = getGeminiClient();

  if (!ai) {
    return `[Verse 1]\nWalking down the quiet street\nEvery memory so sweet\n\n[Chorus]\nThis is the story of our life\nThrough the joy and through the strife\n\n[Outro]\nWe carry on.`;
  }

  const prompt = `Write structured song lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro) based on this story summary: "${storySummary}". Genre style: ${targetGenre}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  return response.text;
}
