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
import { getStorageProvider, buildStoryStorageKey } from "../services/storage/index.js";
import { processVideoRenderJob, VIDEO_PRESETS, formatSrtTime, formatVttTime } from "../workers/index.js";
import { SUPPORTED_LANGUAGES, getLanguageConfig } from "../config/languages.js";

const upload = multer({ storage: multer.memoryStorage() });
export const storyVideoRouter = Router();

// Public Subtitle Streaming Routes (Used by HTML5 <track> & media players)
storyVideoRouter.get("/projects/:id/subtitles.vtt", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("activeStoryboardId activeSongId activeVideoId");

    if (!project) {
      return res.status(404).send("Project not found");
    }

    const video = project.activeVideoId;
    const storyboard = project.activeStoryboardId;
    const song = project.activeSongId;
    const totalDuration = video?.durationSeconds || song?.durationSeconds || 30;

    let scenes = storyboard?.scenes || [];
    let curTime = 0;
    const vttBlocks = ["WEBVTT\n"];

    if (scenes.length > 0) {
      const hasExplicit = scenes.every(s => typeof s.startTimeSeconds === "number" && typeof s.endTimeSeconds === "number" && s.endTimeSeconds > s.startTimeSeconds);
      let rawDurations = [];
      if (hasExplicit) {
        rawDurations = scenes.map(s => Math.max(1, s.endTimeSeconds - s.startTimeSeconds));
        const totalRaw = rawDurations.reduce((a, b) => a + b, 0);
        const ratio = totalDuration / totalRaw;
        rawDurations = rawDurations.map(d => Number((d * ratio).toFixed(2)));
      } else {
        const perScene = Number((totalDuration / scenes.length).toFixed(2));
        rawDurations = Array.from({ length: scenes.length }, () => perScene);
      }

      scenes.forEach((scene, i) => {
        const dur = rawDurations[i] || 5;
        const start = curTime;
        const end = curTime + dur;
        curTime = end;
        const text = scene.captionText || scene.lyricSnippet || `Scene ${scene.sceneNumber || i + 1}`;
        vttBlocks.push(`${i + 1}\n${formatVttTime(start)} --> ${formatVttTime(end)}\n${text}\n`);
      });
    }

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(vttBlocks.join("\n"));
  } catch (err) {
    next(err);
  }
});

