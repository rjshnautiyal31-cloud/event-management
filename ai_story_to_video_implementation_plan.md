# Technical Implementation Plan: AI Story-to-Song-to-Video Platform

**Document Version:** 1.0  
**Author:** Senior Software Architect & Lead Developer  
**Status:** Approved for Development  
**Primary Tech Stack:** Node.js (Express ESM), MongoDB (Mongoose), React 18 (Vite + Tailwind CSS), Google Gemini 2.5 Flash API, FFmpeg, BullMQ / Redis  

---

## Executive Summary & Architecture Overview

This document provides a comprehensive, phase-wise technical blueprint for integrating an **AI Story-to-Song-to-Video Platform** into the existing monorepo workspace.

The architecture is built upon an **Environment-Driven Provider Abstraction Layer**. This design allows the entire platform to be developed, tested, and executed **100% locally at zero additional cost** using only a **Google Gemini API Key** and local open-source utilities (Local Disk Storage, In-Memory/Local Redis Queues, Local FFmpeg, and Local Synth Audio). 

When ready for production, switching environment variables toggles the backend seamlessly to cloud infrastructure (**AWS S3 / Cloudflare R2, Upstash Redis, BullMQ workers on Render, and Suno/ElevenLabs AI**) with **zero code modifications**.

---

## Architecture Diagram & Data Flow

```
                                  +---------------------------------+
                                  |   User Browser (React / Vite)   |
                                  +----------------+----------------+
                                                   |
                                                   v
                                  +---------------------------------+
                                  |    Express API (apps/api)       |
                                  +--------+-------+-------+--------+
                                           |       |       |
                 +-------------------------+       |       +-------------------------+
                 |                                 |                                 |
                 v                                 v                                 v
   +---------------------------+     +---------------------------+     +---------------------------+
   |   LLM Adapter             |     |   Storage Factory Adapter |     |   Database Tier           |
   |   - Gemini 2.5 Flash      |     |   - Local Disk (Dev)      |     |   - MongoDB (Mongoose)    |
   |   - OpenAI (Prod Fallback) |     |   - AWS S3 / R2 (Prod)    |     |                           |
   +---------------------------+     +---------------------------+     +---------------------------+
                                                   |
                                                   v
                                     +---------------------------+
                                     |   Queue Factory Adapter   |
                                     |   - Memory Queue (Dev)    |
                                     |   - Redis / BullMQ (Prod) |
                                     +-------------+-------------+
                                                   |
                                                   v
                                     +---------------------------+
                                     |   Background Worker       |
                                     |   - Local FFmpeg Engine   |
                                     |   - Audio/Video Renderer  |
                                     +---------------------------+
```

---

## Phase 1: Environment & Foundational Setup

### 1.1 Backend Dependency Installation (`apps/api`)
Run the following package installations inside `apps/api`:
```bash
cd apps/api
npm install @google/genai bullmq ioredis @aws-sdk/client-s3 @aws-sdk/s3-request-presigner fluent-ffmpeg ffmpeg-static zod
```

### 1.2 Centralized Environment Configuration ([`apps/api/src/config/env.js`](file:///var/www/html/ai-projects/apps/api/src/config/env.js))
Create a validated environment parser using `zod` and `dotenv`:

```javascript
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().default("mongodb://127.0.0.1:27017/ai_story_video"),

  // Configurable Provider Flags
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  QUEUE_PROVIDER: z.enum(["memory", "redis"]).default("memory"),
  MUSIC_PROVIDER: z.enum(["local_synth", "suno", "elevenlabs"]).default("local_synth"),
  LLM_PROVIDER: z.enum(["gemini", "openai"]).default("gemini"),

  // Service Keys
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  REDIS_URL: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  MUSIC_API_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);
```

### 1.3 Local vs Production Environment Files

