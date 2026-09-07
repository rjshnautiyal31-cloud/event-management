import path from "path";
import fs from "fs";
import https from "https";
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import textToSpeech from "@google-cloud/text-to-speech";
import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

const fsPromises = fs.promises;
ffmpeg.setFfmpegPath(ffmpegInstaller);

export function getAudioDurationFromFile(filePath) {
  return new Promise((resolve) => {
    execFile(ffmpegInstaller, ["-i", filePath], (err, stdout, stderr) => {
      const match = (stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const mins = parseFloat(match[2]);
        const secs = parseFloat(match[3]);
        resolve(Math.round(hours * 3600 + mins * 60 + secs));
      } else {
        resolve(180);
      }
    });
  });
}

function extractLyricsFromLyriaOutput(outputText) {
  if (!outputText) return "";
  const lines = outputText.split("\n");
  const lyricLines = [];
  for (const line of lines) {
    const m = line.match(/^\[(?:\d+\.?\d*)?:\]\s*(.*)$/);
    if (m && m[1].trim() && !m[1].includes("(") && !m[1].startsWith("[")) {
      lyricLines.push(m[1].trim());
    } else if (m && m[1].trim()) {
      lyricLines.push(m[1].trim());
    }
  }
  return lyricLines.join("\n");
}

// Multi-Genre Musical Chord & Rhythm Generator
export function createMusicalMelodyWavBuffer(durationSeconds = 30, sampleRate = 44100, genre = "Pop") {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV Header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Distinct Chord Progressions by Genre
  let chords = [
    [261.63, 329.63, 392.00], // C major
    [196.00, 246.94, 293.66], // G major
    [220.00, 261.63, 329.63], // A minor
    [174.61, 220.00, 261.63]  // F major
  ];
  let tempoSpeed = 3.5;

  const normalizedGenre = (genre || "Pop").toLowerCase();
  if (normalizedGenre.includes("acoustic")) {
    chords = [
      [164.81, 196.00, 246.94], // E minor
      [261.63, 329.63, 392.00], // C major
      [196.00, 246.94, 293.66], // G major
      [146.83, 185.00, 220.00]  // D major
    ];
    tempoSpeed = 4.2;
  } else if (normalizedGenre.includes("cinematic") || normalizedGenre.includes("orchestral")) {
    chords = [
      [146.83, 174.61, 220.00], // D minor
      [116.54, 146.83, 174.61], // Bb major
      [174.61, 220.00, 261.63], // F major
      [130.81, 164.81, 196.00]  // C major
    ];
    tempoSpeed = 5.0;
  } else if (normalizedGenre.includes("rock") || normalizedGenre.includes("energy")) {
    chords = [
      [220.00, 261.63, 329.63], // A minor
      [174.61, 220.00, 261.63], // F major
      [261.63, 329.63, 392.00], // C major
      [196.00, 246.94, 293.66]  // G major
    ];
    tempoSpeed = 2.5;
  }

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor((t / tempoSpeed)) % chords.length;
    const currentChord = chords[chordIndex];

    let sample = 0;
    currentChord.forEach((freq) => {
      const note = Math.sin(2 * Math.PI * freq * t) * 0.15 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.05;
      sample += note;
    });

    const arpeggioFreq = currentChord[Math.floor((t * 5) % 3)];
    sample += Math.sin(2 * Math.PI * arpeggioFreq * t) * 0.08;

    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 16000)));
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

// OAuth2 Authenticated Google Cloud Text-to-Speech Studio Vocal Adapter
async function fetchGoogleCloudNeuralVocalAudio(lyricsText, tempVocalPath) {
  const cleanLyrics = (lyricsText || "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanLyrics) return false;

  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");

  try {
    const clientOptions = {};
    if (fs.existsSync(keyFilename)) {
      clientOptions.keyFilename = keyFilename;
    } else if (env.geminiApiKey) {
      clientOptions.apiKey = env.geminiApiKey;
    }

    const ttsClient = new textToSpeech.TextToSpeechClient(clientOptions);

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text: cleanLyrics },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-F",
        ssmlGender: "FEMALE"
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 0.95,
        pitch: 1.2
      }
    });

    if (response.audioContent) {
      await fsPromises.writeFile(tempVocalPath, response.audioContent, "binary");
      console.log(`[Google Cloud TTS OAuth2] Successfully synthesized Google Neural2 Studio Vocal audio file (${response.audioContent.length} bytes)`);
      return true;
    }
  } catch (err) {
    console.warn("Google Cloud OAuth2 TTS call failed, falling back to local vocal synthesis:", err.message);
  }

  return false;
}

