import path from "path";
import fs from "fs";
import https from "https";
import { execFile } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import textToSpeech from "@google-cloud/text-to-speech";
import { env, getGoogleCloudCredentials } from "../../config/env.js";
import { uploadAssetBuffer, buildStoryStorageKey } from "../storage/index.js";
import { getLanguageConfig, getLanguageGcpVoice } from "../../config/languages.js";
import { createMusicalMelodyWavBuffer, getMusicProvider } from "./index.js";

const fsPromises = fs.promises;
const activeFfmpegPath =
  process.env.FFMPEG_PATH ||
  (fs.existsSync("/usr/bin/ffmpeg")
    ? "/usr/bin/ffmpeg"
    : fs.existsSync("/usr/local/bin/ffmpeg")
      ? "/usr/local/bin/ffmpeg"
      : ffmpegInstaller);
ffmpeg.setFfmpegPath(activeFfmpegPath);

export function getPreciseAudioDuration(filePath) {
  return new Promise((resolve) => {
    execFile(activeFfmpegPath, ["-i", filePath], (err, stdout, stderr) => {
      const match = (stderr || "").match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const mins = parseFloat(match[2]);
        const secs = parseFloat(match[3]);
        resolve(Number((hours * 3600 + mins * 60 + secs).toFixed(2)));
      } else {
        resolve(0);
      }
    });
  });
}

