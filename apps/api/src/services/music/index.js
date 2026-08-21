import path from "path";
import fs from "fs";
import https from "https";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import { env } from "../../config/env.js";

const fsPromises = fs.promises;
ffmpeg.setFfmpegPath(ffmpegInstaller);

// Pure Node.js Pleasant Musical Synth Generator
export function createMusicalMelodyWavBuffer(durationSeconds = 15, sampleRate = 44100) {
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

  // Chord progression frequencies (C maj, A min, F maj, G maj)
  const chords = [
    [261.63, 329.63, 392.00], // C major
    [220.00, 261.63, 329.63], // A minor
    [174.61, 220.00, 261.63], // F major
    [196.00, 246.94, 293.66]  // G major
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor((t / 3.75)) % chords.length;
    const currentChord = chords[chordIndex];

    let sample = 0;
    currentChord.forEach((freq) => {
      const note = Math.sin(2 * Math.PI * freq * t) * 0.15 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.05;
      sample += note;
    });

    const arpeggioFreq = currentChord[Math.floor((t * 4) % 3)];
    sample += Math.sin(2 * Math.PI * arpeggioFreq * t) * 0.08;

    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 16000)));
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

// Fetch Vocal Audio Stream for Lyrics
async function fetchVocalAudioForLyrics(lyricsText, tempVocalPath) {
  // Clean bracket headers e.g. [Verse 1], [Chorus]
  const cleanLyrics = (lyricsText || "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200); // Keep vocal snippet within length limit

  if (!cleanLyrics) return false;

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=${encodeURIComponent(cleanLyrics)}&tl=en`;
  const agent = new https.Agent({ rejectUnauthorized: false });

  return new Promise((resolve) => {
    const file = fs.createWriteStream(tempVocalPath);
    const req = https.get(url, { agent, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 200) {
        res.pipe(file);
        file.on("finish", () => {
          file.close(() => resolve(true));
        });
      } else {
        resolve(false);
      }
    });
    req.on("error", () => resolve(false));
  });
}

// Local Vocal & Music Song Adapter
class LocalSynthMusicAdapter {
  async generateMusic({ lyrics = "", genre = "Pop", durationSeconds = 15 }) {
    const timestamp = Date.now();
    const uploadDir = path.join(process.cwd(), "uploads");
    await fsPromises.mkdir(uploadDir, { recursive: true });

    const bgPath = path.join(uploadDir, `bg_${timestamp}.wav`);
    const vocalPath = path.join(uploadDir, `vocal_${timestamp}.mp3`);
    const outputFilename = `local_song_${timestamp}.mp3`;
    const outputPath = path.join(uploadDir, outputFilename);

    // 1. Generate background musical chord progression
    const wavBuffer = createMusicalMelodyWavBuffer(durationSeconds, 44100);
    await fsPromises.writeFile(bgPath, wavBuffer);

    // 2. Fetch vocal audio for lyrics
    const hasVocals = await fetchVocalAudioForLyrics(lyrics, vocalPath);

    // 3. Mix vocal audio track with background music using FFmpeg
    if (hasVocals) {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(bgPath)
          .input(vocalPath)
          .complexFilter([
            "[0:a]volume=0.35[bg]",
            "[1:a]volume=1.0[voc]",
            "[bg][voc]amix=inputs=2:duration=first[a]"
          ])
          .outputOptions(["-map", "[a]", "-c:a", "libmp3lame", "-b:a", "192k"])
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);
      });

      // Cleanup temporary stem files
      await fsPromises.unlink(bgPath).catch(() => {});
      await fsPromises.unlink(vocalPath).catch(() => {});
    } else {
      // Fallback if offline / vocal fetch failed
      await fsPromises.rename(bgPath, outputPath);
    }

    return {
      audioUrl: `http://localhost:${env.port}/uploads/${outputFilename}`,
      durationSeconds
    };
  }
}

// Suno/External Cloud API Music Adapter
class SunoMusicAdapter {
  async generateMusic({ lyrics, genre, durationSeconds = 30 }) {
    return {
      audioUrl: `https://mock-music-provider.com/suno_${Date.now()}.mp3`,
      durationSeconds
    };
  }
}

const localSynth = new LocalSynthMusicAdapter();
const sunoSynth = new SunoMusicAdapter();

export function getMusicProvider() {
  return env.musicProvider === "suno" ? sunoSynth : localSynth;
}