// Multi-chunk Zero-Loss Vocal Audio Fetcher
async function fetchFallbackVocalAudio(lyricsText, tempVocalPath) {
  const cleanLyrics = (lyricsText || "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanLyrics) return false;

  const sentences = cleanLyrics.match(/.{1,140}(\s+|$)/g) || [cleanLyrics];
  const chunkBuffers = [];
  const agent = new https.Agent({ rejectUnauthorized: false });

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(sentence)}&tl=en`;

    const chunkBuf = await new Promise((resolve) => {
      const chunks = [];
      const req = https.get(url, { agent, headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, (res) => {
        if (res.statusCode === 200) {
          res.on("data", c => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        } else {
          resolve(null);
        }
      });
      req.on("error", () => resolve(null));
    });

    if (chunkBuf && chunkBuf.length > 0) {
      chunkBuffers.push(chunkBuf);
    }
  }

  if (chunkBuffers.length === 0) return false;

  const combinedVocalBuffer = Buffer.concat(chunkBuffers);
  await fsPromises.writeFile(tempVocalPath, combinedVocalBuffer);
  console.log(`[Vocal Synthesis Engine] Successfully synthesized vocal audio buffer of ${combinedVocalBuffer.length} bytes`);
  return true;
}

// Google Cloud Vocal & Music Song Adapter
class GoogleTtsMusicAdapter {
  async generateMusic({ lyrics = "", genre = "Pop", durationSeconds = 30 }) {
    const timestamp = Date.now();
    const uploadDir = path.join(process.cwd(), "uploads");
    await fsPromises.mkdir(uploadDir, { recursive: true });

    const bgPath = path.join(uploadDir, `bg_${timestamp}.wav`);
    const vocalPath = path.join(uploadDir, `vocal_${timestamp}.mp3`);
    const outputFilename = `google_song_${timestamp}.mp3`;
    const outputPath = path.join(uploadDir, outputFilename);

    // 1. Generate background musical chord progression matching selected genre & duration
    const wavBuffer = createMusicalMelodyWavBuffer(durationSeconds, 44100, genre);
    await fsPromises.writeFile(bgPath, wavBuffer);

    // 2. Fetch vocal audio via OAuth2 Google Cloud Neural2 TTS or Multi-chunk fallback
    let hasVocals = await fetchGoogleCloudNeuralVocalAudio(lyrics, vocalPath);
    if (!hasVocals) {
      hasVocals = await fetchFallbackVocalAudio(lyrics, vocalPath);
    }

    // 3. Mix vocal audio track with background music using FFmpeg
    if (hasVocals) {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(bgPath)
          .input(vocalPath)
          .complexFilter([
            "[0:a]volume=0.20[bg]",
            "[1:a]volume=2.5[voc]",
            "[bg][voc]amix=inputs=2:duration=first[a]"
          ])
          .outputOptions(["-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k"])
          .save(outputPath)
          .on("end", resolve)
          .on("error", (err) => {
            console.error("FFmpeg amix error:", err.message);
            reject(err);
          });
      });

      // Cleanup temporary stem files
      await fsPromises.unlink(bgPath).catch(() => {});
      await fsPromises.unlink(vocalPath).catch(() => {});
    } else {
      await fsPromises.rename(bgPath, outputPath);
    }

    return {
      audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
      durationSeconds
    };
  }
}

// Local Synth Music Adapter
class LocalSynthMusicAdapter {
  async generateMusic({ lyrics = "", genre = "Pop", durationSeconds = 30 }) {
    return new GoogleTtsMusicAdapter().generateMusic({ lyrics, genre, durationSeconds });
  }
}

// Suno AI Production Cloud Music Adapter
class SunoMusicAdapter {
  async generateMusic({ lyrics, genre, durationSeconds = 30 }) {
    const apiKey = env.musicApiKey || env.sunoApiKey;
    if (!apiKey) {
      return new GoogleTtsMusicAdapter().generateMusic({ lyrics, genre, durationSeconds });
    }

    try {
      const response = await fetch("https://api.suno.ai/v1/generate", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: lyrics,
          tags: genre,
          title: "Event Song",
          make_instrumental: false,
          wait_audio: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        const audioUrl = data[0]?.audio_url || data.audio_url;
        if (audioUrl) return { audioUrl, durationSeconds };
      }
    } catch (err) {
      console.error("Suno AI music generation error:", err.message);
    }

    return new GoogleTtsMusicAdapter().generateMusic({ lyrics, genre, durationSeconds });
  }
}

// ElevenLabs Production Text-to-Music Adapter
class ElevenLabsMusicAdapter {
  async generateMusic({ lyrics = "", genre = "Pop", durationSeconds = 30 }) {
    const apiKey = env.elevenLabsApiKey || env.musicApiKey;
    if (!apiKey) {
      console.warn("[ElevenLabs] ELEVENLABS_API_KEY missing, falling back to Google Cloud TTS adapter");
      return new GoogleTtsMusicAdapter().generateMusic({ lyrics, genre, durationSeconds });
    }

    const timestamp = Date.now();
    const uploadDir = path.join(process.cwd(), "uploads");
    await fsPromises.mkdir(uploadDir, { recursive: true });

    const outputFilename = `eleven_song_${timestamp}.mp3`;
    const outputPath = path.join(uploadDir, outputFilename);

    const cleanLyrics = (lyrics || "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
    const promptText = `A ${genre} style song with full vocals and melody. Lyrics: ${cleanLyrics}`;

    // 1. Try ElevenLabs Official Text-to-Music Endpoint (POST /v1/music)
    try {
      console.log(`[ElevenLabs Music API] Requesting AI song generation from https://api.elevenlabs.io/v1/music...`);
      const musicResponse = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: promptText,
          music_length_ms: Math.min(600000, Math.max(3000, durationSeconds * 1000)),
          model_id: "music_v1",
          force_instrumental: false,
          output_format: "mp3_44100_128"
        })
      });

      if (musicResponse.ok) {
        const audioBuffer = Buffer.from(await musicResponse.arrayBuffer());
        await fsPromises.writeFile(outputPath, audioBuffer);
        console.log(`[ElevenLabs Music API] Successfully generated full ElevenLabs AI song (${audioBuffer.length} bytes)`);
        return {
          audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
          durationSeconds
        };
      } else {
        const errText = await musicResponse.text();
        console.warn(`[ElevenLabs Music API] v1/music endpoint returned ${musicResponse.status}: ${errText}. Falling back to Speech + Music Mix.`);
      }
    } catch (err) {
      console.error("[ElevenLabs Music API] Error calling v1/music:", err.message);
    }

    // 2. Fallback: ElevenLabs Speech TTS (/v1/text-to-speech) mixed with backing track
    const bgPath = path.join(uploadDir, `bg_${timestamp}.wav`);
    const vocalPath = path.join(uploadDir, `vocal_eleven_${timestamp}.mp3`);

    const wavBuffer = createMusicalMelodyWavBuffer(durationSeconds, 44100, genre);
    await fsPromises.writeFile(bgPath, wavBuffer);

    let hasVocals = false;
    try {
      const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: cleanLyrics,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (response.ok) {
        const audioBuffer = Buffer.from(await response.arrayBuffer());
        await fsPromises.writeFile(vocalPath, audioBuffer);
        hasVocals = true;
        console.log(`[ElevenLabs Speech API] Successfully synthesized ElevenLabs vocal track (${audioBuffer.length} bytes)`);
      } else {
        const errText = await response.text();
        console.warn(`[ElevenLabs Speech API] Returned status ${response.status}: ${errText}`);
      }
    } catch (err) {
      console.error("[ElevenLabs Speech API] Error fetching audio:", err.message);
    }

    if (!hasVocals) {
      hasVocals = await fetchGoogleCloudNeuralVocalAudio(lyrics, vocalPath) || await fetchFallbackVocalAudio(lyrics, vocalPath);
    }

    // 3. Mix vocal audio track with background music using FFmpeg
    if (hasVocals) {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(bgPath)
          .input(vocalPath)
          .complexFilter([
            "[0:a]volume=0.20[bg]",
            "[1:a]volume=2.5[voc]",
            "[bg][voc]amix=inputs=2:duration=first[a]"
          ])
          .outputOptions(["-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k"])
          .save(outputPath)
          .on("end", resolve)
          .on("error", (err) => {
            console.error("FFmpeg amix error:", err.message);
            reject(err);
          });
      });

      await fsPromises.unlink(bgPath).catch(() => {});
      await fsPromises.unlink(vocalPath).catch(() => {});
    } else {
      await fsPromises.rename(bgPath, outputPath);
    }

    return {
      audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
      durationSeconds
    };
  }
}

