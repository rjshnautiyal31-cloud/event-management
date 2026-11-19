import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs/promises";
import { env, getGoogleCloudCredentials } from "../../config/env.js";
import { uploadAssetBuffer, buildStoryStorageKey } from "../storage/index.js";
import { getLanguageConfig } from "../../config/languages.js";

function getGeminiClient() {
  const authInfo = getGoogleCloudCredentials();
  const project = env.googleCloudProject || authInfo.projectId;
  const modelName = env.geminiModel || "gemini-2.5-flash";

  if (project) {
    const options = {
      vertexai: true,
      project,
      location: env.googleCloudLocation || "us-central1"
    };
    if (authInfo.credentials) {
      options.googleAuthOptions = {
        credentials: authInfo.credentials,
        projectId: project
      };
    }
    return {
      ai: new GoogleGenAI(options),
      modelName
    };
  }

  if (env.geminiApiKey && !env.geminiApiKey.includes("your_gemini_api_key_here")) {
    return {
      ai: new GoogleGenAI({ apiKey: env.geminiApiKey }),
      modelName
    };
  }
  return null;
}

// 1. Analyze Story Narrative with Gemini 1.5 Flash (Multilingual-aware)
export async function analyzeStoryWithGemini(storyText, options = {}) {
  const clientInfo = getGeminiClient();
  const language = (typeof options === "string" ? options : options?.language) || "en";
  const directorGuidelines = typeof options === "object" ? (options?.directorGuidelines || "") : "";
  const characters = typeof options === "object" && Array.isArray(options?.characters) ? options.characters : [];
  const langConfig = getLanguageConfig(language);

  const mockAnalysis = {
    summary: `A memorable event celebration filled with joy, connection, and cherished memories. (${langConfig.name})`,
    emotionalArc: ["Excited arrival & anticipation", "Heartfelt connection & shared laughs", "Inspiring celebration & farewell"],
    themes: ["Connection", "Celebration", "Memories"],
    suggestedGenres: ["Pop", "Bollywood Pop", "Acoustic", "Cinematic"],
    mood: "Uplifting",
    keyMoments: [
      { momentNumber: 1, description: "Opening moments", visualIdea: "Cinematic wide shot of an elegant event venue glowing under warm morning sunlight, 8k resolution, professional photography", suggestedDurationSeconds: 5 },
      { momentNumber: 2, description: "Main event activities", visualIdea: "Joyful group of event attendees cheering, celebrating, and engaging in vibrant discussions at a modern gala, photorealistic", suggestedDurationSeconds: 5 },
      { momentNumber: 3, description: "Closing reflection", visualIdea: "Dramatic sunset overview of evening festivities with sparkling ambient lights and happy crowd, cinematic atmospheric lighting", suggestedDurationSeconds: 5 }
    ]
  };

  if (!clientInfo) return mockAnalysis;

  try {
    const langInstruction = langConfig.code === "hinglish"
      ? "Hinglish (conversational blend of Hindi and English written in Roman/Latin script)"
      : `${langConfig.name} (${langConfig.nativeName})`;

    let extraContext = "";
    if (characters.length > 0) {
      const charList = characters
        .filter((c) => c && c.name)
        .map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`)
        .join(", ");
      if (charList) extraContext += `\nKey Cast / People: ${charList}.`;
    }
    if (directorGuidelines && directorGuidelines.trim()) {
      extraContext += `\nDirector Guidelines & Key Highlights: "${directorGuidelines.trim()}".`;
    }

    const prompt = `Analyze the following event story for an AI music video project.
The target language for this project is ${langInstruction}.
Provide a concise narrative summary (max 3 sentences in ${langInstruction}), emotional arc (3 stages in ${langInstruction}), 3 key themes (in ${langInstruction}), mood, and exactly 4 to 6 key visual moments for scene image generation (photorealistic 16:9 cinematic visual descriptions written in English so visual generation models render optimal quality) with duration estimates (5-8 seconds each):${extraContext}

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
  const directorGuidelines = typeof options === "object" ? (options?.directorGuidelines || "") : "";
  const characters = typeof options === "object" && Array.isArray(options?.characters) ? options.characters : [];
  const storyText = typeof options === "object" ? (options?.storyText || "") : "";
  const langConfig = getLanguageConfig(language);

  const mockLyrics = langConfig.code === "hi"
    ? `[Verse 1]\nखुशियों का यह समां है यहाँ\nयादों का एक नया कारवां\nसाथ मिलकर मनाएं ये त्योहार\nदिलों में भरा है सच्चा प्यार\n\n[Chorus]\nये हमारा जश्न, हमारी है दास्तां\nसंग हमारे सारा आसमां\nगीत गाए दिल, झूमे जहां\nये हमारा जश्न, हमारी है दास्तां\n\n[Verse 2]\nहर चेहरे पर एक नई मुस्कान\nअपनों से मिलकर बने पहचान\nसपनों को मिली आज नई उड़ान\n\n[Chorus]\nये हमारा जश्न, हमारी है दास्तां\nसंग हमारे सारा आसमां\n\n[Bridge]\nवक्त ये ठहर जाए यहीं कहीं\nखूबसूरत इतनी ये जिंदगी\n\n[Outro]\nसदा रहे ये प्यार का जहां\nहमारा जश्न, हमारी दास्तां।`
    : langConfig.code === "hinglish"
    ? `[Verse 1]\nDil ki har beat pe chhaya hai yeh nasha\nFriends and family saath, dekho kaisa hai samaa\nEvery smile shining bright under starlit skies\nKhushiyon ke pal hain, no more goodbyes\n\n[Chorus]\nYeh hai apna celebration, tonight we shine\nHar ek lamha hai magical, forever divine\nNacho gaao dil khol ke, let the music play\nYeh yaadein rahengi humesha, every single day\n\n[Verse 2]\nHansi aur baatein, wohlights ka jahaan\nTogether we are writing apni nayi dastaan\nEvery moment feels like a dream come true\nDil se dil mile hain, me and you\n\n[Bridge]\nWaqt tham jaaye bas yahin kahin\nLife looks so beautiful, dekho toh sahi\n\n[Chorus]\nYeh hai apna celebration, tonight we shine\nHar ek lamha hai magical, forever divine\n\n[Outro]\nForever together, dil se dil tak.`
    : `[Verse 1]\nGathered here today in light\nMemories so clear and bright\nEvery laughter, every friend\nA golden moment that will never end\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\nTogether we stand, together we sing\nJoy and triumph is the song we bring\n\n[Verse 2]\nLooking back at where we came\nEvery step and every name\nA celebration of what we share\nLove and unity everywhere\n\n[Bridge]\nLet this night continue on\nEven after shadows are gone\n\n[Chorus]\nThis is our event, our time to shine\nShared moments forever divine\n\n[Outro]\nForever remembered, together as one.`;

  if (!clientInfo) return mockLyrics;

  try {
    const isShortClip = targetDuration <= 45;
    const isMediumTrack = targetDuration <= 90;
    const isHinglish = langConfig.code === "hinglish";
    const langDisplay = isHinglish
      ? "Hinglish (modern Bollywood / Indie-Pop blend of conversational Hindi and English in Roman script)"
      : `${langConfig.name} (${langConfig.nativeName})`;

    let extraSongContext = "";
    if (storyText && storyText.trim() && storyText.trim() !== storySummary.trim()) {
      extraSongContext += `\nFull Story Context: "${storyText.trim().slice(0, 1200)}"`;
    }
    if (characters.length > 0) {
      const charNames = characters
        .filter((c) => c && c.name)
        .map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`)
        .join(", ");
      if (charNames) {
        extraSongContext += `\nFeatured People / Cast: ${charNames}.`;
      }
    }
    if (directorGuidelines && directorGuidelines.trim()) {
      extraSongContext += `\nDirector Guidelines & Key Moments to Reflect in the Song: "${directorGuidelines.trim()}".`;
    }

    let prompt = "";
    if (isShortClip) {
      prompt = `Write very short, punchy song lyrics in ${langDisplay} based on this story summary: "${storySummary}".${extraSongContext}
Genre style: ${targetGenre}.
Target Duration: exactly ~${targetDuration} seconds (Short Social Clip / Reel format).
CRITICAL REQUIREMENT: The lyrics must be very brief, with strictly 25 to 35 words TOTAL across the entire song, so it can be sung or spoken within ~20 seconds with musical intro and outro.
Output only formatted lyrics:
[Verse]
(2 short lines)

[Chorus]
(2 short, catchy lines)`;
    } else if (isMediumTrack) {
      prompt = `Write concise structured song lyrics (Verse 1, Chorus, Verse 2, Outro) in ${langDisplay} based on this story summary: "${storySummary}".${extraSongContext}
Genre style: ${targetGenre}.
Target Duration: ~${targetDuration} seconds.
Total length requirement: Around 60-80 words total so it completes in ~60-90 seconds.
Output only formatted song lyrics with section headers [Verse 1], [Chorus], [Verse 2], [Outro].`;
    } else {
      prompt = `Write structured full-length song lyrics (Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus, Outro) in ${langDisplay} based on this story summary: "${storySummary}".${extraSongContext}
Genre style: ${targetGenre}.
Target Duration: ~${targetDuration} seconds (~3 min full studio song).
Compose rich, narrative verses with around 130-180 words so it sustains a complete 2.5 to 3 minute musical performance.
Output only formatted song lyrics with section headers [Verse 1], [Chorus], [Verse 2], [Chorus], [Bridge], [Outro].`;
    }

    if (isHinglish) {
      prompt += `\nImportant: Write the lyrics in authentic Hinglish — a catchy, modern Bollywood / Indie-Pop blend of conversational Hindi and English written strictly in Roman/Latin alphabet (do NOT use Devanagari script). Naturally weave heartfelt Hindi phrases (e.g., "Dil ki dhadkan", "Yaadon ka safar", "Jashn ki raat") with English phrases and hooks with natural rhyme and musical meter.`;
    } else if (langConfig.code !== "en") {
      prompt += `\nImportant: Write the lyrics authentically in ${langConfig.name} (${langConfig.nativeName}) with natural rhyme and musical meter.`;
    }

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

// 4. Generate Cinematic Visual Scene Images using Google AI with High-Resolution Fallback
export async function generateSceneImageWithGemini(visualPrompt, options = {}) {
  const { projectId, title = "", sceneNumber = 1, aspectRatio = "16:9" } = (typeof options === "object" && options !== null) ? options : {};
  const clientInfo = getGeminiClient();

  if (clientInfo?.ai) {
    const { ai } = clientInfo;

    // 1. Primary: Google Gemini Flash Image (Vertex AI native multimodal image generation)
    const primaryImageModel = env.geminiImageModel || "gemini-2.5-flash-image";
    const secondaryImagenModel = env.imagenModel || "imagen-3.0-generate-002";
    try {
      console.log(`[Google AI Image] Generating high-definition ${aspectRatio} scene frame with ${primaryImageModel} for Scene ${sceneNumber}...`);
      const enhancedPrompt = `A photorealistic ${aspectRatio} widescreen cinematic shot, 8k resolution, professional photography, natural lighting: ${visualPrompt}`;

      const response = await ai.models.generateContent({
        model: primaryImageModel,
        contents: enhancedPrompt,
        config: {
          imageConfig: {
            aspectRatio: aspectRatio
          }
        }
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || "image/png";
          const ext = mimeType.includes("png") ? "png" : "jpg";
          const filename = `scene_${sceneNumber}_frame_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const storageKey = buildStoryStorageKey({
            projectId,
            title,
            category: "scenes/frames",
            filename
          });
          const uploadedUrl = await uploadAssetBuffer(buffer, storageKey, mimeType);
          console.log(`[Google AI Image] Successfully generated pristine scene frame (${buffer.length} bytes): ${uploadedUrl}`);
          return uploadedUrl;
        }
      }
    } catch (err) {
      console.warn(`[Google AI Image] ${primaryImageModel} failed (${err.message}), trying Imagen fallback (${secondaryImagenModel})...`);
    }

    // 2. Secondary: Google Imagen 3 via generateImages (if publisher model is enabled)
    try {
      console.log(`[Gemini Imagen] Generating ${aspectRatio} scene image with ${secondaryImagenModel} for prompt: "${visualPrompt.slice(0, 80)}..."`);

      const response = await ai.models.generateImages({
        model: secondaryImagenModel,
        prompt: visualPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: aspectRatio
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
        const uploadedUrl = await uploadAssetBuffer(buffer, storageKey, "image/jpeg");
        console.log(`[Gemini Imagen] Successfully generated ${secondaryImagenModel} frame: ${uploadedUrl}`);
        return uploadedUrl;
      }
    } catch (err) {
      console.warn(`[Gemini Imagen] ${secondaryImagenModel} direct generation failed:`, err.message);
    }
  }

  // 3. Fallback: High-Definition Watermark-Free AI Image Generator
  try {
    const cleanPrompt = encodeURIComponent(visualPrompt.slice(0, 250));
    const seed = Math.floor(Math.random() * 100000);
    const dims = aspectRatio === "9:16" ? "width=1080&height=1920" : (aspectRatio === "1:1" ? "width=1080&height=1080" : "width=1920&height=1080");
    const fallbackModel = encodeURIComponent(env.fallbackImageModel || "flux");
    const aiImageUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?${dims}&model=${fallbackModel}&nologo=true&private=true&enhance=false&seed=${seed}`;

    console.log(`[AI Image Generator] Fetching high-definition ${dims} scene frame (seed=${seed})...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(aiImageUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

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

// Helper: Format structured ad script segments into a readable script transcript
export function formatSegmentsToTranscript(segments = []) {
  if (!Array.isArray(segments) || segments.length === 0) return "";
  return segments
    .map((seg, i) => {
      const tag = seg.segmentType === "sung_jingle"
        ? `[SUNG JINGLE - ${seg.speakerName || "Vocals"}]`
        : seg.segmentType === "visual_beat"
        ? `[VISUAL CARD]`
        : seg.segmentType === "narration"
        ? `[NARRATOR CTA - ${seg.speakerName || "Announcer"}]`
        : `[DIALOGUE - ${seg.speakerName || `Speaker ${i + 1}`}]`;
      const headlinePart = seg.onScreenHeadline ? ` (On-Screen: "${seg.onScreenHeadline}")` : "";
      return `${tag}${headlinePart}\n${seg.text || seg.onScreenHeadline || ""}`.trim();
    })
    .join("\n\n");
}

// 5. Analyze Short Advertisement Brief with Gemini Commercial Strategist
export async function analyzeAdBriefWithGemini(briefText = "", options = {}) {
  const clientInfo = getGeminiClient();
  const language = options?.language || "en";
  const adBrief = options?.adBrief || {};
  const eventContext = options?.eventContext || null;
  const directorGuidelines = options?.directorGuidelines || "";
  const characters = Array.isArray(options?.characters) ? options.characters : [];
  const langConfig = getLanguageConfig(language);

  const brandLabel = adBrief.brandName || eventContext?.title || "Featured Brand";
  const ctaLabel = adBrief.callToAction || (eventContext ? `Register now for ${eventContext.title}` : `Discover ${brandLabel} today`);
  const targetSec = Number(adBrief.targetDurationSeconds) || 30;
  const audioMode = adBrief.audioMode || "hybrid_conversation_song";

  const mockAdAnalysis = {
    summary: `High-impact ${targetSec}s commercial campaign for ${brandLabel} designed to capture attention in the first 3 seconds and drive action (${ctaLabel}).`,
    emotionalArc: ["Instant curiosity hook", "Relatable problem & spark", "Confident brand reveal & action"],
    themes: ["Attention Hook", "Value Reveal", "Call to Action"],
    suggestedGenres: ["Upbeat Commercial", "Indie Pop", "Bollywood Pop", "Corporate Synth"],
    mood: "Energetic",
    keyMoments: [
      { momentNumber: 1, description: "3-Second Hook", visualIdea: `Dynamic close-up lifestyle shot capturing immediate curiosity for ${brandLabel}, crisp commercial lighting, 8k photorealistic`, suggestedDurationSeconds: 4 },
      { momentNumber: 2, description: "Product / Event Showcase", visualIdea: `Vibrant hero showcase of ${adBrief.productOrOffer || brandLabel} in action with delighted people, shallow depth of field, studio commercial look`, suggestedDurationSeconds: 5 },
      { momentNumber: 3, description: "Call-to-Action Finale", visualIdea: `Clean cinematic commercial end-card framing ${brandLabel} with confident celebratory energy and clear composition for headline overlay`, suggestedDurationSeconds: 4 }
    ],
    adStrategy: {
      hook: `Stop scrolling — see why everyone is talking about ${brandLabel}!`,
      painPointOrDesire: adBrief.productOrOffer || `Looking for an unforgettable experience that stands out?`,
      valueProposition: `${brandLabel} delivers instant impact, quality, and memorable value.`,
      jingleHookIdea: audioMode === "hybrid_conversation_song" ? `${brandLabel} — shine brighter, live louder today!` : "",
      callToActionLine: ctaLabel,
      pacingStyle: `Fast ${targetSec}s commercial cuts (3-5s per shot)`
    }
  };

  if (!clientInfo) return mockAdAnalysis;

  try {
    const langInstruction = langConfig.code === "hinglish"
      ? "Hinglish (modern conversational blend of Hindi and English written in Roman/Latin script)"
      : `${langConfig.name} (${langConfig.nativeName})`;

    let contextLines = `Target Duration: ${targetSec} seconds.\nAudio Mode: ${audioMode}.\nSpeaker Format: ${adBrief.speakerFormat || "two_speaker_chat"}.\n`;
    if (adBrief.brandName) contextLines += `Brand / Organization: ${adBrief.brandName}.\n`;
    if (adBrief.productOrOffer) contextLines += `Product / Offer / Promo Focus: ${adBrief.productOrOffer}.\n`;
    if (adBrief.objective) contextLines += `Campaign Objective: ${adBrief.objective}.\n`;
    if (adBrief.targetAudience) contextLines += `Target Audience: ${adBrief.targetAudience}.\n`;
    if (adBrief.callToAction) contextLines += `Call-to-Action (CTA): ${adBrief.callToAction}${adBrief.ctaSubtext ? ` (${adBrief.ctaSubtext})` : ""}.\n`;
    if (eventContext?.title) {
      contextLines += `Linked Event Context: "${eventContext.title}"${eventContext.date ? ` on ${new Date(eventContext.date).toDateString()}` : ""}${eventContext.location ? ` at ${eventContext.location}` : ""}.\n`;
    } else {
      contextLines += `Workspace Scope: Standalone Brand / Product Commercial (not tied to a single event).\n`;
    }
    if (characters.length > 0) {
      const charList = characters.filter(c => c?.name).map(c => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ");
      if (charList) contextLines += `Cast / Spokespeople: ${charList}.\n`;
    }
    if (directorGuidelines?.trim()) {
      contextLines += `Creative Director Guidelines: "${directorGuidelines.trim()}".\n`;
    }

    const prompt = `You are an award-winning commercial creative director. Analyze this short advertisement brief for a ${targetSec}-second promo video in ${langInstruction}.
${contextLines}
Raw Ad Concept / Notes:
"""
${(briefText || "").slice(0, 4000)}
"""

Return a structured commercial strategy JSON with:
- summary (2-3 punchy sentences in ${langInstruction})
- emotionalArc (3 stages in ${langInstruction})
- themes (3 short tags in ${langInstruction})
- suggestedGenres (3-4 musical/underscore styles suitable for this ad)
- mood (1-2 words)
- keyMoments (3 to 5 commercial visual beats; write visualIdea in English for photorealistic commercial scene generation, 3-5s each)
- adStrategy: { hook, painPointOrDesire, valueProposition, jingleHookIdea (catchy 1-2 line sung hook in ${langInstruction} if hybrid jingle fits, or empty string if no song), callToActionLine (in ${langInstruction}), pacingStyle }`;

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
            },
            adStrategy: {
              type: Type.OBJECT,
              properties: {
                hook: { type: Type.STRING },
                painPointOrDesire: { type: Type.STRING },
                valueProposition: { type: Type.STRING },
                jingleHookIdea: { type: Type.STRING },
                callToActionLine: { type: Type.STRING },
                pacingStyle: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const cleanJsonText = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    return { ...mockAdAnalysis, ...JSON.parse(cleanJsonText) };
  } catch (err) {
    console.warn("Gemini ad brief analysis failed, using local commercial strategy:", err.message);
    return mockAdAnalysis;
  }
}

// 6. Generate Timed Multi-Speaker / Hybrid Jingle Commercial Script Segments
export async function generateAdScriptWithGemini({
  storyText = "",
  adBrief = {},
  analysis = null,
  eventContext = null,
  language = "en",
  characters = [],
  directorGuidelines = ""
}) {
  const clientInfo = getGeminiClient();
  const langConfig = getLanguageConfig(language);
  const targetSec = Number(adBrief.targetDurationSeconds) || 30;
  const audioMode = adBrief.audioMode || "hybrid_conversation_song";
  const speakerFormat = adBrief.speakerFormat || "two_speaker_chat";
  const brandLabel = adBrief.brandName || eventContext?.title || "Our Brand";
  const offerLabel = adBrief.productOrOffer || storyText.slice(0, 100) || "something extraordinary";
  const ctaLabel = adBrief.callToAction || analysis?.adStrategy?.callToActionLine || `Check out ${brandLabel} today!`;

  // Determine default Speaker A (female) & Speaker B (male) names from cast or language defaults
  const femaleChar = characters.find(c => c?.voiceGender === "female") || characters[0];
  const maleChar = characters.find(c => c?.voiceGender === "male" && c !== femaleChar) || characters[1];
  const defaultSpeakerA = femaleChar?.name || (langConfig.code === "en" ? "Maya" : "Priya");
  const defaultSpeakerB = maleChar?.name || (langConfig.code === "en" ? "Liam" : "Aarav");

  const buildFallbackSegments = () => {
    if (audioMode === "visual_only") {
      const beatCount = Math.max(3, Math.round(targetSec / 5));
      const beatDur = Number((targetSec / beatCount).toFixed(1));
      const headlines = [
        brandLabel,
        adBrief.productOrOffer || "Experience Excellence",
        analysis?.adStrategy?.valueProposition?.slice(0, 48) || "Crafted For You",
        ctaLabel
      ];
      return Array.from({ length: beatCount }, (_, idx) => {
        const isLast = idx === beatCount - 1;
        const start = Number((idx * beatDur).toFixed(1));
        const end = isLast ? targetSec : Number(((idx + 1) * beatDur).toFixed(1));
        return {
          segmentOrder: idx + 1,
          segmentType: "visual_beat",
          speakerName: "On-Screen Text",
          voiceRole: "narrator",
          voiceGender: "female",
          text: "",
          onScreenHeadline: isLast ? ctaLabel : (headlines[idx % headlines.length] || brandLabel),
          targetDurationSeconds: Math.max(2, Math.round(end - start)),
          startTimeSeconds: start,
          endTimeSeconds: end,
          bgmBehavior: "full"
        };
      });
    }

    if (audioMode === "hybrid_conversation_song") {
      const introA = Math.max(3, Math.round(targetSec * 0.2));
      const introB = Math.max(3, Math.round(targetSec * 0.2));
      const jingleDur = Math.max(6, Math.round(targetSec * 0.4));
      const ctaDur = Math.max(3, targetSec - introA - introB - jingleDur);

      const line1 = langConfig.code === "hi"
        ? `अरे ${defaultSpeakerB}, क्या तुमने ${brandLabel} के बारे में सुना?`
        : langConfig.code === "hinglish"
        ? `Hey ${defaultSpeakerB}, tune ${brandLabel} ka naya offer dekha kya?`
        : `Hey ${defaultSpeakerB}, have you seen what ${brandLabel} just launched?`;

      const line2 = langConfig.code === "hi"
        ? `अभी देखा! ${offerLabel} तो वाकई कमाल का है!`
        : langConfig.code === "hinglish"
        ? `Haan yaar! ${offerLabel} toh seriously next level hai!`
        : `Just saw it — ${offerLabel} changes everything!`;

      const jingleText = langConfig.code === "hi"
        ? `${brandLabel} के संग चमके हर पल, खुशियों का नया है कल!`
        : langConfig.code === "hinglish"
        ? `${brandLabel} ka hai yeh zamana, har moment ko special banana!`
        : `Step into the moment with ${brandLabel}, brighter every single day!`;

      return [
        {
          segmentOrder: 1,
          segmentType: "dialogue",
          speakerName: speakerFormat === "single_narrator" ? "Narrator" : defaultSpeakerA,
          voiceRole: speakerFormat === "single_narrator" ? "narrator" : "speaker_a",
          voiceGender: "female",
          text: line1,
          onScreenHeadline: brandLabel,
          targetDurationSeconds: introA,
          startTimeSeconds: 0,
          endTimeSeconds: introA,
          bgmBehavior: "ducked"
        },
        {
          segmentOrder: 2,
          segmentType: "dialogue",
          speakerName: speakerFormat === "single_narrator" ? "Narrator" : defaultSpeakerB,
          voiceRole: speakerFormat === "single_narrator" ? "narrator" : "speaker_b",
          voiceGender: "male",
          text: line2,
          onScreenHeadline: adBrief.productOrOffer || "",
          targetDurationSeconds: introB,
          startTimeSeconds: introA,
          endTimeSeconds: introA + introB,
          bgmBehavior: "ducked"
        },
        {
          segmentOrder: 3,
          segmentType: "sung_jingle",
          speakerName: "Brand Jingle",
          voiceRole: "jingle_vocal",
          voiceGender: "female",
          text: jingleText,
          onScreenHeadline: brandLabel,
          targetDurationSeconds: jingleDur,
          startTimeSeconds: introA + introB,
          endTimeSeconds: introA + introB + jingleDur,
          bgmBehavior: "full"
        },
        {
          segmentOrder: 4,
          segmentType: "narration",
          speakerName: "Announcer",
          voiceRole: "narrator",
          voiceGender: "male",
          text: ctaLabel,
          onScreenHeadline: ctaLabel,
          targetDurationSeconds: ctaDur,
          startTimeSeconds: introA + introB + jingleDur,
          endTimeSeconds: targetSec,
          bgmBehavior: "ducked"
        }
      ];
    }

    // dialogue_only or dialogue_bgm
    const bgmMode = audioMode === "dialogue_bgm" ? "ducked" : "none";
    if (speakerFormat === "single_narrator") {
      const d1 = Math.round(targetSec * 0.35);
      const d2 = Math.round(targetSec * 0.35);
      const d3 = Math.max(3, targetSec - d1 - d2);
      return [
        {
          segmentOrder: 1,
          segmentType: "narration",
          speakerName: "Narrator",
          voiceRole: "narrator",
          voiceGender: "female",
          text: analysis?.adStrategy?.hook || `Ready for something remarkable from ${brandLabel}?`,
          onScreenHeadline: brandLabel,
          targetDurationSeconds: d1,
          startTimeSeconds: 0,
          endTimeSeconds: d1,
          bgmBehavior: bgmMode
        },
        {
          segmentOrder: 2,
          segmentType: "narration",
          speakerName: "Narrator",
          voiceRole: "narrator",
          voiceGender: "female",
          text: `${offerLabel}.`,
          onScreenHeadline: adBrief.productOrOffer || "",
          targetDurationSeconds: d2,
          startTimeSeconds: d1,
          endTimeSeconds: d1 + d2,
          bgmBehavior: bgmMode
        },
        {
          segmentOrder: 3,
          segmentType: "narration",
          speakerName: "Narrator",
          voiceRole: "narrator",
          voiceGender: "female",
          text: ctaLabel,
          onScreenHeadline: ctaLabel,
          targetDurationSeconds: d3,
          startTimeSeconds: d1 + d2,
          endTimeSeconds: targetSec,
          bgmBehavior: bgmMode
        }
      ];
    }

    const d1 = Math.round(targetSec * 0.35);
    const d2 = Math.round(targetSec * 0.35);
    const d3 = Math.max(3, targetSec - d1 - d2);
    return [
      {
        segmentOrder: 1,
        segmentType: "dialogue",
        speakerName: defaultSpeakerA,
        voiceRole: "speaker_a",
        voiceGender: "female",
        text: langConfig.code === "hinglish"
          ? `Sun ${defaultSpeakerB}, ${brandLabel} ke baare mein suna kya?`
          : `Hey ${defaultSpeakerB}, did you hear the big news from ${brandLabel}?`,
        onScreenHeadline: brandLabel,
        targetDurationSeconds: d1,
        startTimeSeconds: 0,
        endTimeSeconds: d1,
        bgmBehavior: bgmMode
      },
      {
        segmentOrder: 2,
        segmentType: "dialogue",
        speakerName: defaultSpeakerB,
        voiceRole: "speaker_b",
        voiceGender: "male",
        text: langConfig.code === "hinglish"
          ? `Bilkul! ${offerLabel} sabke liye game-changer hai!`
          : `Absolutely — ${offerLabel} is exactly what we needed!`,
        onScreenHeadline: adBrief.productOrOffer || "",
        targetDurationSeconds: d2,
        startTimeSeconds: d1,
        endTimeSeconds: d1 + d2,
        bgmBehavior: bgmMode
      },
      {
        segmentOrder: 3,
        segmentType: "narration",
        speakerName: "Announcer",
        voiceRole: "narrator",
        voiceGender: "male",
        text: ctaLabel,
        onScreenHeadline: ctaLabel,
        targetDurationSeconds: d3,
        startTimeSeconds: d1 + d2,
        endTimeSeconds: targetSec,
        bgmBehavior: bgmMode
      }
    ];
  };

  const fallbackSegments = buildFallbackSegments();
  if (!clientInfo) return fallbackSegments;

  try {
    const langDisplay = langConfig.code === "hinglish"
      ? "Hinglish (natural modern blend of Hindi and English in Roman/Latin alphabet — do NOT use Devanagari)"
      : `${langConfig.name} (${langConfig.nativeName})`;

    const totalWordBudget = Math.max(20, Math.round(targetSec * 2.1));

    let modeRules = "";
    if (audioMode === "dialogue_only") {
      modeRules = `AUDIO MODE: Pure Conversation / Voiceover Only (NO SONG, NO BGM).
- Use ONLY segmentType "dialogue" and "narration" (do NOT include "sung_jingle").
- Set bgmBehavior = "none" on every segment.
- ${speakerFormat === "single_narrator" ? `Use a single persuasive narrator (voiceRole "narrator").` : `Write natural back-and-forth conversational dialogue between ${defaultSpeakerA} (voiceRole "speaker_a", voiceGender "female") and ${defaultSpeakerB} (voiceRole "speaker_b", voiceGender "male"), ending with a crisp closing Call-to-Action segment (voiceRole "narrator").`}`;
    } else if (audioMode === "dialogue_bgm") {
      modeRules = `AUDIO MODE: Conversation / Voiceover over Soft Instrumental Background Music (NO SINGING).
- Use ONLY segmentType "dialogue" and "narration" (do NOT include "sung_jingle").
- Set bgmBehavior = "ducked" on every segment.
- ${speakerFormat === "single_narrator" ? `Use a single charismatic narrator (voiceRole "narrator").` : `Write engaging conversational banter between ${defaultSpeakerA} (voiceRole "speaker_a", voiceGender "female") and ${defaultSpeakerB} (voiceRole "speaker_b", voiceGender "male"), finishing with a punchy Call-to-Action line (voiceRole "narrator").`}`;
    } else if (audioMode === "hybrid_conversation_song") {
      modeRules = `AUDIO MODE: Hybrid Mixup of Conversation + Catchy Sung Brand Jingle!
- Structure the ${targetSec}s ad dynamically:
  1. Start with 1 to 3 short spoken conversational hook segments (segmentType "dialogue", using ${defaultSpeakerA} [speaker_a, female] and ${defaultSpeakerB} [speaker_b, male], bgmBehavior "ducked" or "none").
  2. Transition into 1 catchy, memorable SUNG JINGLE segment (segmentType "sung_jingle", voiceRole "jingle_vocal", bgmBehavior "full", lasting ~8 to ${Math.min(18, Math.round(targetSec * 0.45))} seconds with rhythmic, rhyming ad jingle lyrics celebrating ${brandLabel}).
  3. Finish with 1 crisp spoken Call-to-Action outro segment (segmentType "narration", voiceRole "narrator", bgmBehavior "ducked") delivering the CTA: "${ctaLabel}".`;
    } else {
      modeRules = `AUDIO MODE: Visual / Kinetic Poster Ad Only (Zero Spoken Voiceover).
- Every segment MUST use segmentType "visual_beat", text = "", bgmBehavior = "full", and a bold, short 2-6 word "onScreenHeadline" in ${langDisplay} ending with the CTA "${ctaLabel}".`;
    }

    let castInfo = "";
    if (characters.length > 0) {
      castInfo = `\nDefined Cast:\n` + characters.map(c => `- ${c.name} (${c.role || "Cast"}, gender: ${c.voiceGender || "female"}, roleSlot: ${c.voiceRole || "speaker_a"})`).join("\n");
    }

    const prompt = `Write a timed ${targetSec}-second short advertisement script in ${langDisplay}.
Brand / Title: "${brandLabel}"
Offer / Key Message: "${adBrief.productOrOffer || ""}"
Audience: "${adBrief.targetAudience || "General audience"}"
Call-to-Action (CTA): "${ctaLabel}"${adBrief.ctaSubtext ? ` (${adBrief.ctaSubtext})` : ""}
${eventContext?.title ? `Linked Event: "${eventContext.title}" (${eventContext.location || ""})` : "Standalone Brand/Product Ad"}
Raw Ad Brief: "${storyText.slice(0, 1500)}"
${analysis?.summary ? `Strategy Summary: "${analysis.summary}"` : ""}
${directorGuidelines ? `Director Notes: "${directorGuidelines}"` : ""}
${castInfo}

${modeRules}

TIMING & PACING RULES:
1. Keep total spoken/sung words around ${totalWordBudget} words maximum so speech sounds natural and unhurried within ${targetSec} seconds (~2.2 words/sec).
2. Generate between ${targetSec <= 15 ? "3 and 4" : targetSec <= 30 ? "4 and 6" : "5 and 9"} ordered segments covering 0s to ${targetSec}s continuously.
3. Each segment needs a short, punchy onScreenHeadline (max 6 words) for key visual emphasis, especially the final CTA segment.

Return a JSON array of script segments.`;

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
              segmentOrder: { type: Type.INTEGER },
              segmentType: { type: Type.STRING },
              speakerName: { type: Type.STRING },
              voiceRole: { type: Type.STRING },
              voiceGender: { type: Type.STRING },
              text: { type: Type.STRING },
              onScreenHeadline: { type: Type.STRING },
              targetDurationSeconds: { type: Type.NUMBER },
              startTimeSeconds: { type: Type.NUMBER },
              endTimeSeconds: { type: Type.NUMBER },
              bgmBehavior: { type: Type.STRING }
            },
            required: ["segmentOrder", "segmentType", "speakerName", "text", "targetDurationSeconds"]
          }
        }
      }
    });

    const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let cursor = 0;
      const validTypes = ["dialogue", "narration", "sung_jingle", "visual_beat"];
      const validRoles = ["speaker_a", "speaker_b", "narrator", "jingle_vocal"];
      const validBgm = ["none", "ducked", "full"];

      const normalized = parsed.map((seg, idx) => {
        let segType = validTypes.includes(seg.segmentType) ? seg.segmentType : "dialogue";
        if ((audioMode === "dialogue_only" || audioMode === "dialogue_bgm") && segType === "sung_jingle") {
          segType = "dialogue";
        }
        if (audioMode === "visual_only") {
          segType = "visual_beat";
        }
        const dur = Math.max(2, Number(seg.targetDurationSeconds) || 4);
        const start = Number(cursor.toFixed(1));
        cursor += dur;
        const end = Number(cursor.toFixed(1));
        return {
          segmentOrder: idx + 1,
          segmentType: segType,
          speakerName: seg.speakerName || (segType === "sung_jingle" ? "Brand Jingle" : "Narrator"),
          voiceRole: validRoles.includes(seg.voiceRole)
            ? seg.voiceRole
            : (segType === "sung_jingle" ? "jingle_vocal" : segType === "narration" ? "narrator" : idx % 2 === 0 ? "speaker_a" : "speaker_b"),
          voiceGender: String(seg.voiceGender || "").toLowerCase() === "male" ? "male" : "female",
          text: segType === "visual_beat" ? "" : (seg.text || ""),
          onScreenHeadline: seg.onScreenHeadline || (idx === parsed.length - 1 ? ctaLabel : ""),
          targetDurationSeconds: dur,
          startTimeSeconds: start,
          endTimeSeconds: end,
          bgmBehavior: audioMode === "dialogue_only"
            ? "none"
            : (validBgm.includes(seg.bgmBehavior) ? seg.bgmBehavior : (segType === "sung_jingle" ? "full" : "ducked"))
        };
      });
      return normalized;
    }
    return fallbackSegments;
  } catch (err) {
    console.warn("Gemini ad script generation failed, using structured fallback:", err.message);
    return fallbackSegments;
  }
}