storyVideoRouter.get("/projects/:id/subtitles.srt", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("activeStoryboardId activeSongId activeVideoId");

    if (!project) {
      return res.status(404).send("Project not found");
    }

    const video = project.activeVideoId;
    const storyboard = project.activeStoryboardId;
    const song = project.activeSongId;
    const totalDuration = video?.durationSeconds || song?.durationSeconds || 30;

    let scenes = storyboard?.scenes || [];
    let curTime = 0;
    const srtBlocks = [];

    if (scenes.length > 0) {
      const hasExplicit = scenes.every(s => typeof s.startTimeSeconds === "number" && typeof s.endTimeSeconds === "number" && s.endTimeSeconds > s.startTimeSeconds);
      let rawDurations = [];
      if (hasExplicit) {
        rawDurations = scenes.map(s => Math.max(1, s.endTimeSeconds - s.startTimeSeconds));
        const totalRaw = rawDurations.reduce((a, b) => a + b, 0);
        const ratio = totalDuration / totalRaw;
        rawDurations = rawDurations.map(d => Number((d * ratio).toFixed(2)));
      } else {
        const perScene = Number((totalDuration / scenes.length).toFixed(2));
        rawDurations = Array.from({ length: scenes.length }, () => perScene);
      }

      scenes.forEach((scene, i) => {
        const dur = rawDurations[i] || 5;
        const start = curTime;
        const end = curTime + dur;
        curTime = end;
        const text = scene.captionText || scene.lyricSnippet || `Scene ${scene.sceneNumber || i + 1}`;
        srtBlocks.push(`${i + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}\n`);
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Disposition", `attachment; filename="subtitles_${project._id}.srt"`);
    res.send(srtBlocks.join("\n"));
  } catch (err) {
    next(err);
  }
});

// Enforce ACL: Require authentication and require admin role (super_admin, admin, or event_admin)
storyVideoRouter.use(requireAuth);
storyVideoRouter.use(requireRole("admin"));

// 0. Get Supported Languages Catalog for AI Audio & Video
storyVideoRouter.get("/languages", (req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

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
    const { eventId, title, storyText, description, language, characters, directorGuidelines } = req.body;
    if (!eventId || !title || !storyText) {
      return res.status(400).json({ message: "eventId, title, and story text are required" });
    }

    const project = await Project.create({
      eventId,
      userId: req.user.id,
      title,
      description: description || "",
      storyText,
      language: language || "en",
      characters: Array.isArray(characters) ? characters : [],
      directorGuidelines: directorGuidelines || "",
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

// Update Project settings / language / characters / guidelines
storyVideoRouter.patch("/projects/:id", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const {
      language,
      title,
      description,
      storyText,
      voiceType,
      customVoicePrompt,
      customVoiceId,
      characters,
      directorGuidelines
    } = req.body;

    if (language !== undefined) project.language = language;
    if (title !== undefined) project.title = title;
    if (description !== undefined) project.description = description;
    if (storyText !== undefined) project.storyText = storyText;
    if (voiceType !== undefined) project.voiceType = voiceType;
    if (customVoicePrompt !== undefined) project.customVoicePrompt = customVoicePrompt;
    if (customVoiceId !== undefined) project.customVoiceId = customVoiceId;
    if (characters !== undefined) project.characters = characters;
    if (directorGuidelines !== undefined) project.directorGuidelines = directorGuidelines;

    await project.save();
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

    const { language } = req.body || {};
    if (language && project.language !== language) {
      project.language = language;
    }

    const analysisData = await analyzeStoryWithGemini(project.storyText, {
      language: project.language || "en"
    });

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
    const { genre, musicProvider, language, targetDuration, voiceType, customVoicePrompt, customVoiceId } = req.body;
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId");
    if (!project || !project.activeStoryAnalysisId) {
      return res.status(400).json({ message: "Project must be analyzed first" });
    }

    const effectiveLanguage = language || project.language || "en";
    if (language && project.language !== language) {
      project.language = language;
    }

    const effectiveVoiceType = voiceType || project.voiceType || "female";
    project.voiceType = effectiveVoiceType;
    if (customVoicePrompt !== undefined) project.customVoicePrompt = customVoicePrompt;
    if (customVoiceId !== undefined) project.customVoiceId = customVoiceId;

    const desiredDuration = Number(targetDuration) || 180;
    const targetGenre = genre || project.activeStoryAnalysisId.suggestedGenres?.[0] || "Pop";

    const lyricsText = await generateLyricsWithGemini(project.activeStoryAnalysisId.summary, targetGenre, {
      language: effectiveLanguage,
      targetDuration: desiredDuration
    });

    const providerToUse = musicProvider || "google_lyria";
    const musicEngine = getMusicProvider(providerToUse);

    const audioResult = await musicEngine.generateMusic({
      lyrics: lyricsText,
      genre: targetGenre,
      durationSeconds: desiredDuration,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      storyContext: project.storyText || project.activeStoryAnalysisId.summary || "",
      title: project.title || "",
      projectId: project._id,
      language: effectiveLanguage,
      voiceType: effectiveVoiceType,
      customVoicePrompt: customVoicePrompt || project.customVoicePrompt || "",
      customVoiceId: customVoiceId || project.customVoiceId || ""
    });

    const finalLyrics = audioResult.lyrics || lyricsText;

    const songDoc = await Song.create({
      projectId: project._id,
      lyrics: finalLyrics,
      genre: targetGenre,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      audioUrl: audioResult.audioUrl,
      durationSeconds: audioResult.durationSeconds || desiredDuration,
      provider: audioResult.provider || providerToUse,
      language: effectiveLanguage,
      voiceType: audioResult.voiceType || effectiveVoiceType,
      customVoicePrompt: customVoicePrompt || project.customVoicePrompt || "",
      customVoiceId: customVoiceId || project.customVoiceId || "",
      isFallback: Boolean(audioResult.isFallback),
      fallbackReason: audioResult.fallbackReason || "",
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
    const cleanOriginal = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const filename = `upload_${Date.now()}_${cleanOriginal}${ext}`;
    const storageKey = buildStoryStorageKey({
      projectId: project._id,
      title: project.title,
      category: "scenes/raw",
      filename
    });
    const fileUrl = await storage.uploadFile(req.file.buffer, storageKey, req.file.mimetype);

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
    const storyContext = project.storyText || project.activeStoryAnalysisId?.summary || project.description || project.title || "";

    console.log(`[API Storyboard] Generating synchronized storyboard from lyrics (${totalSongDuration}s, ~${targetSceneDuration}s/scene, lang=${project.language || project.activeSongId.language || "en"}, characters=${project.characters?.length || 0})...`);
    const generatedScenes = await generateStoryboardFromLyrics({
      storyContext,
      lyrics,
      totalDurationSeconds: totalSongDuration,
      targetSceneDuration: Number(targetSceneDuration) || 6,
      language: project.language || project.activeSongId.language || "en",
      characters: project.characters || [],
      directorGuidelines: project.directorGuidelines || ""
    });

    console.log(`[API Storyboard] Generated ${generatedScenes.length} synchronized scenes matching song lyrics.`);

    const scenes = [];

    // Map each generated scene to a media item or assign from project media
    for (let index = 0; index < generatedScenes.length; index++) {
      const sceneItem = generatedScenes[index];
      let media = mediaItems.length > 0 ? mediaItems[index % mediaItems.length] : null;

      // If project has no media at all, generate an initial frame for the first scene
      if (!media && index === 0 && sceneItem.visualIdea) {
        const generatedImageUrl = await generateSceneImageWithGemini(sceneItem.visualIdea, {
          projectId: project._id,
          title: project.title,
          sceneNumber: sceneItem.sceneNumber || 1
        });
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
        characters: sceneItem.characters || [],
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
    if (req.body.prompt) {
      scene.visualPrompt = req.body.prompt;
    }
    const sourceImageUrl = scene.mediaId?.fileUrl || null;

    console.log(`[API Story Video] Generating Gemini Omni 1.1 Flash video clip for Scene ${scene.sceneNumber}: "${promptText.slice(0, 60)}..."`);

    const videoEngine = getVideoProvider("google_omni");
    const videoUrl = await videoEngine.generateSceneVideoClip({
      imageUrl: sourceImageUrl,
      promptText,
      durationSeconds: 5,
      projectId: project._id,
      title: project.title,
      sceneNumber: scene.sceneNumber
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
      {
        $set: {
          "scenes.$.mediaId": mediaDoc._id,
          "scenes.$.visualPrompt": scene.visualPrompt
        }
      }
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

// 8c. Update an Individual Scene (visual prompt, caption, characters, mediaId)
storyVideoRouter.patch("/projects/:id/scenes/:sceneIndex", async (req, res, next) => {
  try {
    const { id, sceneIndex } = req.params;
    const { visualPrompt, captionText, characters, mediaId } = req.body;
    const project = await Project.findById(id).populate("activeStoryboardId");
    if (!project || !project.activeStoryboardId) {
      return res.status(400).json({ message: "Project must have a storyboard generated first" });
    }

    const idx = parseInt(sceneIndex, 10);
    const storyboard = project.activeStoryboardId;
    const scene = storyboard.scenes[idx];
    if (!scene) {
      return res.status(404).json({ message: `Scene at index ${sceneIndex} not found` });
    }

    const updateFields = {};
    if (visualPrompt !== undefined) {
      scene.visualPrompt = visualPrompt;
      updateFields["scenes.$.visualPrompt"] = visualPrompt;
    }
    if (captionText !== undefined) {
      scene.captionText = captionText;
      updateFields["scenes.$.captionText"] = captionText;
    }
    if (characters !== undefined) {
      scene.characters = characters;
      updateFields["scenes.$.characters"] = characters;
    }
    if (mediaId !== undefined) {
      scene.mediaId = mediaId || null;
      updateFields["scenes.$.mediaId"] = mediaId || null;
    }

    if (Object.keys(updateFields).length > 0) {
      await Storyboard.updateOne(
        { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
        { $set: updateFields }
      );
    }

    res.json({
      message: "Scene updated successfully",
      scene
    });
  } catch (err) {
    next(err);
  }
});

// 8d. Generate / Regenerate AI Image Frame for an Individual Scene
storyVideoRouter.post("/projects/:id/scenes/:sceneIndex/image", async (req, res, next) => {
  try {
    const { id, sceneIndex } = req.params;
    const project = await Project.findById(id).populate({
      path: "activeStoryboardId",
      populate: { path: "scenes.mediaId" }
    });

    if (!project || !project.activeStoryboardId) {
      return res.status(400).json({ message: "Project must have a storyboard generated first" });
    }

    const idx = parseInt(sceneIndex, 10);
    const storyboard = project.activeStoryboardId;
    const scene = storyboard.scenes[idx];
    if (!scene) {
      return res.status(404).json({ message: `Scene at index ${sceneIndex} not found` });
    }

    const promptText = req.body.prompt || scene.visualPrompt || scene.captionText || "Cinematic celebration scene";
    if (req.body.prompt && req.body.prompt !== scene.visualPrompt) {
      scene.visualPrompt = req.body.prompt;
    }

    console.log(`[API Scene Image] Generating AI frame for Scene ${scene.sceneNumber}: "${promptText.slice(0, 60)}..."`);
    const generatedImageUrl = await generateSceneImageWithGemini(promptText, {
      projectId: project._id,
      title: project.title,
      sceneNumber: scene.sceneNumber
    });

    if (!generatedImageUrl) {
      return res.status(500).json({ message: "Unable to generate image frame for this scene" });
    }

    const mediaDoc = await Media.create({
      projectId: project._id,
      fileUrl: generatedImageUrl,
      mediaType: "image",
      originalFilename: `scene_frame_${scene.sceneNumber}.jpg`,
      caption: promptText
    });

    scene.mediaId = mediaDoc._id;
    await Storyboard.updateOne(
      { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
      {
        $set: {
          "scenes.$.mediaId": mediaDoc._id,
          "scenes.$.visualPrompt": scene.visualPrompt
        }
      }
    );

    res.json({
      message: "Scene image frame generated successfully",
      sceneNumber: scene.sceneNumber,
      media: mediaDoc,
      imageUrl: generatedImageUrl
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
              durationSeconds: 5,
              projectId: project._id,
              title: project.title,
              sceneNumber: scene.sceneNumber
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
    const mediaUrls = mediaItems.map(item => item.fileUrl).filter(Boolean);

    let songDoc = project.activeSongId;
    if (!songDoc) {
      songDoc = await Song.findOne({ projectId: project._id }).sort({ createdAt: -1 });
    }

    const audioUrl = songDoc?.audioUrl || null;

    const job = await GenerationJob.create({
      projectId: project._id,
      jobType: "video_rendering",
      status: "queued"
    });

    project.status = "rendering";
    await project.save();

    processVideoRenderJob(job._id, project._id, mediaUrls, audioUrl, { preset: resolutionPreset }).catch(err => {
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