#### `.env.local` (Local Testing - Zero External Cost)
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/ai_story_video_dev
STORAGE_PROVIDER=local
QUEUE_PROVIDER=memory
MUSIC_PROVIDER=local_synth
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
```

#### `.env.production` (Cloud Production)
```env
PORT=4000
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/ai_story_video_prod
STORAGE_PROVIDER=s3
QUEUE_PROVIDER=redis
MUSIC_PROVIDER=suno
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere
REDIS_URL=rediss://default:pass@upstash-redis.com:6379
S3_BUCKET=my-app-media-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=secret...
MUSIC_API_KEY=suno_api_key_here
```

---

## Phase 2: Database Schemas & Mongoose Models

Create these models under `apps/api/src/models/`:

### 2.1 [`apps/api/src/models/Project.js`](file:///var/www/html/ai-projects/apps/api/src/models/Project.js)
```javascript
import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    storyText: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "analyzed", "lyrics_generated", "music_generated", "storyboarded", "rendering", "completed", "failed"],
      default: "draft",
      index: true
    },
    activeStoryAnalysisId: { type: mongoose.Schema.Types.ObjectId, ref: "StoryAnalysis" },
    activeSongId: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
    activeStoryboardId: { type: mongoose.Schema.Types.ObjectId, ref: "Storyboard" },
    activeVideoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video" }
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
```

### 2.2 [`apps/api/src/models/StoryAnalysis.js`](file:///var/www/html/ai-projects/apps/api/src/models/StoryAnalysis.js)
```javascript
import mongoose from "mongoose";

const storyAnalysisSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    summary: { type: String, required: true },
    emotionalArc: [String],
    themes: [String],
    suggestedGenres: [String],
    keyMoments: [
      {
        momentNumber: Number,
        description: String,
        visualIdea: String,
        suggestedDurationSeconds: Number
      }
    ]
  },
  { timestamps: true }
);

export const StoryAnalysis = mongoose.model("StoryAnalysis", storyAnalysisSchema);
```

### 2.3 [`apps/api/src/models/Song.js`](file:///var/www/html/ai-projects/apps/api/src/models/Song.js)
```javascript
import mongoose from "mongoose";

const songSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    lyrics: { type: String, required: true },
    genre: { type: String, required: true },
    mood: { type: String, required: true },
    audioUrl: { type: String },
    durationSeconds: { type: Number, default: 30 },
    provider: { type: String, default: "local_synth" },
    status: { type: String, enum: ["pending", "generating", "ready", "failed"], default: "pending" }
  },
  { timestamps: true }
);

export const Song = mongoose.model("Song", songSchema);
```

### 2.4 [`apps/api/src/models/Media.js`](file:///var/www/html/ai-projects/apps/api/src/models/Media.js)
```javascript
import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    fileUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], default: "image" },
    originalFilename: { type: String },
    width: Number,
    height: Number,
    durationSeconds: Number
  },
  { timestamps: true }
);

export const Media = mongoose.model("Media", mediaSchema);
```

### 2.5 [`apps/api/src/models/Storyboard.js`](file:///var/www/html/ai-projects/apps/api/src/models/Storyboard.js)
```javascript
import mongoose from "mongoose";

const storyboardSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    songId: { type: mongoose.Schema.Types.ObjectId, ref: "Song", required: true },
    scenes: [
      {
        sceneNumber: Number,
        startTimeSeconds: Number,
        endTimeSeconds: Number,
        mediaId: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
        captionText: String,
        transitionEffect: { type: String, default: "fade" }
      }
    ]
  },
  { timestamps: true }
);

export const Storyboard = mongoose.model("Storyboard", storyboardSchema);
```

### 2.6 [`apps/api/src/models/Video.js`](file:///var/www/html/ai-projects/apps/api/src/models/Video.js)
```javascript
import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    videoUrl: { type: String, required: true },
    durationSeconds: Number,
    resolution: { type: String, default: "1080p" },
    fileSizeBytes: Number
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);
```

### 2.7 [`apps/api/src/models/GenerationJob.js`](file:///var/www/html/ai-projects/apps/api/src/models/GenerationJob.js)
```javascript
import mongoose from "mongoose";

const generationJobSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    jobType: {
      type: String,
      enum: ["story_analysis", "lyrics_generation", "music_generation", "storyboard_generation", "video_rendering"],
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
      index: true
    },
    progressPercent: { type: Number, default: 0 },
    currentStepMessage: { type: String, default: "Queued..." },
    resultRef: { type: mongoose.Schema.Types.ObjectId },
    errorMessage: { type: String }
  },
  { timestamps: true }
);

export const GenerationJob = mongoose.model("GenerationJob", generationJobSchema);
```

---

## Phase 3: Provider Abstraction Layer

### 3.1 Storage Factory Module ([`apps/api/src/services/storage/index.js`](file:///var/www/html/ai-projects/apps/api/src/services/storage/index.js))

```javascript
import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

