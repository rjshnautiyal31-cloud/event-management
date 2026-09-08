import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";
import { Storyboard } from "../models/Storyboard.js";
import { Media } from "../models/Media.js";
import { Song } from "../models/Song.js";
import { queueService } from "../services/queue/index.js";
import { env } from "../config/env.js";
import { createMusicalMelodyWavBuffer } from "../services/music/index.js";
import { uploadAssetBuffer } from "../services/storage/index.js";

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

// Download remote media (Cloudflare R2, Google Cloud Storage, AWS S3) or locate local file
async function ensureLocalFile(fileUrlOrPath, tempDir, prefix = "asset", cleanupList = []) {
  if (!fileUrlOrPath) return null;

  // Already a local path
  if (!fileUrlOrPath.startsWith("http://") && !fileUrlOrPath.startsWith("https://")) {
    return fileUrlOrPath;
  }

  // If it references /uploads/ on local server
  if (fileUrlOrPath.includes("/uploads/")) {
    const filename = path.basename(fileUrlOrPath);
    const localPath = path.join(process.cwd(), "uploads", filename);
    if (fsSync.existsSync(localPath)) {
      return localPath;
    }
  }

  // Cloud URL (R2, GCS, S3, or external) -> download to local scratch path
  try {
    const res = await fetch(fileUrlOrPath);
    if (!res.ok) {
      console.warn(`[Video Worker] Could not fetch remote media at ${fileUrlOrPath}: ${res.statusText}`);
      return null;
    }
    const urlObj = new URL(fileUrlOrPath);
    const ext = path.extname(urlObj.pathname) || ".mp4";
    const tempFile = path.join(tempDir, `tmp_${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(tempFile, buffer);
    cleanupList.push(tempFile);
    return tempFile;
  } catch (err) {
    console.error(`[Video Worker] Error fetching remote media (${fileUrlOrPath}):`, err.message);
    return null;
  }
}

export const VIDEO_PRESETS = {
  "1080p": {
    id: "1080p",
    name: "Desktop Full HD (1080p)",
    shortLabel: "1080p Full HD",
    device: "desktop",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    bitrate: "6000k",
    description: "Crisp 1080p Full HD for monitors, projectors & presentations"
  },
  "720p": {
    id: "720p",
    name: "Desktop HD (720p)",
    shortLabel: "720p HD",
    device: "desktop",
    width: 1280,
    height: 720,
    aspectRatio: "16:9",
    bitrate: "3500k",
    description: "Fast-rendering standard 720p HD"
  },
  "mobile": {
    id: "mobile",
    name: "Mobile Portrait (9:16)",
    shortLabel: "Mobile (9:16)",
    device: "mobile",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    bitrate: "4500k",
    description: "Vertical 9:16 for smartphones, Instagram Reels & TikTok"
  },
  "tablet": {
    id: "tablet",
    name: "Tablet Display (4:3)",
    shortLabel: "Tablet (4:3)",
    device: "tablet",
    width: 1440,
    height: 1080,
    aspectRatio: "4:3",
    bitrate: "4500k",
    description: "4:3 aspect ratio tailored for iPad & tablet screens"
  },
  "square": {
    id: "square",
    name: "Social Square (1:1)",
    shortLabel: "Square (1:1)",
    device: "square",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    bitrate: "4000k",
    description: "Square 1:1 format for social media feeds"
  }
};

export async function processVideoRenderJob(jobId, projectId, mediaPaths = [], audioPath = null, options = {}) {
  const dbJob = await GenerationJob.findById(jobId);
  if (!dbJob) return;

  const presetKey = options.preset || options.resolution || "1080p";
  const preset = VIDEO_PRESETS[presetKey] || VIDEO_PRESETS["1080p"];

  try {
    dbJob.status = "processing";
    dbJob.progressPercent = 15;
    dbJob.currentStepMessage = `Preparing ${preset.name} (${preset.width}x${preset.height}) render pipeline...`;
    await dbJob.save();

    const timestamp = Date.now();
    const outputFilename = `rendered_video_${presetKey}_${timestamp}.mp4`;
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

    // Calculate durations from storyboard scene timestamps if available, or divide equally
    const hasExplicitDurations = rawScenes.every(s => typeof s.startTimeSeconds === "number" && typeof s.endTimeSeconds === "number" && s.endTimeSeconds > s.startTimeSeconds);

    let rawDurations = [];
    if (hasExplicitDurations && rawScenes.length > 0) {
      rawDurations = rawScenes.map(s => Math.max(1, s.endTimeSeconds - s.startTimeSeconds));
      const totalRaw = rawDurations.reduce((a, b) => a + b, 0);
      const ratio = targetSongDuration / totalRaw;
      rawDurations = rawDurations.map(d => Number((d * ratio).toFixed(2)));
    } else {
      const perSceneDuration = Number((targetSongDuration / Math.max(1, rawScenes.length)).toFixed(2));
      rawDurations = Array.from({ length: rawScenes.length }, () => perSceneDuration);
    }

    if (rawDurations.length > 0) {
      const sumExceptLast = rawDurations.slice(0, -1).reduce((a, b) => a + b, 0);
      rawDurations[rawDurations.length - 1] = Math.max(1, Number((targetSongDuration - sumExceptLast).toFixed(2)));
    }

    const tempFilesToClean = [];

    const scenesToRender = [];
    for (let idx = 0; idx < rawScenes.length; idx++) {
      const scene = rawScenes[idx];
      let mediaDoc = scene.mediaId;

      if (!mediaDoc || !mediaDoc.fileUrl) {
        mediaDoc = mediaDocs[idx % mediaDocs.length];
      }

      let imgPath = null;
      if (mediaDoc?.fileUrl) {
        imgPath = await ensureLocalFile(mediaDoc.fileUrl, uploadDir, `scene_${idx}`, tempFilesToClean);
      }

      scenesToRender.push({
        sceneNumber: scene.sceneNumber || idx + 1,
        duration: Math.max(1, rawDurations[idx] || 5),
        captionText: scene.captionText || scene.lyricSnippet || `Scene ${idx + 1}`,
        imgPath
      });
    }

    // Ensure fallback cover image if no media images exist
    const fallbackBmpPath = path.join(uploadDir, "fallback_cover.bmp");
    let hasFallbackCreated = false;

    for (const scene of scenesToRender) {
      if (!scene.imgPath) {
        if (!hasFallbackCreated) {
          const bmpBuffer = createSolidBmpBuffer(800, 600, "0A2D59");
          await fs.writeFile(fallbackBmpPath, bmpBuffer);
          hasFallbackCreated = true;
          tempFilesToClean.push(fallbackBmpPath);
        }
        scene.imgPath = fallbackBmpPath;
      }
    }

    // Determine audio track path
    let effectiveAudioPath = audioPath;
    if (!effectiveAudioPath && songDoc?.audioUrl) {
      effectiveAudioPath = await ensureLocalFile(songDoc.audioUrl, uploadDir, "song_audio", tempFilesToClean);
    }
    if (!effectiveAudioPath) {
      const fallbackWavPath = path.join(uploadDir, `fallback_audio_${timestamp}.wav`);
      const wavBuffer = createMusicalMelodyWavBuffer(targetSongDuration, 44100, songDoc?.genre || "Pop");
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
      tempFilesToClean.push(fallbackWavPath);
    }

    console.log("[Video Worker] Target song duration:", targetSongDuration);
    console.log("[Video Worker] scenesToRender count:", scenesToRender.length);

    // Detect if running on Render Free Tier or resource-constrained environment
    const isConstrained = Boolean(process.env.RENDER || env.nodeEnv === "production");

    // Render standardized scene MP4 segments matching the selected resolution preset
    const segmentPaths = [];
    for (let index = 0; index < scenesToRender.length; index++) {
      const scene = scenesToRender[index];
      const segPath = path.join(uploadDir, `seg_${timestamp}_${index}.mp4`);
      const srcPath = scene.imgPath;
      const isVideo = [".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(path.extname(srcPath || "").toLowerCase());

      console.log(`[Video Worker] Rendering segment ${index} (${preset.width}x${preset.height}): isVideo=${isVideo}, duration=${scene.duration}`);

      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        if (isVideo) {
          cmd.input(srcPath).inputOptions(["-stream_loop", "-1", "-t", String(scene.duration)]);
        } else {
          cmd.input(srcPath).inputOptions(["-loop", "1", "-t", String(scene.duration)]);
        }

        const segOutputOpts = [
          "-vf", `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p`,
          "-r", "25",
          "-an",
          "-c:v", "libx264",
          "-preset", "ultrafast"
        ];

        // Low-memory guard: limit to 1 thread on Render Free Tier to avoid 512MB OOM crash
        if (isConstrained) {
          segOutputOpts.push("-threads", "1");
        }

        cmd.outputOptions(segOutputOpts)
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
    dbJob.currentStepMessage = `Stitching scene segments with song audio into ${preset.name}...`;
    await dbJob.save();

    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .input(effectiveAudioPath);

    const finalOutputOpts = [
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", preset.bitrate,
      "-maxrate", preset.bitrate,
      "-bufsize", "512k",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", String(targetSongDuration)
    ];

    if (isConstrained) {
      finalOutputOpts.push("-threads", "1");
    }

    await new Promise((resolve, reject) => {
      command
        .outputOptions(finalOutputOpts)
        .save(tempOutputPath)
        .on("progress", async (p) => {
          dbJob.progressPercent = Math.min(95, Math.max(50, Math.round(p.percent || 60)));
          dbJob.currentStepMessage = `Encoding ${preset.name} H.264 video stream...`;
          await dbJob.save();
        })
        .on("end", resolve)
        .on("error", (err, stdout, stderr) => {
          console.error("FFmpeg error output:", stderr);
          reject(err);
        });
    });

    // Read rendered video and upload via universal storage adapter
    const finalVideoBuffer = await fs.readFile(tempOutputPath);
    const publicUrl = await uploadAssetBuffer(finalVideoBuffer, outputFilename, "video/mp4");

    // Cleanup temporary segment files & downloaded cloud assets
    await fs.unlink(concatListPath).catch(() => {});
    await Promise.all(segmentPaths.map((sp) => fs.unlink(sp).catch(() => {})));
    await Promise.all(tempFilesToClean.map((tf) => fs.unlink(tf).catch(() => {})));

    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: targetSongDuration,
      resolution: `${preset.width}x${preset.height} (${preset.shortLabel})`,
      aspectRatio: preset.aspectRatio,
      preset: presetKey
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
