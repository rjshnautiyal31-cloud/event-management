import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);

// Local Synthetic Audio Generator (Zero-Cost Local Dev)
class LocalSynthMusicAdapter {
  async generateMusic({ genre = "Pop", durationSeconds = 15 }) {
    const filename = `local_synth_${Date.now()}.mp3`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, filename);

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input("eval=sine:f=220:be=2") // Synthetic audio tone generator
        .inputFormat("lavfi")
        .duration(durationSeconds)
        .audioCodec("libmp3lame")
        .save(outputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    return {
      audioUrl: `http://localhost:${env.port}/uploads/${filename}`,
      durationSeconds
    };
  }
}

// Suno/External API Music Adapter (Cloud Production)
class SunoMusicAdapter {
  async generateMusic({ lyrics, genre, durationSeconds = 30 }) {
    // In production, invoke Suno or ElevenLabs webhook / polling API
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