// Local Storage Provider
class LocalStorageProvider {
  constructor() {
    this.uploadDir = path.join(process.cwd(), "uploads");
    fs.mkdir(this.uploadDir, { recursive: true }).catch(console.error);
  }

  async uploadFile(fileBuffer, filename) {
    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, fileBuffer);
    return `http://localhost:${env.PORT}/uploads/${filename}`;
  }
}

// AWS S3 / Cloudflare R2 Storage Provider
class S3StorageProvider {
  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION || "us-east-1",
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || ""
      }
    });
  }

  async uploadFile(fileBuffer, filename) {
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: filename,
      Body: fileBuffer
    });
    await this.client.send(command);
    return `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${filename}`;
  }
}

const localAdapter = new LocalStorageProvider();
const s3Adapter = new S3StorageProvider();

export function getStorageProvider() {
  return env.STORAGE_PROVIDER === "s3" ? s3Adapter : localAdapter;
}
```

### 3.2 Gemini LLM Provider Adapter ([`apps/api/src/services/providers/gemini.provider.js`](file:///var/www/html/ai-projects/apps/api/src/services/providers/gemini.provider.js))

```javascript
import { GoogleGenAI, Type } from "@google/genai";
import { env } from "../../config/env.js";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function analyzeStoryWithGemini(storyText) {
  const prompt = `Analyze the following story for a music video project. Provide a summary, emotional arc, key themes, and visual moments:\n\n${storyText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          emotionalArc: { type: Type.ARRAY, items: { type: Type.STRING } },
          themes: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedGenres: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyMoments: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                momentNumber: { type: Type.INTEGER },
                description: { type: Type.STRING },
                visualIdea: { type: Type.STRING },
                suggestedDurationSeconds: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function generateLyricsWithGemini(storySummary, targetGenre) {
  const prompt = `Write structured song lyrics (Verse 1, Chorus, Verse 2, Chorus, Outro) based on this story summary: "${storySummary}". Style: ${targetGenre}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  return response.text;
}
```

---

## Phase 4: Async Processing Engine & Workers

### 4.1 Dual Queue Factory ([`apps/api/src/services/queue/index.js`](file:///var/www/html/ai-projects/apps/api/src/services/queue/index.js))

```javascript
import EventEmitter from "events";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../../config/env.js";

class MemoryQueueProvider extends EventEmitter {
  async addJob(jobName, payload) {
    setImmediate(() => this.emit("process", { name: jobName, data: payload }));
  }
}

class BullMQProvider {
  constructor() {
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    this.queue = new Queue("media-generation-queue", { connection });
  }

  async addJob(jobName, payload) {
    await this.queue.add(jobName, payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 }
    });
  }
}

export const queueService = env.QUEUE_PROVIDER === "redis" ? new BullMQProvider() : new MemoryQueueProvider();
```

### 4.2 Background Worker Process ([`apps/api/src/workers/index.js`](file:///var/www/html/ai-projects/apps/api/src/workers/index.js))

```javascript
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import path from "path";
import { GenerationJob } from "../models/GenerationJob.js";
import { Video } from "../models/Video.js";
import { Project } from "../models/Project.js";

ffmpeg.setFfmpegPath(ffmpegInstaller);

export async function processVideoRenderJob(jobId, projectId, mediaPaths, audioPath) {
  const dbJob = await GenerationJob.findById(jobId);
  dbJob.status = "processing";
  dbJob.progressPercent = 20;
  dbJob.currentStepMessage = "Initialising local FFmpeg video renderer...";
  await dbJob.save();

  const outputFilename = `rendered_video_${Date.now()}.mp4`;
  const tempOutputPath = path.join(process.cwd(), "uploads", outputFilename);

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    mediaPaths.forEach((imgPath) => {
      command = command.input(imgPath).loop(4);
    });

    command
      .input(audioPath)
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
        dbJob.currentStepMessage = "Stitching frames and audio track...";
        await dbJob.save();
      })
      .on("end", async () => {
        const publicUrl = `http://localhost:${process.env.PORT || 4000}/uploads/${outputFilename}`;
        const videoDoc = await Video.create({
          projectId,
          videoUrl: publicUrl,
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

        resolve(videoDoc);
      })
      .on("error", async (err) => {
        dbJob.status = "failed";
        dbJob.errorMessage = err.message;
        await dbJob.save();
        reject(err);
      });
  });
}
```

---

## Phase 5: REST API Services & Routes

Create router [`apps/api/src/routes/storyVideo.routes.js`](file:///var/www/html/ai-projects/apps/api/src/routes/storyVideo.routes.js):

```javascript
import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { StoryAnalysis } from "../models/StoryAnalysis.js";
import { Song } from "../models/Song.js";
import { GenerationJob } from "../models/GenerationJob.js";
import { analyzeStoryWithGemini, generateLyricsWithGemini } from "../services/providers/gemini.provider.js";
import { queueService } from "../services/queue/index.js";