// 7. Generate Commercial Storyboard Synchronized to Ad Script Segments
export async function generateAdStoryboard({
  storyContext = "",
  adBrief = {},
  scriptSegments = [],
  totalDurationSeconds = 30,
  language = "en",
  characters = [],
  directorGuidelines = "",
  eventContext = null
}) {
  const clientInfo = getGeminiClient();
  const langConfig = getLanguageConfig(language);
  const brandLabel = adBrief.brandName || eventContext?.title || "Featured Brand";
  const ctaHeadline = adBrief.callToAction || `Discover ${brandLabel}`;

  // Build deterministic commercial fallback scenes directly aligned with scriptSegments
  const buildFallbackAdScenes = () => {
    if (Array.isArray(scriptSegments) && scriptSegments.length > 0) {
      return scriptSegments.map((seg, idx) => {
        const isLast = idx === scriptSegments.length - 1;
        const start = typeof seg.startTimeSeconds === "number" ? seg.startTimeSeconds : idx * 5;
        const end = typeof seg.endTimeSeconds === "number" && seg.endTimeSeconds > start
          ? seg.endTimeSeconds
          : Math.min(totalDurationSeconds, start + (seg.targetDurationSeconds || 5));
        const matchedChar = characters.find(c => c?.name && seg.speakerName && c.name.toLowerCase() === seg.speakerName.toLowerCase());
        const charDesc = matchedChar ? `featuring ${matchedChar.name} (${matchedChar.visualDescription || matchedChar.role || "spokesperson"})` : "";
        return {
          sceneNumber: idx + 1,
          startTimeSeconds: Number(start.toFixed(2)),
          endTimeSeconds: Number((isLast ? Math.max(end, totalDurationSeconds) : end).toFixed(2)),
          durationSeconds: Number(Math.max(1.5, (isLast ? Math.max(end, totalDurationSeconds) : end) - start).toFixed(2)),
          segmentType: isLast ? "cta_endcard" : (seg.segmentType || "dialogue"),
          speakerName: seg.speakerName || "",
          onScreenHeadline: seg.onScreenHeadline || (isLast ? ctaHeadline : ""),
          lyricSnippet: seg.text || seg.onScreenHeadline || brandLabel,
          visualIdea: isLast
            ? `Sleek commercial hero end-card shot showcasing ${brandLabel} ${adBrief.productOrOffer || ""}, bold clean studio lighting, 8k advertising cinematography`
            : `Modern high-end commercial shot ${charDesc} illustrating "${(seg.text || seg.onScreenHeadline || brandLabel).slice(0, 80)}", crisp shallow depth of field, vibrant natural lighting`,
          characters: matchedChar ? [matchedChar.name] : []
        };
      });
    }

    const count = Math.max(3, Math.round(totalDurationSeconds / 5));
    const step = Number((totalDurationSeconds / count).toFixed(2));
    return Array.from({ length: count }, (_, i) => ({
      sceneNumber: i + 1,
      startTimeSeconds: Number((i * step).toFixed(2)),
      endTimeSeconds: i === count - 1 ? totalDurationSeconds : Number(((i + 1) * step).toFixed(2)),
      durationSeconds: step,
      segmentType: i === count - 1 ? "cta_endcard" : "dialogue",
      speakerName: "",
      onScreenHeadline: i === count - 1 ? ctaHeadline : brandLabel,
      lyricSnippet: i === count - 1 ? ctaHeadline : `Ad Scene ${i + 1}`,
      visualIdea: `High-impact commercial cinematography for ${brandLabel}, scene ${i + 1}, photorealistic 8k lighting`,
      characters: []
    }));
  };

  const fallbackScenes = buildFallbackAdScenes();
  if (!clientInfo || !Array.isArray(scriptSegments) || scriptSegments.length === 0) {
    return fallbackScenes;
  }

  try {
    let castBlock = "";
    if (Array.isArray(characters) && characters.length > 0) {
      const lines = characters
        .filter(c => c?.name)
        .map(c => `- ${c.name}${c.role ? ` (${c.role})` : ""}: ${c.visualDescription || "Commercial talent"}`)
        .join("\n");
      if (lines) {
        castBlock = `\nCAST / TALENT VISUAL ANCHORS:\n${lines}\nWhenever a speaker or cast member appears on screen, explicitly include their visualDescription (face, attire, age, style) inside visualIdea for visual consistency!\n`;
      }
    }

    const segmentsPromptText = scriptSegments
      .map((s, idx) => `Segment ${idx + 1} [${s.startTimeSeconds}s - ${s.endTimeSeconds}s] (${s.segmentType}, Speaker: ${s.speakerName || "N/A"}): "${s.text || s.onScreenHeadline || ""}" | Headline: "${s.onScreenHeadline || ""}"`)
      .join("\n");

    const prompt = `You are a commercial film director storyboarding a ${totalDurationSeconds}-second advertisement in ${langConfig.name}.
Brand / Campaign: "${brandLabel}" — ${adBrief.productOrOffer || ""}
Call-to-Action: "${ctaHeadline}"
Ad Context: "${storyContext.slice(0, 600)}"
${directorGuidelines ? `Director Guidelines: "${directorGuidelines}"` : ""}
${castBlock}
Timed Audio & Script Segments:
${segmentsPromptText}

Create commercial storyboard scenes synchronized strictly to these timed segments:
1. Map each script segment to a vivid commercial camera shot (if a sung_jingle segment is longer than 8 seconds, you may split it into 2 fast montage scenes; otherwise keep 1 scene per segment with exact matching startTimeSeconds and endTimeSeconds).
2. Write visualIdea in English with commercial camera framing (close-up reaction, two-person conversational framing, product hero macro, dynamic lifestyle montage, clean CTA end-card).
3. Preserve lyricSnippet (the exact spoken line or sung jingle line for subtitles), speakerName, segmentType, and a short punchy onScreenHeadline (ensure the final scene has "${ctaHeadline}" as onScreenHeadline).
4. Start at 0s and end at ${totalDurationSeconds}s.

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
              segmentType: { type: Type.STRING },
              speakerName: { type: Type.STRING },
              onScreenHeadline: { type: Type.STRING },
              lyricSnippet: { type: Type.STRING },
              visualIdea: { type: Type.STRING },
              characters: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["sceneNumber", "startTimeSeconds", "endTimeSeconds", "lyricSnippet", "visualIdea"]
          }
        }
      }
    });

    const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed[0].startTimeSeconds = 0;
      parsed[parsed.length - 1].endTimeSeconds = totalDurationSeconds;
      if (!parsed[parsed.length - 1].onScreenHeadline && ctaHeadline) {
        parsed[parsed.length - 1].onScreenHeadline = ctaHeadline;
      }
      return parsed;
    }
    return fallbackScenes;
  } catch (err) {
    console.warn("Gemini ad storyboard generation failed, using aligned fallback:", err.message);
    return fallbackScenes;
  }
}