// Google DeepMind Lyria 3 Pro AI Music Adapter (Vertex AI Next-Gen Interactions Model)
export class GoogleLyriaMusicAdapter {
  async generateMusic({ lyrics = "", genre = "Pop", durationSeconds = 30, mood = "Upbeat", storyContext = "", title = "" }) {
    const timestamp = Date.now();
    const uploadDir = path.join(process.cwd(), "uploads");
    await fsPromises.mkdir(uploadDir, { recursive: true });

    try {
      console.log(`[Google Lyria AI Music] Authenticating with Vertex AI for Lyria 3 Pro...`);
      const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
      process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilename;

      const projectId = env.googleCloudProject || "project-2a1614a0-3389-4a26-8d4";
      const ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "global"
      });

      // Construct rich musical prompt incorporating story context and lyrics
      let promptInput = `Song Genre: ${genre} (${mood}).\n`;
      if (title) promptInput += `Title: ${title}.\n`;
      if (storyContext && storyContext.trim()) {
        promptInput += `Story Context / Narrative: ${storyContext.trim().slice(0, 1500)}.\n`;
      }
      if (lyrics && lyrics.trim().length > 10) {
        promptInput += `Lyrics / Thematic Guide:\n${lyrics.trim().slice(0, 1200)}\n`;
      }
      promptInput += `Perform an authentic, cohesive song with full melodic singing vocals, natural harmonies, evocative instrumentation matching ${genre}, and a balanced musical structure (intro, verses, chorus, bridge, outro).`;

