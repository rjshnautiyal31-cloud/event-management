import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";
import { Storyboard } from "../models/Storyboard.js";
import { Media } from "../models/Media.js";
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
    dbJob.currentStepMessage = "Fetching project storyboard and media timeline...";
    await dbJob.save();

    const timestamp = Date.now();
    const outputFilename = `rendered_video_${timestamp}.mp4`;
    const uploadDir = path.join(process.cwd(), "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const tempOutputPath = path.join(uploadDir, outputFilename);

    // Fetch Storyboard and uploaded Media items
    const storyboardDoc = await Storyboard.findOne({ projectId }).populate("scenes.mediaId");
    const mediaDocs = await Media.find({ projectId }).sort({ createdAt: 1 });

    let scenesToRender = [];

    if (storyboardDoc?.scenes?.length > 0) {
      scenesToRender = storyboardDoc.scenes.map((scene, idx) => {
        let imgPath = null;
        if (scene.mediaId?.fileUrl?.includes("/uploads/")) {
          imgPath = path.join(uploadDir, path.basename(scene.mediaId.fileUrl));
        } else if (mediaDocs[idx % mediaDocs.length]?.fileUrl?.includes("/uploads/")) {
          imgPath = path.join(uploadDir, path.basename(mediaDocs[idx % mediaDocs.length].fileUrl));
        }
        return {
          sceneNumber: scene.sceneNumber || idx + 1,
          duration: Math.max(2, (scene.endTimeSeconds || (idx + 1) * 5) - (scene.startTimeSeconds || idx * 5)),
          captionText: scene.captionText || `Scene ${idx + 1}`,
          imgPath
        };
      });
    } else {
      // Build default 30s storyboard from media docs
      const mediaList = mediaDocs.length > 0 ? mediaDocs : [];
      const totalScenes = Math.max(4, mediaList.length);
      const perSceneDuration = 5;

      for (let i = 0; i < totalScenes; i++) {
        let imgPath = null;
        if (mediaList[i % mediaList.length]?.fileUrl?.includes("/uploads/")) {
          imgPath = path.join(uploadDir, path.basename(mediaList[i % mediaList.length].fileUrl));
        }
        scenesToRender.push({
          sceneNumber: i + 1,
          duration: perSceneDuration,
          captionText: `Event Scene ${i + 1}`,
          imgPath
        });
      }
    }

    // Ensure fallback cover image if no media images exist
    const fallbackBmpPath = path.join(uploadDir, "fallback_cover.bmp");
    let hasFallbackCreated = false;

    scenesToRender.forEach(async (scene) => {
      if (!scene.imgPath) {
        if (!hasFallbackCreated) {
          const bmpBuffer = createSolidBmpBuffer(800, 600, "0A2D59");
          fs.writeFile(fallbackBmpPath, bmpBuffer);
          hasFallbackCreated = true;
        }
        scene.imgPath = fallbackBmpPath;
      }
    });

    // Fallback audio if no song track generated
    let effectiveAudioPath = audioPath;
    if (!effectiveAudioPath) {
      const fallbackWavPath = path.join(uploadDir, "fallback_audio.wav");
      const wavBuffer = createMusicalMelodyWavBuffer(30, 44100);
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
    }

    // Build FFmpeg Concat List File & SRT Subtitle File
    const concatListPath = path.join(uploadDir, `concat_${timestamp}.txt`);
    const srtSubtitlePath = path.join(uploadDir, `subtitles_${timestamp}.srt`);

    let concatContent = "";
    let srtContent = "";
    let currentClockSeconds = 0;

    scenesToRender.forEach((scene, index) => {
      const safePath = scene.imgPath.replace(/'/g, "'\\''");
      concatContent += `file '${safePath}'\nduration ${scene.duration}\n`;

      const startTimeSrt = formatSrtTime(currentClockSeconds);
      const endTimeSrt = formatSrtTime(currentClockSeconds + scene.duration);

      srtContent += `${index + 1}\n${startTimeSrt} --> ${endTimeSrt}\n${scene.captionText}\n\n`;
      currentClockSeconds += scene.duration;
    });

    // Repeat last image entry without duration per FFmpeg concat spec
    const lastImgPath = scenesToRender[scenesToRender.length - 1].imgPath.replace(/'/g, "'\\''");
    concatContent += `file '${lastImgPath}'\n`;

    await fs.writeFile(concatListPath, concatContent);
    await fs.writeFile(srtSubtitlePath, srtContent);

    dbJob.progressPercent = 40;
    dbJob.currentStepMessage = "Stitching storyboard scene frames and burning captions...";
    await dbJob.save();

    // Escape SRT path for FFmpeg filter argument
    const safeSrtPath = srtSubtitlePath.replace(/'/g, "'\\''");

    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .input(effectiveAudioPath);

    await new Promise((resolve, reject) => {
      command
        .outputOptions([
          "-vf", `scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p,subtitles=${safeSrtPath}:force_style='FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,MarginV=30'`,
          "-r", "25",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-c:a", "aac",
          "-b:a", "192k",
          "-shortest"
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

    // Cleanup temporary manifest and subtitle files
    await fs.unlink(concatListPath).catch(() => {});
    await fs.unlink(srtSubtitlePath).catch(() => {});

    const publicUrl = `http://localhost:${env.port}/uploads/${outputFilename}`;

    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: currentClockSeconds,
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
