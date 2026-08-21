import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

// Pure Node.js 16-bit PCM WAV Audio Generator (Zero-Cost Local Dev, No lavfi/ffmpeg required)
function createSineWavBuffer(durationSeconds = 15, frequency = 440, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk Descriptor
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt Subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // data Subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM Sine Wave Samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3; // 30% volume
    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

// Local Synthetic Audio Generator (Zero-Cost Local Dev)
class LocalSynthMusicAdapter {
  async generateMusic({ genre = "Pop", durationSeconds = 15 }) {
    const filename = `local_synth_${Date.now()}.wav`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, filename);

    // Generate pure WAV audio buffer
    const wavBuffer = createSineWavBuffer(durationSeconds, 440, 44100);
    await fs.writeFile(outputPath, wavBuffer);

    return {
      audioUrl: `http://localhost:${env.port}/uploads/${filename}`,
      durationSeconds
    };
  }
}

// Suno/External API Music Adapter (Cloud Production)
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
