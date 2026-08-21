import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";
import { queueService } from "../services/queue/index.js";
import { env } from "../config/env.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);

// Pure JS WAV audio buffer generator
function createSineWavBuffer(durationSeconds = 15, frequency = 440, sampleRate = 44100) {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.3;
    const val = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(val, 44 + i * 2);
  }

  return buffer;
}

// Pure JS 24-bit solid color BMP image generator
function createSolidBmpBuffer(width = 800, height = 600, colorHex = "0A2D59") {
  const r = parseInt(colorHex.slice(0, 2), 16);
  const g = parseInt(colorHex.slice(2, 4), 16);
  const b = parseInt(colorHex.slice(4, 6), 16);

  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = Buffer.alloc(fileSize);

  buffer.write("BM", 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);

  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(pixelArraySize, 34);

  for (let y = 0; y < height; y++) {
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + x * 3;
      buffer[pxOffset] = b;
      buffer[pxOffset + 1] = g;
      buffer[pxOffset + 2] = r;
    }
  }

  return buffer;
}

export async function processVideoRenderJob(jobId, projectId, mediaPaths = [], audioPath = null) {
  const dbJob = await GenerationJob.findById(jobId);
  if (!dbJob) return;

  try {
    dbJob.status = "processing";
    dbJob.progressPercent = 15;
    dbJob.currentStepMessage = "Initializing FFmpeg video rendering engine...";
    await dbJob.save();

    const outputFilename = `rendered_video_${Date.now()}.mp4`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const tempOutputPath = path.join(uploadDir, outputFilename);

    let effectiveMediaPaths = [...mediaPaths];

    // Fallback image if no media uploaded
    if (effectiveMediaPaths.length === 0) {
      const fallbackBmpPath = path.join(uploadDir, "fallback_cover.bmp");
      const bmpBuffer = createSolidBmpBuffer(800, 600, "0A2D59");
      await fs.writeFile(fallbackBmpPath, bmpBuffer);
      effectiveMediaPaths.push(fallbackBmpPath);
    }

    // Fallback audio if no song track generated
    let effectiveAudioPath = audioPath;
    if (!effectiveAudioPath) {
      const fallbackWavPath = path.join(uploadDir, "fallback_audio.wav");
      const wavBuffer = createSineWavBuffer(15, 440, 44100);
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
    }

    // Build FFmpeg slideshow rendering command
    let command = ffmpeg();

    effectiveMediaPaths.forEach((imgPath) => {
      command = command.input(imgPath).loop(4);
    });

    command = command.input(effectiveAudioPath);

    await new Promise((resolve, reject) => {
      command
        .outputOptions([
          "-c:v libx264",
          "-tune stillimage",
          "-c:a aac",
          "-b:a 192k",
          "-pix_fmt yuv420p",
          "-shortest"
        ])
        .save(tempOutputPath)
        .on("progress", async (p) => {
          dbJob.progressPercent = Math.min(95, Math.round(p.percent || 50));
          dbJob.currentStepMessage = "Stitching media frames and audio track...";
          await dbJob.save();
        })
        .on("end", resolve)
        .on("error", reject);
    });

    const publicUrl = `http://localhost:${env.port}/uploads/${outputFilename}`;
    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: 15,
      resolution: "1080p"
    });

    dbJob.status = "completed";
    dbJob.progressPercent = 100;
    dbJob.resultRef = videoDoc._id;
    dbJob.currentStepMessage = "Video rendering complete!";
    await dbJob.save();

    await Project.findByIdAndUpdate(projectId, {
      status: "completed",
      activeVideoId: videoDoc._id
    });

    return videoDoc;
  } catch (err) {
    dbJob.status = "failed";
    dbJob.errorMessage = err.message || "Video rendering failed";
    await dbJob.save();
    throw err;
  }
}

// Register Memory Queue Handler for Local Dev
if (env.queueProvider === "memory") {
  queueService.registerWorker(async (job) => {
    if (job.name === "video_rendering") {
      await processVideoRenderJob(job.data.jobId, job.data.projectId, job.data.mediaPaths, job.data.audioPath);
    }
  });
}
