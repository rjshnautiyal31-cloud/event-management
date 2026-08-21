import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env.js";

function getGeminiClient() {
  if (!env.geminiApiKey || env.geminiApiKey.includes("your_gemini_api_key_here")) {
    return null;
  }
  return new GoogleGenAI({ apiKey: env.geminiApiKey });
}

export async function analyzeStoryWithGemini(storyText) {
  const ai = getGeminiClient();

  const mockAnalysis = {
    summary: storyText.slice(0, 200) + "...",
    emotionalArc: ["hopeful", "challenging", "triumphant"],
    themes: ["perseverance", "community", "celebration"],
    suggestedGenres: ["Pop", "Acoustic", "Cinematic"],
    mood: "Inspiring",
    keyMoments: [
      { momentNumber: 1, description: "Opening moments", visualIdea: "Sun rising over event venue", suggestedDurationSeconds: 5 },
      { momentNumber: 2, description: "Main event activities", visualIdea: "Crowd cheering and sharing joy", suggestedDurationSeconds: 5 },
      { momentNumber: 3, description: "Closing reflection", visualIdea: "Group photo under evening lights", suggestedDurationSeconds: 5 }
    ]
  };

  if (!ai) {
    return mockAnalysis;
  }

  try {
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
  } catch (err) {
    console.warn("Gemini API call failed, using local mock analysis:", err.message);
    return mockAnalysis;
  }
}

export async function generateLyricsWithGemini(storySummary, targetGenre) {
  const ai = getGeminiClient();

  const mockLyrics = `[Verse 1]\nGathered here today in light\nMemories so clear and bright\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\n\n[Outro]\nTogether as one.`;

  if (!ai) {
    return mockLyrics;
  }

  try {
    const prompt = `Write structured song lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro) based on this story summary: "${storySummary}". Genre style: ${targetGenre}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    return response.text;
  } catch (err) {
    console.warn("Gemini API call failed, using local mock lyrics:", err.message);
    return mockLyrics;
  }
}
