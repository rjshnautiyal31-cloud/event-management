import path from "path";
import fs from "fs/promises";
import { env } from "../../config/env.js";

// Pure Node.js Pleasant Musical Synth Generator (Zero-Cost Local Dev, No lavfi/external dependencies)
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
      // Main fundamental note + soft 2nd harmonic
      const note = Math.sin(2 * Math.PI * freq * t) * 0.15 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.05;
      sample += note;
    });

    // Add gentle rhythmic arpeggio pulse
    const arpeggioFreq = currentChord[Math.floor((t * 4) % 3)];
    sample += Math.sin(2 * Math.PI * arpeggioFreq * t) * 0.08;

    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 16000)));
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

// Local Synthetic Music Adapter (Zero-Cost Local Dev)
class LocalSynthMusicAdapter {
  async generateMusic({ genre = "Pop", durationSeconds = 15 }) {
    const filename = `local_synth_${Date.now()}.wav`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const outputPath = path.join(uploadDir, filename);

    // Generate harmonic musical melody audio buffer
    const wavBuffer = createMusicalMelodyWavBuffer(durationSeconds, 44100);
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