// Pure JS 16-bit Stereo Silent WAV Buffer Generator (44.1kHz, 2ch)
export function createSilentStereoWavBuffer(durationSeconds = 1, sampleRate = 44100) {
  const safeDuration = Math.max(0.05, Number(durationSeconds) || 0.25);
  const numFrames = Math.floor(sampleRate * safeDuration);
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

// Normalize any audio file to 44.1kHz Stereo 16-bit PCM WAV for glitch-free FFmpeg concatenation
function convertToNormalizedStereoWav(inputPath, outputWavPath, options = {}) {
  const { volume = 1.0, maxDuration = null, fadeIn = 0, fadeOut = 0 } = options;
  return new Promise((resolve, reject) => {
    const filters = [];
    if (volume !== 1.0) {
      filters.push(`volume=${volume}`);
    }
    if (fadeIn > 0) {
      filters.push(`afade=t=in:st=0:d=${fadeIn}`);
    }
    if (fadeOut > 0 && maxDuration && maxDuration > fadeOut) {
      filters.push(`afade=t=out:st=${Math.max(0.1, maxDuration - fadeOut)}:d=${fadeOut}`);
    }

    const args = ["-y", "-i", inputPath];
    if (maxDuration && maxDuration > 0) {
      args.push("-t", String(maxDuration));
    }
    if (filters.length > 0) {
      args.push("-af", filters.join(","));
    }
    args.push("-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", outputWavPath);

    execFile(activeFfmpegPath, args, (err) => {
      if (err) return reject(err);
      resolve(outputWavPath);
    });
  });
}

async function localizeAudioUrl(audioUrl, tempDir, prefix, cleanupList) {
  if (!audioUrl) return null;
  if (!audioUrl.startsWith("http://") && !audioUrl.startsWith("https://")) {
    return fs.existsSync(audioUrl) ? audioUrl : null;
  }
  if (audioUrl.includes("/uploads/")) {
    const rel = audioUrl.split("/uploads/")[1];
    if (rel) {
      const candidate = path.join(process.cwd(), "uploads", rel);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  try {
    const res = await fetch(audioUrl);
    if (!res.ok) return null;
    const ext = path.extname(new URL(audioUrl).pathname) || ".mp3";
    const dest = path.join(tempDir, `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fsPromises.writeFile(dest, buf);
    cleanupList.push(dest);
    return dest;
  } catch {
    return null;
  }
}

// Synthesize a single spoken dialogue / narration line with role-distinct voice
async function synthesizeSpeechLine({
  text,
  outputMp3Path,
  language = "en",
  voiceGender = "female",
  voiceRole = "speaker_a",
  provider = "google_tts",
  customVoiceId = ""
}) {
  const cleanText = String(text || "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanText) return false;
  const langConfig = getLanguageConfig(language);

  // 1. Optional ElevenLabs Speech TTS when elevenlabs provider is active & API key exists
  const elevenApiKey = env.elevenLabsApiKey || env.musicApiKey;
  if (provider === "elevenlabs" && elevenApiKey) {
    try {
      const isMale = String(voiceGender).toLowerCase() === "male";
      let voiceId = customVoiceId;
      if (!voiceId) {
        if (voiceRole === "narrator") {
          voiceId = isMale
            ? langConfig.elevenLabsVoices?.narrator
            : langConfig.elevenLabsVoices?.narrator_female;
        } else {
          voiceId = isMale
            ? langConfig.elevenLabsVoices?.male
            : langConfig.elevenLabsVoices?.female;
        }
      }
      voiceId = voiceId || (isMale ? "pNInz6obpgDQGcFmaJgB" : "21m00Tcm4TlvDq8ikWAM");

      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenApiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg"
        },
        body: JSON.stringify({
          text: cleanText,
          model_id:
            langConfig.code === "en"
              ? env.elevenLabsTtsEnglishModel || "eleven_monolingual_v1"
              : env.elevenLabsTtsMultilingualModel || "eleven_multilingual_v2",
          voice_settings: { stability: 0.55, similarity_boost: 0.78 }
        })
      });

      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        await fsPromises.writeFile(outputMp3Path, buf);
        return true;
      }
    } catch (err) {
      console.warn("[AdAudioComposer] ElevenLabs speech line failed, falling back to Google Neural2:", err.message);
    }
  }

  // 2. Google Cloud Neural2 TTS with distinct role voices & natural conversational prosody
  try {
    const authInfo = getGoogleCloudCredentials();
    const clientOptions = {};
    if (authInfo.credentials) {
      clientOptions.credentials = authInfo.credentials;
      if (authInfo.projectId) clientOptions.projectId = authInfo.projectId;
    } else if (env.geminiApiKey) {
      clientOptions.apiKey = env.geminiApiKey;
    }

    const ttsClient = new textToSpeech.TextToSpeechClient(clientOptions);
    try {
      const voiceConfig = getLanguageGcpVoice(language, voiceGender, voiceRole);

      // Subtle prosody differentiation so Speaker A, Speaker B, and Narrator feel crisp & distinct
      const speakingRate = voiceRole === "narrator" ? 1.03 : 1.0;
      const pitch =
        voiceRole === "narrator"
          ? -0.8
          : String(voiceGender).toLowerCase() === "male"
            ? -0.4
            : 0.6;

      const [response] = await ttsClient.synthesizeSpeech(
        {
          input: { text: cleanText },
          voice: voiceConfig,
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
            pitch
          }
        },
        { timeout: 12000, maxRetries: 1 }
      );

      if (response.audioContent) {
        await fsPromises.writeFile(outputMp3Path, response.audioContent, "binary");
        return true;
      }
    } finally {
      ttsClient.close().catch(() => {});
    }
  } catch (err) {
    console.warn("[AdAudioComposer] Google Neural2 TTS failed, trying fallback TTS:", err.message);
  }

  // 3. Multi-chunk Translate TTS fallback
  try {
    const sentences = cleanText.match(/.{1,140}(\s+|$)/g) || [cleanText];
    const chunks = [];
    const agent = new https.Agent({ rejectUnauthorized: false });
    const ttsLang = langConfig.ttsLangCode || (langConfig.code === "hinglish" ? "hi" : langConfig.code) || "en";

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(sentence)}&tl=${encodeURIComponent(ttsLang)}`;
      const buf = await new Promise((resolve) => {
        const parts = [];
        const req = https.get(
          url,
          { agent, timeout: 8000, headers: { "User-Agent": "Mozilla/5.0" } },
          (res) => {
            if (res.statusCode === 200) {
              res.on("data", (c) => parts.push(c));
              res.on("end", () => resolve(Buffer.concat(parts)));
            } else {
              resolve(null);
            }
          }
        );
        req.on("timeout", () => {
          req.destroy();
          resolve(null);
        });
        req.on("error", () => resolve(null));
      });
      if (buf && buf.length > 0) chunks.push(buf);
    }

    if (chunks.length > 0) {
      const rawFallbackPath = `${outputMp3Path}.raw.mp3`;
      await fsPromises.writeFile(rawFallbackPath, Buffer.concat(chunks));

      // Apply slight pitch shift when Male / Narrator is requested so two speakers still sound distinct in fallback mode!
      const isMale = String(voiceGender).toLowerCase() === "male";
      if (isMale || voiceRole === "narrator") {
        const pitchFactor = voiceRole === "narrator" ? 0.88 : 0.91;
        const tempoCompensation = Number((1 / pitchFactor).toFixed(3));
        await new Promise((resolve) => {
          execFile(
            activeFfmpegPath,
            [
              "-y",
              "-i", rawFallbackPath,
              "-af", `asetrate=24000*${pitchFactor},aresample=44100,atempo=${tempoCompensation}`,
              "-c:a", "libmp3lame",
              "-b:a", "192k",
              outputMp3Path
            ],
            (err) => {
              if (err) {
                fsPromises.copyFile(rawFallbackPath, outputMp3Path).finally(resolve);
              } else {
                resolve();
              }
            }
          );
        });
        await fsPromises.unlink(rawFallbackPath).catch(() => {});
      } else {
        await fsPromises.rename(rawFallbackPath, outputMp3Path);
      }
      return true;
    }
  } catch (err) {
    console.warn("[AdAudioComposer] Fallback TTS error:", err.message);
  }

  return false;
}

// Generate an instrumental background bed WAV (44.1kHz stereo) without vocals
async function buildInstrumentalBedWav({
  durationSeconds = 30,
  bgmStyle = "Upbeat Commercial",
  provider = "google_lyria",
  outputWavPath,
  tempDir,
  cleanupList
}) {
  const safeDuration = Math.max(3, Math.ceil(Number(durationSeconds) || 30));
  const elevenApiKey = env.elevenLabsApiKey || env.musicApiKey;

  if (provider === "elevenlabs" && elevenApiKey) {
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/music", {
        method: "POST",
        headers: {
          "xi-api-key": elevenApiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: `Clean instrumental commercial background music, ${bgmStyle} style, no vocals, upbeat advertising underscore`,
          music_length_ms: Math.min(180000, safeDuration * 1000),
          model_id: env.elevenLabsMusicModel || "music_v1",
          force_instrumental: true,
          output_format: "mp3_44100_128"
        })
      });
      if (res.ok) {
        const tmpMp3 = path.join(tempDir, `bgm_eleven_${Date.now()}.mp3`);
        await fsPromises.writeFile(tmpMp3, Buffer.from(await res.arrayBuffer()));
        cleanupList.push(tmpMp3);
        await convertToNormalizedStereoWav(tmpMp3, outputWavPath, {
          maxDuration: safeDuration,
          fadeIn: 0.4,
          fadeOut: 1.2
        });
        return outputWavPath;
      }
    } catch (err) {
      console.warn("[AdAudioComposer] ElevenLabs instrumental bed failed, using synth underscore:", err.message);
    }
  }

  // Reliable procedural chord/arpeggio underscore converted to normalized stereo WAV
  const monoWavPath = path.join(tempDir, `bgm_synth_${Date.now()}.wav`);
  const wavBuf = createMusicalMelodyWavBuffer(safeDuration, 44100, bgmStyle || "Pop");
  await fsPromises.writeFile(monoWavPath, wavBuf);
  cleanupList.push(monoWavPath);

  await convertToNormalizedStereoWav(monoWavPath, outputWavPath, {
    maxDuration: safeDuration,
    fadeIn: 0.4,
    fadeOut: 1.2
  });
  return outputWavPath;
}