      console.log(`[Google Lyria AI Music] Generating full song with lyria-3-pro-preview: "${promptInput.slice(0, 100)}..."`);
      const interaction = await ai.interactions.create({
        model: "lyria-3-pro-preview",
        input: promptInput
      });

      if (interaction?.output_audio?.data) {
        const outputFilename = `lyria_song_${timestamp}.mp3`;
        const outputPath = path.join(uploadDir, outputFilename);
        const audioBuffer = Buffer.from(interaction.output_audio.data, "base64");
        await fsPromises.writeFile(outputPath, audioBuffer);

        const realDuration = await getAudioDurationFromFile(outputPath);
        const extractedLyrics = extractLyricsFromLyriaOutput(interaction.output_text);

        console.log(`[Google Lyria AI Music] Lyria 3 Pro created full song: ${outputFilename} (${realDuration}s, ${audioBuffer.length} bytes)`);
        return {
          audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
          durationSeconds: realDuration,
          lyrics: extractedLyrics || lyrics
        };
      }

      throw new Error("No audio payload returned from Lyria 3 Pro interaction");
    } catch (err) {
      console.warn(`[Google Lyria AI Music] Lyria 3 Pro error: ${err.message}. Attempting legacy lyria-002 fallback...`);
      try {
        const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), "gcp-service-account.json");
        const auth = new GoogleAuth({
          keyFilename,
          scopes: ["https://www.googleapis.com/auth/cloud-platform"]
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const projectId = await auth.getProjectId() || env.googleCloudProject || "project-2a1614a0-3389-4a26-8d4";
        const location = process.env.GOOGLE_CLOUD_LOCATION || env.googleCloudLocation || "us-central1";

        const cleanFallbackPrompt = `Cinematic ${mood.toLowerCase()} soundtrack, ${genre.toLowerCase()} melody, celebratory event atmosphere, lush acoustic stereo mix`;
        const response = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/lyria-002:predict`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token.token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            instances: [{ prompt: cleanFallbackPrompt }],
            parameters: {}
          })
        });

        if (!response.ok) {
          throw new Error(`Lyria-002 fallback HTTP ${response.status}`);
        }

        const data = await response.json();
        const audioBase64 = data.predictions?.[0]?.bytesBase64Encoded || data.predictions?.[0]?.audioContent;
        if (!audioBase64) throw new Error("No audio bytes in lyria-002");

        const rawWavBuffer = Buffer.from(audioBase64, "base64");
        const bgWavPath = path.join(uploadDir, `lyria_bg_${timestamp}.wav`);
        await fsPromises.writeFile(bgWavPath, rawWavBuffer);

        const outputFilename = `lyria_song_${timestamp}.mp3`;
        const outputPath = path.join(uploadDir, outputFilename);

        await new Promise((resolve, reject) => {
          ffmpeg(bgWavPath)
            .audioCodec("libmp3lame")
            .audioBitrate("192k")
            .save(outputPath)
            .on("end", resolve)
            .on("error", reject);
        });
        await fsPromises.unlink(bgWavPath).catch(() => {});

        const realDuration = await getAudioDurationFromFile(outputPath);
        return {
          audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
          durationSeconds: realDuration,
          lyrics
        };
      } catch (fallbackErr) {
        console.warn(`[Google Lyria AI Music] Legacy fallback failed: ${fallbackErr.message}. Defaulting to TTS synth.`);
        return googleTtsSynth.generateMusic({ lyrics, genre, durationSeconds });
      }
    }
  }
}

const googleLyriaSynth = new GoogleLyriaMusicAdapter();
const googleTtsSynth = new GoogleTtsMusicAdapter();
const localSynth = new LocalSynthMusicAdapter();
const sunoSynth = new SunoMusicAdapter();
const elevenLabsSynth = new ElevenLabsMusicAdapter();

export function getMusicProvider(providerOverride) {
  const chosen = (providerOverride || env.musicProvider || "google_lyria").toLowerCase();
  if (chosen.includes("lyria") || chosen.includes("google_lyria")) return googleLyriaSynth;
  if (chosen.includes("elevenlabs") || chosen.includes("eleven")) return elevenLabsSynth;
  if (chosen.includes("suno")) return sunoSynth;
  if (chosen.includes("tts")) return googleTtsSynth;
  return googleLyriaSynth;
}
