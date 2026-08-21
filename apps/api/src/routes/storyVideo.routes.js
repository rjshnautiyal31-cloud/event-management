import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole, requireEventAccess } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { StoryAnalysis } from "../models/StoryAnalysis.js";
import { Song } from "../models/Song.js";
import { Media } from "../models/Media.js";
import { Storyboard } from "../models/Storyboard.js";
import { Video } from "../models/Video.js";
import { GenerationJob } from "../models/GenerationJob.js";
import { analyzeStoryWithGemini, generateLyricsWithGemini } from "../services/providers/gemini.provider.js";
import { getMusicProvider } from "../services/music/index.js";
import { getStorageProvider } from "../services/storage/index.js";
import { processVideoRenderJob } from "../workers/index.js";

const upload = multer({ storage: multer.memoryStorage() });
export const storyVideoRouter = Router();

// Enforce ACL: Require authentication and require admin role (super_admin, admin, or event_admin)
storyVideoRouter.use(requireAuth);
storyVideoRouter.use(requireRole("admin"));

// 1. Get Projects for an Event (an event can have multiple story/song/video projects)
storyVideoRouter.get("/projects", async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const filter = {};
    if (eventId) {
      filter.eventId = eventId;
    }

    const projects = await Project.find(filter)
      .populate("activeStoryAnalysisId activeSongId activeStoryboardId activeVideoId")
      .sort({ updatedAt: -1 });

    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// 2. Create a new AI Story Project for a specific Event
storyVideoRouter.post("/projects", requireEventAccess(["event_admin"]), async (req, res, next) => {
  try {
    const { eventId, title, storyText, description } = req.body;
    if (!eventId || !title || !storyText) {
      return res.status(400).json({ message: "eventId, title, and story text are required" });
    }

    const project = await Project.create({
      eventId,
      userId: req.user.id,
      title,
      description: description || "",
      storyText,
      status: "draft"
    });

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// 3. Get Details for a Specific Project
storyVideoRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("activeStoryAnalysisId activeSongId activeStoryboardId activeVideoId");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// 4. Analyze Story Narrative with Gemini AI
storyVideoRouter.post("/projects/:id/analyze", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const analysisData = await analyzeStoryWithGemini(project.storyText);

    const analysisDoc = await StoryAnalysis.create({
      projectId: project._id,
      ...analysisData
    });

    project.status = "analyzed";
    project.activeStoryAnalysisId = analysisDoc._id;
    await project.save();

    res.json(analysisDoc);
  } catch (err) {
    next(err);
  }
});

// 5. Generate AI Lyrics & Synth Audio Track
storyVideoRouter.post("/projects/:id/lyrics", async (req, res, next) => {
  try {
    const { genre } = req.body;
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId");
    if (!project || !project.activeStoryAnalysisId) {
      return res.status(400).json({ message: "Project must be analyzed first" });
    }

    const targetGenre = genre || project.activeStoryAnalysisId.suggestedGenres?.[0] || "Pop";
    const lyricsText = await generateLyricsWithGemini(project.activeStoryAnalysisId.summary, targetGenre);

    const musicEngine = getMusicProvider();
    const audioResult = await musicEngine.generateMusic({ lyrics: lyricsText, genre: targetGenre, durationSeconds: 15 });

    const songDoc = await Song.create({
      projectId: project._id,
      lyrics: lyricsText,
      genre: targetGenre,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      audioUrl: audioResult.audioUrl,
      durationSeconds: audioResult.durationSeconds,
      status: "ready"
    });

    project.status = "lyrics_generated";
    project.activeSongId = songDoc._id;
    await project.save();

    res.json(songDoc);
  } catch (err) {
    next(err);
  }
});

// 6. Upload Photo/Media Assets for Event Story
storyVideoRouter.post("/projects/:id/media", upload.single("file"), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const storage = getStorageProvider();
    const filename = `media_${Date.now()}_${path.extname(req.file.originalname) || ".jpg"}`;
    const fileUrl = await storage.uploadFile(req.file.buffer, filename);

    const mediaDoc = await Media.create({
      projectId: project._id,
      fileUrl,
      mediaType: "image",
      originalFilename: req.file.originalname
    });

    res.status(201).json(mediaDoc);
  } catch (err) {
    next(err);
  }
});

// 7. Get Media Items for a Project
storyVideoRouter.get("/projects/:id/media", async (req, res, next) => {
  try {
    const mediaItems = await Media.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    res.json(mediaItems);
  } catch (err) {
    next(err);
  }
});

// 8. Generate Scene Storyboard Mapping
storyVideoRouter.post("/projects/:id/storyboard", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId activeSongId");

    if (!project || !project.activeSongId) {
      return res.status(400).json({ message: "Project must have generated lyrics and song first" });
    }

    const mediaItems = await Media.find({ projectId: project._id });
    const moments = project.activeStoryAnalysisId?.keyMoments || [];

    const scenes = moments.map((moment, index) => ({
      sceneNumber: index + 1,
      startTimeSeconds: index * 5,
      endTimeSeconds: (index + 1) * 5,
      mediaId: mediaItems[index % mediaItems.length]?._id || null,
      captionText: moment.visualIdea || `Scene ${index + 1}`,
      transitionEffect: "fade"
    }));

    const storyboardDoc = await Storyboard.create({
      projectId: project._id,
      songId: project.activeSongId._id,
      scenes
    });

    project.status = "storyboarded";
    project.activeStoryboardId = storyboardDoc._id;
    await project.save();

    res.json(storyboardDoc);
  } catch (err) {
    next(err);
  }
});

// 9. Trigger FFmpeg Async Video Rendering Task
storyVideoRouter.post("/projects/:id/render", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeSongId");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const mediaItems = await Media.find({ projectId: project._id });
    const mediaPaths = mediaItems
      .map(item => item.fileUrl)
      .filter(url => url.includes("/uploads/"))
      .map(url => path.join(process.cwd(), "uploads", path.basename(url)));

    let songDoc = project.activeSongId;
    if (!songDoc) {
      songDoc = await Song.findOne({ projectId: project._id }).sort({ createdAt: -1 });
    }

    let audioPath = null;
    if (songDoc?.audioUrl && songDoc.audioUrl.includes("/uploads/")) {
      audioPath = path.join(process.cwd(), "uploads", path.basename(songDoc.audioUrl));
    }

    const job = await GenerationJob.create({
      projectId: project._id,
      jobType: "video_rendering",
      status: "queued"
    });

    project.status = "rendering";
    await project.save();

    processVideoRenderJob(job._id, project._id, mediaPaths, audioPath).catch(err => {
      console.error("Background render error:", err);
    });

    res.status(202).json({ jobId: job._id, message: "Video rendering task queued successfully" });
  } catch (err) {
    next(err);
  }
});

// 10. Poll Job Status
storyVideoRouter.get("/jobs/:jobId", async (req, res, next) => {
  try {
    const job = await GenerationJob.findById(req.params.jobId).populate("resultRef");
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});