const router = Router();

// 1. Create Project
router.post("/projects", authenticate, async (req, res) => {
  const project = await Project.create({
    userId: req.user.id,
    title: req.body.title,
    storyText: req.body.storyText
  });
  res.status(201).json(project);
});

// 2. Analyze Story with Gemini
router.post("/projects/:id/analyze", authenticate, async (req, res) => {
  const project = await Project.findById(req.params.id);
  const analysisData = await analyzeStoryWithGemini(project.storyText);

  const analysisDoc = await StoryAnalysis.create({
    projectId: project._id,
    ...analysisData
  });

  project.status = "analyzed";
  project.activeStoryAnalysisId = analysisDoc._id;
  await project.save();

  res.json(analysisDoc);
});

// 3. Generate Lyrics
router.post("/projects/:id/lyrics", authenticate, async (req, res) => {
  const { genre } = req.body;
  const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId");
  
  const lyricsText = await generateLyricsWithGemini(project.activeStoryAnalysisId.summary, genre || "Pop");

  const songDoc = await Song.create({
    projectId: project._id,
    lyrics: lyricsText,
    genre: genre || "Pop",
    mood: project.activeStoryAnalysisId.mood || "Upbeat"
  });

  project.status = "lyrics_generated";
  project.activeSongId = songDoc._id;
  await project.save();

  res.json(songDoc);
});

// 4. Trigger Async Video Render (Non-Blocking HTTP 202)
router.post("/projects/:id/render", authenticate, async (req, res) => {
  const job = await GenerationJob.create({
    projectId: req.params.id,
    jobType: "video_rendering",
    status: "queued"
  });

  await queueService.addJob("video_rendering", {
    jobId: job._id.toString(),
    projectId: req.params.id
  });

  res.status(202).json({ jobId: job._id, message: "Video render job queued" });
});

// 5. Poll Job Progress
router.get("/jobs/:jobId", authenticate, async (req, res) => {
  const job = await GenerationJob.findById(req.params.jobId);
  res.json(job);
});

export default router;
```

In `apps/api/src/server.js`, mount the static uploads directory and route:
```javascript
import express from "express";
import storyVideoRoutes from "./routes/storyVideo.routes.js";

app.use("/uploads", express.static("uploads"));
app.use("/api/story-video", storyVideoRoutes);
```

---

## Phase 6: Frontend Studio User Interface (`apps/web`)

### 6.1 Studio Page Component ([`apps/web/src/pages/ProjectStudioPage.jsx`](file:///var/www/html/ai-projects/apps/web/src/pages/ProjectStudioPage.jsx))
Build a multi-step tabbed workflow:
- **Tab 1: Narrative Input**: Accepts story text and launches Gemini analysis.
- **Tab 2: Lyrics & Music**: Customizes genre, edits AI lyrics, and generates audio.
- **Tab 3: Media Gallery**: Uploads photos/videos with local drag-and-drop.
- **Tab 4: Storyboard Timeline**: Re-orders scenes and maps media to audio timestamps.
- **Tab 5: Video Preview & Export**: Triggers FFmpeg rendering with real-time polling progress bar and HTML5 MP4 player.

---

## Phase 7: Verification & Testing Strategy

1. **Local Test Execution**:
   - Run `npm run dev:api` and `npm run dev:web`.
   - Submit a story via the Studio UI.
   - Verify Gemini creates structured JSON analysis and lyrics.
   - Trigger local video rendering and confirm output MP4 plays smoothly at `http://localhost:4000/uploads/rendered_video_...mp4`.

2. **Build & Syntax Verification**:
   - Run `node --check apps/api/src/server.js`
   - Run `npm run build` in `apps/web`
