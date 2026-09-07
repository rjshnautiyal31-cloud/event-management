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
import { analyzeStoryWithGemini, generateLyricsWithGemini, generateSceneImageWithGemini, generateStoryboardFromLyrics } from "../services/providers/gemini.provider.js";
import { getMusicProvider } from "../services/music/index.js";
import { getVideoProvider } from "../services/video/index.js";
import { getStorageProvider } from "../services/storage/index.js";
import { processVideoRenderJob, VIDEO_PRESETS } from "../workers/index.js";

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
    const { genre, musicProvider } = req.body;
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId");
    if (!project || !project.activeStoryAnalysisId) {
      return res.status(400).json({ message: "Project must be analyzed first" });
    }

    const targetGenre = genre || project.activeStoryAnalysisId.suggestedGenres?.[0] || "Pop";
    const lyricsText = await generateLyricsWithGemini(project.activeStoryAnalysisId.summary, targetGenre);

    const providerToUse = musicProvider || "google_lyria";
    const musicEngine = getMusicProvider(providerToUse);
    const wordCount = lyricsText.split(/\s+/).filter(Boolean).length;
    const lyricsDurationSeconds = Math.max(30, Math.min(90, Math.ceil(wordCount / 2.2)));

    const audioResult = await musicEngine.generateMusic({
      lyrics: lyricsText,
      genre: targetGenre,
      durationSeconds: lyricsDurationSeconds,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      storyContext: project.storyText || project.activeStoryAnalysisId.summary || "",
      title: project.title || ""
    });

    const finalLyrics = audioResult.lyrics || lyricsText;

    const songDoc = await Song.create({
      projectId: project._id,
      lyrics: finalLyrics,
      genre: targetGenre,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      audioUrl: audioResult.audioUrl,
      durationSeconds: audioResult.durationSeconds,
      provider: providerToUse,
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

    const ext = path.extname(req.file.originalname).toLowerCase() || ".jpg";
    const isVideo = req.file.mimetype.startsWith("video/") || [".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(ext);
    const mediaType = isVideo ? "video" : "image";

    const storage = getStorageProvider();
    const filename = `media_${Date.now()}_${ext}`;
    const fileUrl = await storage.uploadFile(req.file.buffer, filename);

    const mediaDoc = await Media.create({
      projectId: project._id,
      fileUrl,
      mediaType,
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

// Delete specific media item
storyVideoRouter.delete("/projects/:id/media/:mediaId", async (req, res, next) => {
  try {
    await Media.deleteOne({ _id: req.params.mediaId, projectId: req.params.id });
    res.json({ message: "Media deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Clear all uploaded media items for a project
storyVideoRouter.delete("/projects/:id/media", async (req, res, next) => {
  try {
    await Media.deleteMany({ projectId: req.params.id });
    res.json({ message: "All media cleared successfully" });
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

    const { targetSceneDuration = 6 } = req.body;
    const mediaItems = await Media.find({ projectId: project._id }).sort({ createdAt: 1 });
    const totalSongDuration = project.activeSongId.durationSeconds || 30;
    const lyrics = project.activeSongId.lyrics || "";
    const storyContext = project.summary || project.title || "";

    console.log(`[API Storyboard] Generating synchronized storyboard from lyrics (${totalSongDuration}s, ~${targetSceneDuration}s/scene)...`);
    const generatedScenes = await generateStoryboardFromLyrics({
      storyContext,
      lyrics,
      totalDurationSeconds: totalSongDuration,
      targetSceneDuration: Number(targetSceneDuration) || 6
    });

    console.log(`[API Storyboard] Generated ${generatedScenes.length} synchronized scenes matching song lyrics.`);

    const scenes = [];

    // Map each generated scene to a media item or assign from project media
    for (let index = 0; index < generatedScenes.length; index++) {
      const sceneItem = generatedScenes[index];
      let media = mediaItems.length > 0 ? mediaItems[index % mediaItems.length] : null;

      // If project has no media at all, generate an initial frame for the first scene
      if (!media && index === 0 && sceneItem.visualIdea) {
        const generatedImageUrl = await generateSceneImageWithGemini(sceneItem.visualIdea);
        if (generatedImageUrl) {
          media = await Media.create({
            projectId: project._id,
            fileUrl: generatedImageUrl,
            mediaType: "image",
            originalFilename: `scene_frame_${sceneItem.sceneNumber}.jpg`,
            caption: sceneItem.visualIdea
          });
          mediaItems.push(media);
        }
      }

      scenes.push({
        sceneNumber: sceneItem.sceneNumber || index + 1,
        startTimeSeconds: sceneItem.startTimeSeconds,
        endTimeSeconds: sceneItem.endTimeSeconds,
        mediaId: media?._id || null,
        captionText: sceneItem.lyricSnippet || sceneItem.visualIdea || `Scene ${index + 1}`,
        lyricSnippet: sceneItem.lyricSnippet || "",
        visualPrompt: sceneItem.visualIdea || "",
        transitionEffect: "fade"
      });
    }

    const storyboardDoc = await Storyboard.create({
      projectId: project._id,
      songId: project.activeSongId._id,
      scenes
    });

    await Project.findByIdAndUpdate(project._id, {
      status: "storyboarded",
      activeStoryboardId: storyboardDoc._id
    });

    res.json(storyboardDoc);
  } catch (err) {
    next(err);
  }
});

// 8b. Generate Google Veo AI Motion Video Clip for an Individual Scene
storyVideoRouter.post("/projects/:id/scenes/:sceneIndex/veo", async (req, res, next) => {
  try {
    const { id, sceneIndex } = req.params;
    const project = await Project.findById(id).populate({
      path: "activeStoryboardId",
      populate: { path: "scenes.mediaId" }
    });

    if (!project || !project.activeStoryboardId) {
      return res.status(400).json({ message: "Project must have a storyboard generated first" });
    }

    const storyboard = project.activeStoryboardId;
    const idx = parseInt(sceneIndex, 10);
    const scene = storyboard.scenes[idx];
    if (!scene) {
      return res.status(404).json({ message: `Scene at index ${sceneIndex} not found` });
    }

    const promptText = req.body.prompt || scene.visualPrompt || scene.captionText || "Cinematic celebratory scene with lively motion and atmospheric lighting";
    const sourceImageUrl = scene.mediaId?.fileUrl || null;

    console.log(`[API Story Video] Generating Gemini Omni 1.1 Flash video clip for Scene ${scene.sceneNumber}: "${promptText.slice(0, 60)}..."`);

    const videoEngine = getVideoProvider("google_omni");
    const videoUrl = await videoEngine.generateSceneVideoClip({
      imageUrl: sourceImageUrl,
      promptText,
      durationSeconds: 5
    });

    if (!videoUrl || !videoUrl.endsWith(".mp4")) {
      return res.status(500).json({ message: "Google Gemini Omni 1.1 Flash was unable to generate a video clip for this scene" });
    }

    const mediaDoc = await Media.create({
      projectId: project._id,
      fileUrl: videoUrl,
      mediaType: "video",
      originalFilename: `omni_scene_${scene.sceneNumber}.mp4`,
      durationSeconds: 5
    });

    scene.mediaId = mediaDoc._id;
    await Storyboard.updateOne(
      { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
      { $set: { "scenes.$.mediaId": mediaDoc._id } }
    );

    res.json({
      message: "Google Gemini Omni 1.1 motion video clip generated successfully",
      sceneNumber: scene.sceneNumber,
      media: mediaDoc,
      videoUrl
    });
  } catch (err) {
    next(err);
  }
});

// 8c. Generate Google Gemini Omni 1.1 AI Motion Video Clips for All Scenes
storyVideoRouter.post("/projects/:id/scenes/generate-all-veo", async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).populate({
      path: "activeStoryboardId",
      populate: { path: "scenes.mediaId" }
    });

    if (!project || !project.activeStoryboardId) {
      return res.status(400).json({ message: "Project must have a storyboard generated first" });
    }

    const storyboard = project.activeStoryboardId;
    const videoEngine = getVideoProvider("google_omni");
    const results = [];

    const scenesToProcess = [];
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      if (scene.mediaId?.mediaType === "video" && scene.mediaId?.fileUrl?.endsWith(".mp4")) {
        results.push({ sceneNumber: scene.sceneNumber, status: "already_video", videoUrl: scene.mediaId.fileUrl });
      } else {
        scenesToProcess.push(scene);
      }
    }

    // Process scenes concurrently in batches of 2
    const batchSize = 2;
    for (let b = 0; b < scenesToProcess.length; b += batchSize) {
      const batch = scenesToProcess.slice(b, b + batchSize);
      await Promise.all(
        batch.map(async (scene) => {
          const promptText = scene.visualPrompt || scene.captionText || "Cinematic celebration moment";
          const sourceImageUrl = scene.mediaId?.fileUrl || null;

          try {
            console.log(`[API Story Video] Generating scene ${scene.sceneNumber}/${storyboard.scenes.length} with Gemini Omni 1.1 Flash: "${promptText.slice(0, 50)}..."`);
            const videoUrl = await videoEngine.generateSceneVideoClip({
              imageUrl: sourceImageUrl,
              promptText,
              durationSeconds: 5
            });

            if (videoUrl && videoUrl.endsWith(".mp4")) {
              const mediaDoc = await Media.create({
                projectId: project._id,
                fileUrl: videoUrl,
                mediaType: "video",
                originalFilename: `omni_scene_${scene.sceneNumber}.mp4`,
                durationSeconds: 5
              });
              scene.mediaId = mediaDoc._id;
              await Storyboard.updateOne(
                { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
                { $set: { "scenes.$.mediaId": mediaDoc._id } }
              );
              results.push({ sceneNumber: scene.sceneNumber, status: "generated", videoUrl });
            } else {
              results.push({ sceneNumber: scene.sceneNumber, status: "fallback_image" });
            }
          } catch (clipErr) {
            console.error(`Gemini Omni generation failed for scene ${scene.sceneNumber}:`, clipErr.message);
            results.push({ sceneNumber: scene.sceneNumber, status: "error", error: clipErr.message });
          }
        })
      );
    }

    res.json({ message: "Gemini Omni 1.1 motion video clips generated for all scenes", results });
  } catch (err) {
    next(err);
  }
});

// 9a. List Configurable Video Resolution & Aspect Ratio Presets
storyVideoRouter.get("/video-presets", (req, res) => {
  res.json({ presets: VIDEO_PRESETS });
});

// 9b. Trigger FFmpeg Async Video Rendering Task
storyVideoRouter.post("/projects/:id/render", async (req, res, next) => {
  try {
    const { resolutionPreset = "1080p" } = req.body || {};
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

    processVideoRenderJob(job._id, project._id, mediaPaths, audioPath, { preset: resolutionPreset }).catch(err => {
      console.error("Background render error:", err);
    });

    res.status(202).json({
      jobId: job._id,
      message: "Video rendering task queued successfully",
      resolutionPreset
    });
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