/**
 * Master Multi-Speaker Dialogue, Background Underscore, and Sung AI Jingles into a Single Commercial Audio Track
 */
export async function composeAdvertisementAudio({
  project,
  projectId: explicitProjectId,
  scriptSegments = [],
  audioMode = "hybrid_conversation_song",
  bgmStyle = "Upbeat Commercial",
  musicProvider = "google_lyria",
  language = "en",
  targetDurationSeconds = 30,
  includeVisualBgm = true
}) {
  const timestamp = Date.now();
  const uploadDir = path.join(process.cwd(), "uploads");
  await fsPromises.mkdir(uploadDir, { recursive: true });

  const cleanupList = [];
  const projectId = project?._id || explicitProjectId || "ad_promo";
  const title = project?.title || "ad_promo";
  const desiredTotalSec = Math.max(5, Number(targetDurationSeconds) || 30);

  try {
    // CASE 1: Visual-Only Ad (Zero Voiceover — Optional Instrumental Bed or Clean Silent Track)
    if (audioMode === "visual_only") {
      const masterWav = path.join(uploadDir, `ad_visual_${timestamp}.wav`);
      cleanupList.push(masterWav);

      if (includeVisualBgm) {
        await buildInstrumentalBedWav({
          durationSeconds: desiredTotalSec,
          bgmStyle,
          provider: musicProvider,
          outputWavPath: masterWav,
          tempDir: uploadDir,
          cleanupList
        });
      } else {
        await fsPromises.writeFile(masterWav, createSilentStereoWavBuffer(desiredTotalSec));
      }

      const outFilename = `ad_master_${timestamp}.mp3`;
      const outPath = path.join(uploadDir, outFilename);
      cleanupList.push(outPath);

      await new Promise((resolve, reject) => {
        execFile(
          activeFfmpegPath,
          ["-y", "-i", masterWav, "-c:a", "libmp3lame", "-b:a", "192k", outPath],
          (err) => (err ? reject(err) : resolve())
        );
      });

      const buf = await fsPromises.readFile(outPath);
      const storageKey = buildStoryStorageKey({ projectId, title, category: "audio", filename: outFilename });
      const audioUrl = await uploadAssetBuffer(buf, storageKey, "audio/mpeg");

      const segCount = Math.max(1, scriptSegments.length);
      const perBeat = Number((desiredTotalSec / segCount).toFixed(2));
      const updatedSegments = scriptSegments.map((seg, idx) => ({
        ...(seg.toObject ? seg.toObject() : seg),
        segmentOrder: idx + 1,
        startTimeSeconds: Number((idx * perBeat).toFixed(2)),
        endTimeSeconds: idx === segCount - 1 ? desiredTotalSec : Number(((idx + 1) * perBeat).toFixed(2))
      }));

      return {
        audioUrl,
        durationSeconds: desiredTotalSec,
        provider: includeVisualBgm ? `${musicProvider}_instrumental` : "silent_visual",
        scriptSegments: updatedSegments,
        isFallback: false
      };
    }

    // CASE 2: Spoken Dialogue Only, Dialogue + BGM, or Hybrid Conversation + Sung Jingle
    const normalizedPieces = [];
    const updatedSegments = [];
    let timelineCursor = 0;
    let usedFallbackJingle = false;
    let fallbackReason = "";

    // Small 0.25s breath gap between consecutive segments
    const gapDuration = 0.25;
    const gapWavPath = path.join(uploadDir, `ad_gap_${timestamp}.wav`);
    await fsPromises.writeFile(gapWavPath, createSilentStereoWavBuffer(gapDuration));
    cleanupList.push(gapWavPath);

    for (let i = 0; i < scriptSegments.length; i++) {
      const rawSeg = scriptSegments[i].toObject ? scriptSegments[i].toObject() : { ...scriptSegments[i] };
      const segType = rawSeg.segmentType || "dialogue";
      const segTargetDur = Math.max(2, Number(rawSeg.targetDurationSeconds) || 4);
      const segWavPath = path.join(uploadDir, `ad_seg_${timestamp}_${i}.wav`);
      cleanupList.push(segWavPath);

      let actualSegDuration = segTargetDur;

      if (segType === "sung_jingle" && audioMode === "hybrid_conversation_song") {
        // Synthesize Sung AI Jingle Hook via selected Music Provider (Lyria 3 Pro / ElevenLabs / Synth)
        const musicEngine = getMusicProvider(musicProvider);
        const jingleVoice = rawSeg.voiceGender === "male" ? "male" : "female";
        const jingleRes = await musicEngine.generateMusic({
          lyrics: rawSeg.text || project.adBrief?.brandName || project.title,
          genre: bgmStyle || "Upbeat Commercial Pop",
          durationSeconds: Math.max(6, Math.min(25, segTargetDur)),
          mood: "Catchy Commercial Jingle",
          storyContext: `Short catchy commercial jingle hook for ${project.adBrief?.brandName || project.title}`,
          directorGuidelines: "Punchy, memorable advertising jingle chorus",
          title: `${title}_jingle_${i + 1}`,
          projectId,
          language,
          voiceType: jingleVoice
        });

        if (jingleRes?.isFallback) {
          usedFallbackJingle = true;
          fallbackReason = jingleRes.fallbackReason || "";
        }

        const localJinglePath = await localizeAudioUrl(jingleRes?.audioUrl, uploadDir, `jingle_${i}`, cleanupList);
        if (localJinglePath) {
          await convertToNormalizedStereoWav(localJinglePath, segWavPath, {
            volume: 1.05,
            maxDuration: Math.max(5, segTargetDur + 1.5),
            fadeIn: 0.25,
            fadeOut: 0.45
          });
          actualSegDuration = (await getPreciseAudioDuration(segWavPath)) || segTargetDur;
          rawSeg.segmentAudioUrl = jingleRes.audioUrl || "";
        } else {
          await buildInstrumentalBedWav({
            durationSeconds: segTargetDur,
            bgmStyle,
            provider: musicProvider,
            outputWavPath: segWavPath,
            tempDir: uploadDir,
            cleanupList
          });
          actualSegDuration = (await getPreciseAudioDuration(segWavPath)) || segTargetDur;
        }
      } else if (segType === "visual_beat" || !String(rawSeg.text || "").trim()) {
        // Silent visual pause beat
        await fsPromises.writeFile(segWavPath, createSilentStereoWavBuffer(segTargetDur));
        actualSegDuration = segTargetDur;
      } else {
        // Spoken Dialogue or Narrator CTA
        const rawSpeechMp3 = path.join(uploadDir, `ad_speech_${timestamp}_${i}.mp3`);
        cleanupList.push(rawSpeechMp3);

        const ok = await synthesizeSpeechLine({
          text: rawSeg.text,
          outputMp3Path: rawSpeechMp3,
          language,
          voiceGender: rawSeg.voiceGender || "female",
          voiceRole: rawSeg.voiceRole || (segType === "narration" ? "narrator" : i % 2 === 0 ? "speaker_a" : "speaker_b"),
          provider: musicProvider,
          customVoiceId: project.customVoiceId || ""
        });

        if (ok && fs.existsSync(rawSpeechMp3)) {
          const rawVoiceWav = path.join(uploadDir, `ad_voice_norm_${timestamp}_${i}.wav`);
          cleanupList.push(rawVoiceWav);
          await convertToNormalizedStereoWav(rawSpeechMp3, rawVoiceWav, { volume: 1.65 });
          actualSegDuration = Math.max(1.2, await getPreciseAudioDuration(rawVoiceWav));

          // In hybrid_conversation_song, if this spoken segment specifies "ducked" BGM, mix subtle underscore beneath speech
          if (audioMode === "hybrid_conversation_song" && rawSeg.bgmBehavior === "ducked") {
            const subBedWav = path.join(uploadDir, `ad_subbed_${timestamp}_${i}.wav`);
            cleanupList.push(subBedWav);
            await buildInstrumentalBedWav({
              durationSeconds: Math.ceil(actualSegDuration + 0.3),
              bgmStyle,
              provider: "local_synth",
              outputWavPath: subBedWav,
              tempDir: uploadDir,
              cleanupList
            });

            await new Promise((resolve, reject) => {
              ffmpeg()
                .input(rawVoiceWav)
                .input(subBedWav)
                .complexFilter([
                  "[0:a]volume=1.35[voc]",
                  "[1:a]volume=0.14[bg]",
                  "[voc][bg]amix=inputs=2:duration=first:dropout_transition=0.3[out]"
                ])
                .outputOptions(["-map", "[out]", "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le"])
                .save(segWavPath)
                .on("end", resolve)
                .on("error", reject);
            });
          } else {
            await fsPromises.copyFile(rawVoiceWav, segWavPath);
          }
        } else {
          await fsPromises.writeFile(segWavPath, createSilentStereoWavBuffer(segTargetDur));
          actualSegDuration = segTargetDur;
        }
      }

      const startSec = Number(timelineCursor.toFixed(2));
      const endSec = Number((timelineCursor + actualSegDuration).toFixed(2));
      timelineCursor = endSec;

      normalizedPieces.push(segWavPath);
      if (i < scriptSegments.length - 1) {
        normalizedPieces.push(gapWavPath);
        timelineCursor = Number((timelineCursor + gapDuration).toFixed(2));
      }

      updatedSegments.push({
        ...rawSeg,
        segmentOrder: i + 1,
        startTimeSeconds: startSec,
        endTimeSeconds: endSec
      });
    }

    // Concatenate all standardized WAV segments into one timeline WAV
    const concatTxtPath = path.join(uploadDir, `ad_concat_${timestamp}.txt`);
    cleanupList.push(concatTxtPath);
    const concatBody = normalizedPieces
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join("\n");
    await fsPromises.writeFile(concatTxtPath, concatBody);

    const stitchedVoiceTimelineWav = path.join(uploadDir, `ad_stitched_${timestamp}.wav`);
    cleanupList.push(stitchedVoiceTimelineWav);

    await new Promise((resolve, reject) => {
      execFile(
        activeFfmpegPath,
        [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", concatTxtPath,
          "-ar", "44100",
          "-ac", "2",
          "-c:a", "pcm_s16le",
          stitchedVoiceTimelineWav
        ],
        (err) => (err ? reject(err) : resolve())
      );
    });

    const stitchedDuration = Math.max(2, await getPreciseAudioDuration(stitchedVoiceTimelineWav));
    const finalMp3Filename = `ad_master_${audioMode}_${timestamp}.mp3`;
    const finalMp3Path = path.join(uploadDir, finalMp3Filename);
    cleanupList.push(finalMp3Path);

    if (audioMode === "dialogue_bgm") {
      // Mix full foreground conversation over continuous ducked instrumental underscore + 0.6s tail
      const totalWithTail = Math.ceil(stitchedDuration + 0.6);
      const bedWavPath = path.join(uploadDir, `ad_fullbed_${timestamp}.wav`);
      cleanupList.push(bedWavPath);

      await buildInstrumentalBedWav({
        durationSeconds: totalWithTail,
        bgmStyle,
        provider: musicProvider,
        outputWavPath: bedWavPath,
        tempDir: uploadDir,
        cleanupList
      });

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(bedWavPath)
          .input(stitchedVoiceTimelineWav)
          .complexFilter([
            "[0:a]volume=0.16[bg]",
            "[1:a]volume=1.55[dlg]",
            "[bg][dlg]amix=inputs=2:duration=first:dropout_transition=0.8[master]"
          ])
          .outputOptions(["-map", "[master]", "-c:a", "libmp3lame", "-b:a", "192k"])
          .save(finalMp3Path)
          .on("end", resolve)
          .on("error", reject);
      });
    } else {
      // dialogue_only (zero music!) OR hybrid_conversation_song (already stitched with jingle + speech)
      await new Promise((resolve, reject) => {
        execFile(
          activeFfmpegPath,
          ["-y", "-i", stitchedVoiceTimelineWav, "-c:a", "libmp3lame", "-b:a", "192k", finalMp3Path],
          (err) => (err ? reject(err) : resolve())
        );
      });
    }

    const finalDuration = Math.max(1, Math.round(await getPreciseAudioDuration(finalMp3Path)) || Math.round(stitchedDuration));
    if (updatedSegments.length > 0) {
      updatedSegments[updatedSegments.length - 1].endTimeSeconds = Math.max(
        updatedSegments[updatedSegments.length - 1].endTimeSeconds,
        finalDuration
      );
    }

    const audioBuffer = await fsPromises.readFile(finalMp3Path);
    const storageKey = buildStoryStorageKey({
      projectId,
      title,
      category: "audio",
      filename: finalMp3Filename
    });
    const audioUrl = await uploadAssetBuffer(audioBuffer, storageKey, "audio/mpeg");

    return {
      audioUrl,
      durationSeconds: finalDuration,
      provider:
        audioMode === "dialogue_only"
          ? "multi_voice_dialogue"
          : audioMode === "dialogue_bgm"
            ? `${musicProvider}_dialogue_bgm`
            : `${musicProvider}_hybrid_ad`,
      scriptSegments: updatedSegments,
      isFallback: usedFallbackJingle,
      fallbackReason
    };
  } finally {
    await Promise.all(cleanupList.map((f) => fsPromises.unlink(f).catch(() => {})));
  }
}
