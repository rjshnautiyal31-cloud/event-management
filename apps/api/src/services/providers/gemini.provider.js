import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";
import { uploadAssetBuffer, buildStoryStorageKey } from "../storage/index.js";
import { getLanguageConfig } from "../../config/languages.js";

import fsSync from "fs";

function getGeminiClient() {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
  if (fsSync.existsSync(keyFilename)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;
  }

  if (env.googleCloudProject) {
    return {
      ai: new GoogleGenAI({
        vertexai: true,
        project: env.googleCloudProject,
        location: env.googleCloudLocation || "us-central1"
      }),
      modelName: "gemini-2.5-flash"
    };
  }

  if (env.geminiApiKey && !env.geminiApiKey.includes("your_gemini_api_key_here")) {
    return {
      ai: new GoogleGenAI({ apiKey: env.geminiApiKey }),
      modelName: "gemini-2.5-flash"
    };
  }
  return null;
}

// 1. Analyze Story Narrative with Gemini 1.5 Flash (Multilingual-aware)
export async function analyzeStoryWithGemini(storyText, options = {}) {
  const clientInfo = getGeminiClient();
  const language = (typeof options === "string" ? options : options?.language) || "en";
  const langConfig = getLanguageConfig(language);

  const mockAnalysis = {
    summary: `A memorable event celebration filled with joy, connection, and cherished memories. (${langConfig.name})`,
    emotionalArc: ["Excited arrival & anticipation", "Heartfelt connection & shared laughs", "Inspiring celebration & farewell"],
    themes: ["Connection", "Celebration", "Memories"],
    suggestedGenres: ["Pop", "Acoustic", "Cinematic"],
    mood: "Uplifting",
    keyMoments: [
      { momentNumber: 1, description: "Opening moments", visualIdea: "Cinematic wide shot of an elegant event venue glowing under warm morning sunlight, 8k resolution, professional photography", suggestedDurationSeconds: 5 },
      { momentNumber: 2, description: "Main event activities", visualIdea: "Joyful group of event attendees cheering, celebrating, and engaging in vibrant discussions at a modern gala, photorealistic", suggestedDurationSeconds: 5 },
      { momentNumber: 3, description: "Closing reflection", visualIdea: "Dramatic sunset overview of evening festivities with sparkling ambient lights and happy crowd, cinematic atmospheric lighting", suggestedDurationSeconds: 5 }
    ]
  };

  if (!clientInfo) return mockAnalysis;

  try {
    const prompt = `Analyze the following event story for an AI music video project.
The target language for this project is ${langConfig.name} (${langConfig.nativeName}).
Provide a concise narrative summary (max 3 sentences in ${langConfig.name}), emotional arc (3 stages in ${langConfig.name}), 3 key themes (in ${langConfig.name}), mood, and exactly 4 to 6 key visual moments for scene image generation (photorealistic 16:9 cinematic visual descriptions written in English so visual generation models render optimal quality) with duration estimates (5-8 seconds each):

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

// 2. Generate Structured Song Lyrics with Gemini Flash (in selected language and target duration)
export async function generateLyricsWithGemini(storySummary, targetGenre, options = {}) {
  const clientInfo = getGeminiClient();
  const language = (typeof options === "string" ? options : options?.language) || "en";
  const targetDuration = (typeof options === "object" ? Number(options?.targetDuration) : 180) || 180;
  const langConfig = getLanguageConfig(language);

  const mockLyrics = langConfig.code === "hi"
    ? `[Verse 1]\nखुशियों का यह समां है यहाँ\nयादों का एक नया कारवां\nसाथ मिलकर मनाएं ये त्योहार\nदिलों में भरा है सच्चा प्यार\n\n[Chorus]\nये हमारा जश्न, हमारी है दास्तां\nसंग हमारे सारा आसमां\nगीत गाए दिल, झूमे जहां\nये हमारा जश्न, हमारी है दास्तां\n\n[Verse 2]\nहर चेहरे पर एक नई मुस्कान\nअपनों से मिलकर बने पहचान\nसपनों को मिली आज नई उड़ान\n\n[Chorus]\nये हमारा जश्न, हमारी है दास्तां\nसंग हमारे सारा आसमां\n\n[Bridge]\nवक्त ये ठहर जाए यहीं कहीं\nखूबसूरत इतनी ये जिंदगी\n\n[Outro]\nसदा रहे ये प्यार का जहां\nहमारा जश्न, हमारी दास्तां।`
    : langConfig.code === "es"
    ? `[Verse 1]\nUn momento especial que brilla hoy\nCon recuerdos que guardo donde voy\nCaminando juntos hacia el sol\nCelebrando con todo el corazón\n\n[Chorus]\nEsta es nuestra fiesta, nuestro cantar\nUnidos para siempre recordar\nBajo las estrellas vamos a soñar\nNuestra historia nunca va a acabar\n\n[Verse 2]\nCada sonrisa que vemos brillar\nEs una luz que nos guiará\n\n[Chorus]\nEsta es nuestra fiesta, nuestro cantar\nUnidos para siempre recordar\n\n[Outro]\nJuntos hasta el final.`
    : `[Verse 1]\nGathered here today in light\nMemories so clear and bright\nEvery laughter, every friend\nA golden moment that will never end\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\nTogether we stand, together we sing\nJoy and triumph is the song we bring\n\n[Verse 2]\nLooking back at where we came\nEvery step and every name\nA celebration of what we share\nLove and unity everywhere\n\n[Bridge]\nLet this night continue on\nEven after shadows are gone\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\n\n[Outro]\nForever remembered, together as one.`;

  if (!clientInfo) return mockLyrics;

  try {
    const isFullSong = targetDuration >= 90;
    const structureHint = isFullSong
      ? "Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus, Outro (complete ~3 min studio song structure)"
      : "Verse 1, Chorus, Verse 2, Outro";

    const prompt = `Write structured song lyrics (${structureHint}) in ${langConfig.name} (${langConfig.nativeName}) based on this story summary: "${storySummary}".
Genre style: ${targetGenre}.
Target Duration: ~${targetDuration} seconds.
${isFullSong ? "Compose rich, full-length narrative verses with around 120-180 words so it sustains a complete 2.5 to 3 minute musical performance." : "Compose concise lyrics suited for a short track."}
Keep lines rhythmically balanced, poetic, expressive, and natural for singing in ${langConfig.name}.
${langConfig.code !== "en" ? `Important: Write the lyrics authentically in ${langConfig.name} (${langConfig.nativeName}) with natural rhyme and musical meter.` : ""}
Output only the formatted song lyrics with section headers like [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Outro].`;

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
export async function generateStoryboardFromLyrics({
  storyContext = "",
  lyrics = "",
  totalDurationSeconds = 30,
  targetSceneDuration = 6,
  language = "en",
  characters = [],
  directorGuidelines = ""
}) {
  const clientInfo = getGeminiClient();
  const langConfig = getLanguageConfig(language);

  const fallbackSceneCount = Math.max(3, Math.round(totalDurationSeconds / targetSceneDuration));
  const fallbackSceneDuration = Math.round(totalDurationSeconds / fallbackSceneCount);
  const fallbackScenes = Array.from({ length: fallbackSceneCount }, (_, i) => ({
    sceneNumber: i + 1,
    startTimeSeconds: i * fallbackSceneDuration,
    endTimeSeconds: i === fallbackSceneCount - 1 ? totalDurationSeconds : (i + 1) * fallbackSceneDuration,
    durationSeconds: i === fallbackSceneCount - 1 ? totalDurationSeconds - (i * fallbackSceneDuration) : fallbackSceneDuration,
    lyricSnippet: `Part ${i + 1}`,
    visualIdea: `Cinematic wide angle shot illustrating scene ${i + 1}, photorealistic 16:9, dramatic lighting`,
    characters: []
  }));

  if (!clientInfo || !lyrics) return fallbackScenes;

  try {
    let promptCharactersSection = "";
    if (Array.isArray(characters) && characters.length > 0) {
      const charList = characters
        .filter(c => c && c.name)
        .map(c => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${c.visualDescription || "Featured subject"}`)
        .join("\n");
      if (charList) {
        promptCharactersSection = `\nCAST / KEY CHARACTERS TO FEATURE:\n${charList}\nWhen any of these characters are present in a scene, weave their specific visual details (attire, physical traits, hairstyle, accessories) into the visualIdea prompt so that image and video generation models render them consistently across scenes!\n`;
      }
    }

    let promptGuidelinesSection = "";
    if (directorGuidelines && directorGuidelines.trim()) {
      promptGuidelinesSection = `\nDIRECTOR GUIDELINES & MUST-HAVE SCENES:\n"${directorGuidelines.trim()}"\nIncorporate these specific requested moments, actions, and settings into the visual progression across the scenes!\n`;
    }

    const prompt = `You are an expert music video director.
Total Audio Song Duration: ${totalDurationSeconds} seconds.
Language: ${langConfig.name} (${langConfig.nativeName}).
Story context: "${storyContext.slice(0, 500)}"
${promptCharactersSection}
${promptGuidelinesSection}
Song lyrics (in ${langConfig.name}):
"""
${lyrics}
"""

Create a chronological sequence of distinct visual scenes synchronized with the song:
1. Divide the entire song timeline (${totalDurationSeconds} seconds) into sequential, non-overlapping scenes.
2. Each scene should be between 5 and 7 seconds long (matching standard AI video clips of ~5-6s duration, so video clips never need to repeat!).
3. Assign the exact matching lyric lines (lyricSnippet) in ${langConfig.name} sung during that time window to each scene.
4. For every scene, write a rich, unique, non-repetitive visual prompt (visualIdea in English) for AI video/image generation (16:9 widescreen, photorealistic cinematic camera movement, specific lighting, environment reflecting the emotion of those lyrics, and explicit visual appearance of any featured characters).
5. If characters from the cast appear, specify their names in the "characters" array for that scene.
6. Absolutely avoid repeating actions or visual settings across scenes. Each scene must advance the visual story.
7. The first scene must start at startTimeSeconds = 0, and the last scene must end at endTimeSeconds = ${totalDurationSeconds}.

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
              visualIdea: { type: Type.STRING },
              characters: { type: Type.ARRAY, items: { type: Type.STRING } }
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
export async function generateSceneImageWithGemini(visualPrompt, options = {}) {
  const { projectId, title = "", sceneNumber = 1 } = (typeof options === "object" && options !== null) ? options : {};
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
        const filename = `scene_${sceneNumber}_frame_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
        const buffer = Buffer.from(imageBytesBase64, "base64");
        const storageKey = buildStoryStorageKey({
          projectId,
          title,
          category: "scenes/frames",
          filename
        });
        return await uploadAssetBuffer(buffer, storageKey, "image/jpeg");
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
      const filename = `scene_${sceneNumber}_frame_${Date.now()}_${seed}.jpg`;
      const buffer = Buffer.from(arrayBuffer);
      const storageKey = buildStoryStorageKey({
        projectId,
        title,
        category: "scenes/frames",
        filename
      });
      return await uploadAssetBuffer(buffer, storageKey, "image/jpeg");
    }
  } catch (err) {
    console.error("AI Scene Image fetch failed:", err.message);
  }

  return null;
}
