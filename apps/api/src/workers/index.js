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

    // Build FFmpeg slideshow rendering command
    let command = ffmpeg();

    if (mediaPaths.length > 0) {
      mediaPaths.forEach((imgPath) => {
        command = command.input(imgPath).loop(4);
      });
    } else {
      // Fallback synthetic visual input if no images uploaded yet
      command = command.input("eval=sine:f=100:be=1").inputFormat("lavfi");
    }

    if (audioPath) {
      command = command.input(audioPath);
    } else {
      // Synthetic audio background
      command = command.input("eval=sine:f=440:be=2").inputFormat("lavfi");
    }

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
