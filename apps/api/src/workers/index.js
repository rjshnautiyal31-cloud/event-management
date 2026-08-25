import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";
import { Storyboard } from "../models/Storyboard.js";
import { Media } from "../models/Media.js";
import { Song } from "../models/Song.js";
import { queueService } from "../services/queue/index.js";
import { env } from "../config/env.js";
import { createMusicalMelodyWavBuffer } from "../services/music/index.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);

// Helper to convert seconds into SRT timecode format (00:00:05,000)
function formatSrtTime(secondsTotal) {
  const hrs = Math.floor(secondsTotal / 3600);
  const mins = Math.floor((secondsTotal % 3600) / 60);
  const secs = Math.floor(secondsTotal % 60);
  const millis = Math.floor((secondsTotal % 1) * 1000);

  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
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
    dbJob.currentStepMessage = "Fetching project song track, storyboard, and media timeline...";
    await dbJob.save();

    const timestamp = Date.now();
    const outputFilename = `rendered_video_${timestamp}.mp4`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const tempOutputPath = path.join(uploadDir, outputFilename);

    // Fetch Song Document for Exact Song Duration
    const projectDoc = await Project.findById(projectId).populate("activeSongId activeStoryboardId");
    let songDoc = projectDoc?.activeSongId;
    if (!songDoc) {
      songDoc = await Song.findOne({ projectId }).sort({ createdAt: -1 });
    }

    const targetSongDuration = songDoc?.durationSeconds || 30;

    // Fetch Storyboard and uploaded Media items
    let storyboardDoc = projectDoc?.activeStoryboardId;
    if (!storyboardDoc) {
      storyboardDoc = await Storyboard.findOne({ projectId }).sort({ createdAt: -1 });
    }
    if (storyboardDoc) {
      await storyboardDoc.populate("scenes.mediaId");
    }

    const mediaDocs = await Media.find({ projectId }).sort({ createdAt: 1 });

    let rawScenes = storyboardDoc?.scenes || [];
    if (rawScenes.length === 0) {
      const sceneCount = Math.max(4, mediaDocs.length);
      rawScenes = Array.from({ length: sceneCount }).map((_, i) => ({
        sceneNumber: i + 1,
        captionText: `Event Scene ${i + 1}`,
        mediaId: mediaDocs[i % mediaDocs.length] || null
      }));
    }

    // Distribute scene durations so that sum(scenes.duration) EXACTLY equals targetSongDuration
    const perSceneDuration = Number((targetSongDuration / rawScenes.length).toFixed(2));

    const scenesToRender = rawScenes.map((scene, idx) => {
      let imgPath = null;
      let mediaDoc = scene.mediaId;

      if (!mediaDoc || !mediaDoc.fileUrl) {
        mediaDoc = mediaDocs[idx % mediaDocs.length];
      }

      if (mediaDoc?.fileUrl?.includes("/uploads/")) {
        imgPath = path.join(uploadDir, path.basename(mediaDoc.fileUrl));
      }

      // Last scene absorbs remaining rounding difference
      const duration = (idx === rawScenes.length - 1)
        ? Number((targetSongDuration - (perSceneDuration * (rawScenes.length - 1))).toFixed(2))
        : perSceneDuration;

      return {
        sceneNumber: scene.sceneNumber || idx + 1,
        duration: Math.max(1, duration),
        captionText: scene.captionText || `Scene ${idx + 1}`,
        imgPath
      };
    });

    // Ensure fallback cover image if no media images exist
    const fallbackBmpPath = path.join(uploadDir, "fallback_cover.bmp");
    let hasFallbackCreated = false;

    for (const scene of scenesToRender) {
      if (!scene.imgPath) {
        if (!hasFallbackCreated) {
          const bmpBuffer = createSolidBmpBuffer(800, 600, "0A2D59");
          await fs.writeFile(fallbackBmpPath, bmpBuffer);
          hasFallbackCreated = true;
        }
        scene.imgPath = fallbackBmpPath;
      }
    }

    // Determine audio track path
    let effectiveAudioPath = audioPath;
    if (!effectiveAudioPath && songDoc?.audioUrl?.includes("/uploads/")) {
      effectiveAudioPath = path.join(uploadDir, path.basename(songDoc.audioUrl));
    }
    if (!effectiveAudioPath) {
      const fallbackWavPath = path.join(uploadDir, "fallback_audio.wav");
      const wavBuffer = createMusicalMelodyWavBuffer(targetSongDuration, 44100, songDoc?.genre || "Pop");
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
    }

    console.log("[Video Worker] Target song duration:", targetSongDuration);
    console.log("[Video Worker] scenesToRender:", JSON.stringify(scenesToRender, null, 2));

    // Render standardized 1280x720 scene MP4 segments for images & video clips
    const segmentPaths = [];
    for (let index = 0; index < scenesToRender.length; index++) {
      const scene = scenesToRender[index];
      const segPath = path.join(uploadDir, `seg_${timestamp}_${index}.mp4`);
      const srcPath = scene.imgPath;
      const isVideo = [".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(path.extname(srcPath || "").toLowerCase());

      console.log(`[Video Worker] Rendering segment ${index}: isVideo=${isVideo}, srcPath=${srcPath}, duration=${scene.duration}`);

      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        if (isVideo) {
          cmd.input(srcPath).inputOptions(["-ss", "0", "-t", String(scene.duration)]);
        } else {
          cmd.input(srcPath).inputOptions(["-loop", "1", "-t", String(scene.duration)]);
        }

        cmd.outputOptions([
          "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
          "-r", "25",
          "-an",
          "-c:v", "libx264",
          "-preset", "ultrafast"
        ])
        .save(segPath)
        .on("end", resolve)
        .on("error", (err) => {
          console.error(`Segment ${index} render error:`, err.message);
          reject(err);
        });
      });

      segmentPaths.push(segPath);
    }

    // Build FFmpeg Concat List File
    const concatListPath = path.join(uploadDir, `concat_${timestamp}.txt`);
    let concatContent = "";
    segmentPaths.forEach((seg) => {
      const safePath = seg.replace(/'/g, "'\\''");
      concatContent += `file '${safePath}'\n`;
    });

    await fs.writeFile(concatListPath, concatContent);

    dbJob.progressPercent = 50;
    dbJob.currentStepMessage = "Stitching image & video clip scene segments with song audio...";
    await dbJob.save();

    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .input(effectiveAudioPath);

    await new Promise((resolve, reject) => {
      command
        .outputOptions([
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-c:a", "aac",
          "-b:a", "192k",
          "-t", String(targetSongDuration)
        ])
        .save(tempOutputPath)
        .on("progress", async (p) => {
          dbJob.progressPercent = Math.min(95, Math.max(50, Math.round(p.percent || 60)));
          dbJob.currentStepMessage = "Encoding high-definition H.264 video stream...";
          await dbJob.save();
        })
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("FFmpeg error output:", stderr);
          reject(err);
        });
    });

    // Cleanup temporary segment manifest file
    await fs.unlink(concatListPath).catch(() => {});

    const publicUrl = `http://localhost:${env.port}/uploads/${outputFilename}`;

    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: targetSongDuration,
      resolution: "720p"
    });

    dbJob.status = "completed";
    dbJob.progressPercent = 100;
    dbJob.resultRef = videoDoc._id;
    dbJob.currentStepMessage = "Event Music Video rendering complete!";
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
