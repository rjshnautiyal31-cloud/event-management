import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";
import { queueService } from "../services/queue/index.js";
import { env } from "../config/env.js";
import { createMusicalMelodyWavBuffer } from "../services/music/index.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);

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
    dbJob.currentStepMessage = "Initializing FFmpeg slideshow engine...";
    await dbJob.save();

    const timestamp = Date.now();
    const outputFilename = `rendered_video_${timestamp}.mp4`;
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
      const wavBuffer = createMusicalMelodyWavBuffer(16, 44100);
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
    }

    // Build FFmpeg Concat List File for seamless multi-image slideshow
    const concatListPath = path.join(uploadDir, `concat_${timestamp}.txt`);
    const durationPerImage = 4; // 4 seconds per image frame

    let concatContent = "";
    effectiveMediaPaths.forEach((imgPath) => {
      const safePath = imgPath.replace(/'/g, "'\\''");
      concatContent += `file '${safePath}'\nduration ${durationPerImage}\n`;
    });
    // Repeat last image entry without duration per FFmpeg concat demuxer spec
    const lastPath = effectiveMediaPaths[effectiveMediaPaths.length - 1].replace(/'/g, "'\\''");
    concatContent += `file '${lastPath}'\n`;

    await fs.writeFile(concatListPath, concatContent);

    // Build FFmpeg Slideshow Video & Audio Muxing Command
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .input(effectiveAudioPath);

    await new Promise((resolve, reject) => {
      command
        .outputOptions([
          "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
          "-r", "25",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-c:a", "aac",
          "-b:a", "192k",
          "-shortest"
        ])
        .save(tempOutputPath)
        .on("progress", async (p) => {
          dbJob.progressPercent = Math.min(95, Math.round(p.percent || 50));
          dbJob.currentStepMessage = "Rendering slideshow frames and audio track...";
          await dbJob.save();
        })
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("FFmpeg error output:", stderr);
          reject(err);
        });
    });

    // Clean up temporary concat manifest file
    await fs.unlink(concatListPath).catch(() => {});

    const publicUrl = `http://localhost:${env.port}/uploads/${outputFilename}`;
    const totalDurationSeconds = effectiveMediaPaths.length * durationPerImage;

    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: totalDurationSeconds,
      resolution: "720p"
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
