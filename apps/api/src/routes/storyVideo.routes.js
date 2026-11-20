import { Router } from "express";
import multer from "multer";
import path from "path";
import { requireAuth, requireRole, requireEventAccess } from "../middleware/auth.js";
import { Project } from "../models/Project.js";
import { StoryAnalysis } from "../models/StoryAnalysis.js";
import { Song } from "../models/Song.js";
import { Media } from "../models/Media.js";
import { Storyboard, aspectRatioToSlotKey } from "../models/Storyboard.js";
import { Video } from "../models/Video.js";
import { GenerationJob } from "../models/GenerationJob.js";
import { Event } from "../models/Event.js";
import { EventAssignment } from "../models/EventAssignment.js";
import {
  analyzeStoryWithGemini,
  generateLyricsWithGemini,
  generateSceneImageWithGemini,
  generateStoryboardFromLyrics,
  analyzeAdBriefWithGemini,
  generateAdScriptWithGemini,
  generateAdStoryboard,
  formatSegmentsToTranscript
} from "../services/providers/gemini.provider.js";
import { getMusicProvider } from "../services/music/index.js";
import { composeAdvertisementAudio } from "../services/music/adAudioComposer.js";
import { getVideoProvider } from "../services/video/index.js";
import { getStorageProvider, buildStoryStorageKey } from "../services/storage/index.js";
import { processVideoRenderJob, VIDEO_PRESETS, formatSrtTime, formatVttTime, formatSceneSubtitleLine } from "../workers/index.js";
import { SUPPORTED_LANGUAGES, getLanguageConfig } from "../config/languages.js";
import { env } from "../config/env.js";

const upload = multer({ storage: multer.memoryStorage() });
export const storyVideoRouter = Router();

// Attach all saved rendered Video documents (across all aspect ratios & presets) onto Project payload(s)
async function attachRenderedVideosToProjects(projectOrList) {
  if (!projectOrList) return projectOrList;
  const isArray = Array.isArray(projectOrList);
  const list = isArray ? projectOrList : [projectOrList];
  if (list.length === 0) return projectOrList;

  const projectIds = list.map((p) => p?._id).filter(Boolean);
  const allVideos = await Video.find({ projectId: { $in: projectIds } })
    .sort({ createdAt: -1 })
    .lean();

  const videosByProject = new Map();
  for (const v of allVideos) {
    const key = String(v.projectId);
    if (!videosByProject.has(key)) videosByProject.set(key, []);
    videosByProject.get(key).push(v);
  }

  const enriched = list.map((proj) => {
    const plain = typeof proj.toObject === "function" ? proj.toObject() : { ...proj };
    plain.renderedVideos = videosByProject.get(String(plain._id)) || [];
    return plain;
  });

  return isArray ? enriched : enriched[0];
}

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

      const isAd = project.projectType === "ad_promo";
      scenes.forEach((scene, i) => {
        const dur = rawDurations[i] || 5;
        const start = curTime;
        const end = curTime + dur;
        curTime = end;
        const text = formatSceneSubtitleLine(scene, isAd, i);
        if (text) {
          vttBlocks.push(`${vttBlocks.length}\n${formatVttTime(start)} --> ${formatVttTime(end)}\n${text}\n`);
        }
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

      const isAd = project.projectType === "ad_promo";
      scenes.forEach((scene, i) => {
        const dur = rawDurations[i] || 5;
        const start = curTime;
        const end = curTime + dur;
        curTime = end;
        const text = formatSceneSubtitleLine(scene, isAd, i);
        if (text) {
          srtBlocks.push(`${srtBlocks.length + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}\n`);
        }
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

// 1. Get Projects for an Event OR Standalone Brand Workspace (scoped to company and event access)
storyVideoRouter.get("/projects", async (req, res, next) => {
  try {
    const { eventId, scope, projectType } = req.query;
    const userRole = req.user.role;
    const companyId = req.user.companyId;
    const isCompanyAdmin = ["super_admin", "owner", "co_owner", "admin"].includes(userRole);
    const isStandaloneQuery = eventId === "standalone" || scope === "standalone";

    let allowedEventIds = [];
    if (userRole === "super_admin") {
      // Super admin can see any event
    } else if (userRole === "owner" || userRole === "co_owner" || userRole === "admin") {
      const companyEvents = await Event.find({ companyId }).select("_id").lean();
      allowedEventIds = companyEvents.map((e) => e._id.toString());
    } else {
      const assignments = await EventAssignment.find({ userId: req.user.id }).select("eventId").lean();
      allowedEventIds = assignments.map((a) => a.eventId.toString());
    }

    const filter = {};
    if (projectType === "ad_promo") {
      filter.projectType = "ad_promo";
    } else if (projectType === "story_music") {
      filter.projectType = { $ne: "ad_promo" };
    }

    if (isStandaloneQuery) {
      if (!isCompanyAdmin) {
        return res.json([]);
      }
      filter.eventId = null;
      if (userRole !== "super_admin") {
        filter.companyId = companyId;
      }
    } else if (eventId) {
      if (userRole !== "super_admin" && !allowedEventIds.includes(eventId.toString())) {
        return res.status(403).json({ message: "Access denied to this event's storyboards" });
      }
      filter.eventId = eventId;
    } else if (userRole !== "super_admin") {
      if (isCompanyAdmin && companyId) {
        filter.$or = [
          { eventId: { $in: allowedEventIds } },
          { eventId: null, companyId }
        ];
      } else {
        filter.eventId = { $in: allowedEventIds };
      }
    }

    const projects = await Project.find(filter)
      .populate("activeStoryAnalysisId activeSongId activeStoryboardId activeVideoId")
      .sort({ updatedAt: -1 });

    const enrichedProjects = await attachRenderedVideosToProjects(projects);
    res.json(enrichedProjects);
  } catch (err) {
    next(err);
  }
});

// 2. Create a new AI Story or Short Advertisement Project (Event-linked OR Standalone Brand Ad)
storyVideoRouter.post("/projects", async (req, res, next) => {
  try {
    const {
      eventId: rawEventId,
      projectType = "story_music",
      title,
      storyText: rawStoryText,
      description,
      language,
      characters,
      directorGuidelines,
      adBrief
    } = req.body || {};

    const normalizedType = projectType === "ad_promo" ? "ad_promo" : "story_music";
    const isStandalone = !rawEventId || rawEventId === "standalone";

    if (!title) {
      return res.status(400).json({ message: "Project title is required" });
    }

    // For story_music, require storyText; for ad_promo, synthesize fallback brief text from adBrief if rawStoryText is empty
    const effectiveStoryText = (rawStoryText || "").trim() || (
      normalizedType === "ad_promo"
        ? [
            adBrief?.brandName ? `Brand/Campaign: ${adBrief.brandName}.` : `Campaign: ${title}.`,
            adBrief?.productOrOffer ? `Offer/Focus: ${adBrief.productOrOffer}.` : "",
            adBrief?.targetAudience ? `Target Audience: ${adBrief.targetAudience}.` : "",
            adBrief?.callToAction ? `Call to Action: ${adBrief.callToAction}.` : ""
          ].filter(Boolean).join(" ")
        : ""
    );

    if (!effectiveStoryText) {
      return res.status(400).json({ message: "Story narrative or advertisement brief is required" });
    }

    let resolvedEventId = null;
    let resolvedCompanyId = req.user.companyId || null;

    if (isStandalone) {
      const isCompanyAdmin = ["super_admin", "owner", "co_owner", "admin"].includes(req.user.role);
      if (!isCompanyAdmin) {
        return res.status(403).json({
          message: "Standalone brand/company projects require company admin permissions"
        });
      }
    } else {
      // Validate event access via existing middleware logic
      await new Promise((resolve, reject) => {
        requireEventAccess(["event_admin"])(req, res, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      if (res.headersSent) return;

      const eventDoc = await Event.findById(rawEventId).select("companyId").lean();
      if (!eventDoc) {
        return res.status(404).json({ message: "Event not found" });
      }
      resolvedEventId = rawEventId;
      resolvedCompanyId = eventDoc.companyId || resolvedCompanyId;
    }

    const projectPayload = {
      eventId: resolvedEventId,
      companyId: resolvedCompanyId,
      userId: req.user.id,
      projectType: normalizedType,
      title: title.trim(),
      description: description || "",
      storyText: effectiveStoryText,
      language: language || "en",
      characters: Array.isArray(characters) ? characters : [],
      directorGuidelines: directorGuidelines || "",
      status: "draft"
    };

    if (normalizedType === "ad_promo" && adBrief && typeof adBrief === "object") {
      projectPayload.adBrief = {
        brandName: adBrief.brandName || "",
        productOrOffer: adBrief.productOrOffer || "",
        objective: adBrief.objective || "",
        targetAudience: adBrief.targetAudience || "",
        callToAction: adBrief.callToAction || "",
        ctaSubtext: adBrief.ctaSubtext || "",
        burnInCtaOverlay: adBrief.burnInCtaOverlay !== false,
        targetDurationSeconds: Number(adBrief.targetDurationSeconds) || 30,
        audioMode: ["dialogue_only", "dialogue_bgm", "hybrid_conversation_song", "visual_only"].includes(adBrief.audioMode)
          ? adBrief.audioMode
          : "hybrid_conversation_song",
        speakerFormat: ["single_narrator", "two_speaker_chat", "multi_cast"].includes(adBrief.speakerFormat)
          ? adBrief.speakerFormat
          : "two_speaker_chat",
        bgmStyle: adBrief.bgmStyle || "Upbeat Commercial"
      };
    }

    const project = await Project.create(projectPayload);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// Enforce project-level company and event tenant isolation (supports both Event-linked and Standalone projects)
async function requireProjectAccess(req, res, next) {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (req.user && req.user.role !== "super_admin") {
      if (project.eventId) {
        const event = await Event.findById(project.eventId).select("companyId").lean();
        if (!event || (req.user.companyId && event.companyId && event.companyId.toString() !== req.user.companyId.toString())) {
          return res.status(403).json({ message: "Access denied: Project does not belong to your company" });
        }
        if (req.user.role === "event_admin" || req.user.role === "event_staff") {
          const assignment = await EventAssignment.findOne({ userId: req.user.id, eventId: event._id }).lean();
          if (!assignment) {
            return res.status(403).json({ message: "Access denied: You are not assigned to this project's event" });
          }
        }
      } else {
        // Standalone Brand / Company Project (no Event)
        const isCompanyAdmin = ["owner", "co_owner", "admin"].includes(req.user.role);
        if (!isCompanyAdmin) {
          return res.status(403).json({ message: "Access denied: Standalone brand projects require company admin role" });
        }
        if (project.companyId && req.user.companyId && project.companyId.toString() !== req.user.companyId.toString()) {
          return res.status(403).json({ message: "Access denied: Project does not belong to your company" });
        }
      }
    }
    req.project = project;
    return next();
  } catch (err) {
    return next(err);
  }
}

storyVideoRouter.use("/projects/:id", requireProjectAccess);

// 3. Get Details for a Specific Project
storyVideoRouter.get("/projects/:id", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("activeStoryAnalysisId activeSongId activeStoryboardId activeVideoId");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    const enrichedProject = await attachRenderedVideosToProjects(project);
    res.json(enrichedProject);
  } catch (err) {
    next(err);
  }
});

// 3b. List All Saved Rendered Videos for a Project (Preserves 9:16, 16:9, 1:1, 4:3, 1080p, 720p)
storyVideoRouter.get("/projects/:id/videos", async (req, res, next) => {
  try {
    const videos = await Video.find({ projectId: req.params.id }).sort({ createdAt: -1 });
    res.json(videos);
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
      directorGuidelines,
      adBrief
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
    if (adBrief && typeof adBrief === "object") {
      const currentBrief = project.adBrief ? (project.adBrief.toObject ? project.adBrief.toObject() : project.adBrief) : {};
      project.adBrief = { ...currentBrief, ...adBrief };
    }

    await project.save();
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// 4. Analyze Story Narrative OR Commercial Ad Brief with Gemini AI
storyVideoRouter.post("/projects/:id/analyze", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const { language, adBrief } = req.body || {};
    if (language && project.language !== language) {
      project.language = language;
    }
    if (adBrief && typeof adBrief === "object") {
      const currentBrief = project.adBrief ? (project.adBrief.toObject ? project.adBrief.toObject() : project.adBrief) : {};
      project.adBrief = { ...currentBrief, ...adBrief };
    }

    let analysisData;
    if (project.projectType === "ad_promo") {
      const eventContext = project.eventId
        ? await Event.findById(project.eventId).select("title date location description").lean()
        : null;
      analysisData = await analyzeAdBriefWithGemini(project.storyText, {
        language: project.language || "en",
        adBrief: project.adBrief || {},
        eventContext,
        directorGuidelines: project.directorGuidelines || "",
        characters: Array.isArray(project.characters) ? project.characters : []
      });
    } else {
      analysisData = await analyzeStoryWithGemini(project.storyText, {
        language: project.language || "en",
        directorGuidelines: project.directorGuidelines || "",
        characters: Array.isArray(project.characters) ? project.characters : []
      });
    }

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

// 5a. Generate Structured Ad Script Segments (Dialogue, Voiceover, Hybrid Jingle, or Visual Beats)
storyVideoRouter.post("/projects/:id/ad-script", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId activeSongId");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const {
      audioMode,
      speakerFormat,
      targetDurationSeconds,
      bgmStyle,
      language
    } = req.body || {};

    if (language && project.language !== language) {
      project.language = language;
    }

    const currentBrief = project.adBrief ? (project.adBrief.toObject ? project.adBrief.toObject() : project.adBrief) : {};
    const updatedBrief = {
      ...currentBrief,
      ...(audioMode ? { audioMode } : {}),
      ...(speakerFormat ? { speakerFormat } : {}),
      ...(targetDurationSeconds ? { targetDurationSeconds: Number(targetDurationSeconds) } : {}),
      ...(bgmStyle ? { bgmStyle } : {})
    };
    project.adBrief = updatedBrief;

    const eventContext = project.eventId
      ? await Event.findById(project.eventId).select("title date location description").lean()
      : null;

    const segments = await generateAdScriptWithGemini({
      storyText: project.storyText || "",
      adBrief: updatedBrief,
      analysis: project.activeStoryAnalysisId || null,
      eventContext,
      language: project.language || "en",
      characters: Array.isArray(project.characters) ? project.characters : [],
      directorGuidelines: project.directorGuidelines || ""
    });

    const effectiveMode = updatedBrief.audioMode || "hybrid_conversation_song";
    const transcript = formatSegmentsToTranscript(segments);

    const songDoc = await Song.create({
      projectId: project._id,
      trackMode: effectiveMode,
      lyrics: transcript,
      genre: updatedBrief.bgmStyle || "Upbeat Commercial",
      mood: project.activeStoryAnalysisId?.mood || "Energetic",
      audioUrl: "",
      durationSeconds: Number(updatedBrief.targetDurationSeconds) || 30,
      provider: "ad_script_draft",
      language: project.language || "en",
      voiceType: effectiveMode === "visual_only" ? "none" : "multi_speaker",
      scriptSegments: segments,
      status: "script_ready"
    });

    project.status = "script_generated";
    project.activeSongId = songDoc._id;
    await project.save();

    res.json(songDoc);
  } catch (err) {
    next(err);
  }
});

// 5b. Save User Edits to Ad Script Segments & Audio Settings
storyVideoRouter.patch("/projects/:id/ad-script", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeSongId");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const { scriptSegments, audioMode, speakerFormat, targetDurationSeconds, bgmStyle } = req.body || {};

    const currentBrief = project.adBrief ? (project.adBrief.toObject ? project.adBrief.toObject() : project.adBrief) : {};
    const updatedBrief = {
      ...currentBrief,
      ...(audioMode ? { audioMode } : {}),
      ...(speakerFormat ? { speakerFormat } : {}),
      ...(targetDurationSeconds ? { targetDurationSeconds: Number(targetDurationSeconds) } : {}),
      ...(bgmStyle ? { bgmStyle } : {})
    };
    project.adBrief = updatedBrief;

    let normalizedSegments = Array.isArray(scriptSegments) ? scriptSegments : (project.activeSongId?.scriptSegments || []);
    let cursor = 0;
    normalizedSegments = normalizedSegments.map((seg, idx) => {
      const dur = Math.max(1.5, Number(seg.targetDurationSeconds) || Number((seg.endTimeSeconds || 4) - (seg.startTimeSeconds || 0)) || 4);
      const start = Number(cursor.toFixed(2));
      cursor += dur;
      const end = Number(cursor.toFixed(2));
      return {
        segmentOrder: idx + 1,
        segmentType: seg.segmentType || "dialogue",
        speakerName: seg.speakerName || "Narrator",
        voiceRole: seg.voiceRole || "narrator",
        voiceGender: seg.voiceGender === "male" ? "male" : "female",
        text: seg.text || "",
        onScreenHeadline: seg.onScreenHeadline || "",
        targetDurationSeconds: dur,
        startTimeSeconds: start,
        endTimeSeconds: end,
        bgmBehavior: seg.bgmBehavior || (updatedBrief.audioMode === "dialogue_only" ? "none" : "ducked"),
        segmentAudioUrl: seg.segmentAudioUrl || ""
      };
    });

    const transcript = formatSegmentsToTranscript(normalizedSegments);
    const effectiveMode = updatedBrief.audioMode || "hybrid_conversation_song";

    let songDoc = project.activeSongId;
    if (songDoc) {
      songDoc.trackMode = effectiveMode;
      songDoc.scriptSegments = normalizedSegments;
      songDoc.lyrics = transcript;
      songDoc.genre = updatedBrief.bgmStyle || songDoc.genre || "Upbeat Commercial";
      songDoc.durationSeconds = Math.max(5, Math.round(cursor) || Number(updatedBrief.targetDurationSeconds) || 30);
      await songDoc.save();
    } else {
      songDoc = await Song.create({
        projectId: project._id,
        trackMode: effectiveMode,
        lyrics: transcript,
        genre: updatedBrief.bgmStyle || "Upbeat Commercial",
        mood: "Energetic",
        durationSeconds: Math.max(5, Math.round(cursor) || Number(updatedBrief.targetDurationSeconds) || 30),
        provider: "ad_script_draft",
        language: project.language || "en",
        voiceType: effectiveMode === "visual_only" ? "none" : "multi_speaker",
        scriptSegments: normalizedSegments,
        status: "script_ready"
      });
      project.activeSongId = songDoc._id;
    }

    await project.save();
    res.json(songDoc);
  } catch (err) {
    next(err);
  }
});

// 5c. Synthesize & Master Multi-Speaker / Hybrid Jingle Commercial Audio Track
storyVideoRouter.post("/projects/:id/ad-audio", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId activeSongId");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const {
      scriptSegments: bodySegments,
      audioMode,
      bgmStyle,
      musicProvider,
      language,
      targetDurationSeconds,
      includeVisualBgm = true
    } = req.body || {};

    const effectiveLanguage = language || project.language || "en";
    if (language && project.language !== language) {
      project.language = language;
    }

    const currentBrief = project.adBrief ? (project.adBrief.toObject ? project.adBrief.toObject() : project.adBrief) : {};
    const effectiveAudioMode = audioMode || currentBrief.audioMode || "hybrid_conversation_song";
    const effectiveBgmStyle = bgmStyle || currentBrief.bgmStyle || "Upbeat Commercial";
    const effectiveTargetSec = Number(targetDurationSeconds) || Number(currentBrief.targetDurationSeconds) || 30;
    const providerToUse = musicProvider || env.musicProvider || "google_lyria";

    project.adBrief = {
      ...currentBrief,
      audioMode: effectiveAudioMode,
      bgmStyle: effectiveBgmStyle,
      targetDurationSeconds: effectiveTargetSec
    };

    let segmentsToCompose = Array.isArray(bodySegments) && bodySegments.length > 0
      ? bodySegments
      : (project.activeSongId?.scriptSegments || []);

    // If user clicked Synthesize Audio directly before generating script segments, auto-generate script first!
    if (segmentsToCompose.length === 0) {
      const eventContext = project.eventId
        ? await Event.findById(project.eventId).select("title date location description").lean()
        : null;
      segmentsToCompose = await generateAdScriptWithGemini({
        storyText: project.storyText || "",
        adBrief: project.adBrief,
        analysis: project.activeStoryAnalysisId || null,
        eventContext,
        language: effectiveLanguage,
        characters: Array.isArray(project.characters) ? project.characters : [],
        directorGuidelines: project.directorGuidelines || ""
      });
    }

    const audioRes = await composeAdvertisementAudio({
      project,
      scriptSegments: segmentsToCompose,
      audioMode: effectiveAudioMode,
      bgmStyle: effectiveBgmStyle,
      musicProvider: providerToUse,
      language: effectiveLanguage,
      targetDurationSeconds: effectiveTargetSec,
      includeVisualBgm: Boolean(includeVisualBgm)
    });

    const transcript = formatSegmentsToTranscript(audioRes.scriptSegments);

    const songDoc = await Song.create({
      projectId: project._id,
      trackMode: effectiveAudioMode,
      lyrics: transcript,
      genre: effectiveBgmStyle,
      mood: project.activeStoryAnalysisId?.mood || "Energetic",
      audioUrl: audioRes.audioUrl,
      durationSeconds: audioRes.durationSeconds || effectiveTargetSec,
      provider: audioRes.provider || providerToUse,
      language: effectiveLanguage,
      voiceType: effectiveAudioMode === "visual_only" ? "none" : "multi_speaker",
      scriptSegments: audioRes.scriptSegments,
      isFallback: Boolean(audioRes.isFallback),
      fallbackReason: audioRes.fallbackReason || "",
      status: "ready"
    });

    project.status = "music_generated";
    project.activeSongId = songDoc._id;
    await project.save();

    res.json(songDoc);
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
      targetDuration: desiredDuration,
      storyText: project.storyText || "",
      directorGuidelines: project.directorGuidelines || "",
      characters: Array.isArray(project.characters) ? project.characters : []
    });

    const providerToUse = musicProvider || env.musicProvider || "google_lyria";
    const musicEngine = getMusicProvider(providerToUse);

    const audioResult = await musicEngine.generateMusic({
      lyrics: lyricsText,
      genre: targetGenre,
      durationSeconds: desiredDuration,
      mood: project.activeStoryAnalysisId.mood || "Upbeat",
      storyContext: project.storyText || project.activeStoryAnalysisId.summary || "",
      directorGuidelines: project.directorGuidelines || "",
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

// 8. Generate Scene Storyboard Mapping (Supports both Story Music Videos and Short Advertisement Videos)
storyVideoRouter.post("/projects/:id/storyboard", async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id).populate("activeStoryAnalysisId activeSongId activeStoryboardId");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isAdProject = project.projectType === "ad_promo";
    if (!isAdProject && !project.activeSongId) {
      return res.status(400).json({ message: "Project must have generated lyrics and song first" });
    }

    const { targetSceneDuration = isAdProject ? 4 : 6, aspectRatio } = req.body || {};
    const effectiveAspect = aspectRatio || (isAdProject ? "9:16" : "16:9");
    const slotKey = aspectRatioToSlotKey(effectiveAspect);
    const mediaItems = await Media.find({ projectId: project._id }).sort({ createdAt: 1 });
    const uploadedOnlyMedia = mediaItems.filter((m) => !m.aspectRatio && String(m.originalFilename || "").startsWith("upload_"));
    const aspectMatchingMedia = mediaItems.filter((m) => m.aspectRatio === effectiveAspect);
    const previousScenes = project.activeStoryboardId?.scenes || [];
    const storyContext = project.storyText || project.activeStoryAnalysisId?.summary || project.description || project.title || "";

    let generatedScenes = [];
    let totalDuration = project.activeSongId?.durationSeconds || (isAdProject ? Number(project.adBrief?.targetDurationSeconds) || 30 : 30);

    if (isAdProject) {
      const eventContext = project.eventId
        ? await Event.findById(project.eventId).select("title date location description").lean()
        : null;

      let scriptSegments = project.activeSongId?.scriptSegments || [];
      if (scriptSegments.length === 0) {
        scriptSegments = await generateAdScriptWithGemini({
          storyText: project.storyText || "",
          adBrief: project.adBrief || {},
          analysis: project.activeStoryAnalysisId || null,
          eventContext,
          language: project.language || "en",
          characters: project.characters || [],
          directorGuidelines: project.directorGuidelines || ""
        });
      }

      console.log(`[API Ad Storyboard] Generating commercial storyboard (${totalDuration}s, aspect=${effectiveAspect}, segments=${scriptSegments.length}, lang=${project.language || "en"})...`);
      generatedScenes = await generateAdStoryboard({
        storyContext,
        adBrief: project.adBrief || {},
        scriptSegments,
        totalDurationSeconds: totalDuration,
        language: project.language || "en",
        characters: project.characters || [],
        directorGuidelines: project.directorGuidelines || "",
        eventContext
      });
    } else {
      const lyrics = project.activeSongId.lyrics || "";
      console.log(`[API Storyboard] Generating synchronized storyboard from lyrics (${totalDuration}s, ~${targetSceneDuration}s/scene, aspect=${effectiveAspect}, lang=${project.language || project.activeSongId.language || "en"}, characters=${project.characters?.length || 0})...`);
      generatedScenes = await generateStoryboardFromLyrics({
        storyContext,
        lyrics,
        totalDurationSeconds: totalDuration,
        targetSceneDuration: Number(targetSceneDuration) || 6,
        language: project.language || project.activeSongId.language || "en",
        characters: project.characters || [],
        directorGuidelines: project.directorGuidelines || ""
      });
    }

    console.log(`[API Storyboard] Generated ${generatedScenes.length} synchronized scenes.`);

    const scenes = [];
    const defaultPool = uploadedOnlyMedia.length > 0 ? uploadedOnlyMedia : aspectMatchingMedia;

    // Map each generated scene to a media item while preserving any prior multi-aspect slots
    for (let index = 0; index < generatedScenes.length; index++) {
      const sceneItem = generatedScenes[index];
      const prevScene = previousScenes[index];
      const preservedAspects = prevScene?.mediaByAspect
        ? (typeof prevScene.mediaByAspect.toObject === "function"
            ? prevScene.mediaByAspect.toObject()
            : JSON.parse(JSON.stringify(prevScene.mediaByAspect)))
        : {
            portrait_9_16: {},
            landscape_16_9: {},
            square_1_1: {},
            tablet_4_3: {}
          };

      let media = defaultPool.length > 0 ? defaultPool[index % defaultPool.length] : null;

      // If project has no media for this aspect yet, generate an initial frame for the first scene
      if (!media && !preservedAspects[slotKey]?.activeMediaId && index === 0 && sceneItem.visualIdea) {
        const generatedImageUrl = await generateSceneImageWithGemini(sceneItem.visualIdea, {
          projectId: project._id,
          title: project.title,
          sceneNumber: sceneItem.sceneNumber || 1,
          aspectRatio: effectiveAspect
        });
        if (generatedImageUrl) {
          media = await Media.create({
            projectId: project._id,
            fileUrl: generatedImageUrl,
            mediaType: "image",
            aspectRatio: effectiveAspect,
            originalFilename: `scene_frame_${sceneItem.sceneNumber}_${effectiveAspect.replace(":", "x")}.jpg`,
            caption: sceneItem.visualIdea
          });
          mediaItems.push(media);
          preservedAspects[slotKey] = {
            ...(preservedAspects[slotKey] || {}),
            activeMediaId: media._id,
            imageMediaId: media._id
          };
        }
      } else if (media && !preservedAspects[slotKey]?.activeMediaId) {
        preservedAspects[slotKey] = {
          ...(preservedAspects[slotKey] || {}),
          activeMediaId: media._id,
          ...(media.mediaType === "video" ? { videoMediaId: media._id } : { imageMediaId: media._id })
        };
      }

      scenes.push({
        sceneNumber: sceneItem.sceneNumber || index + 1,
        startTimeSeconds: sceneItem.startTimeSeconds,
        endTimeSeconds: sceneItem.endTimeSeconds,
        mediaId: prevScene?.mediaId || media?._id || null,
        mediaByAspect: preservedAspects,
        segmentType: sceneItem.segmentType || (isAdProject ? "dialogue" : "song"),
        speakerName: sceneItem.speakerName || "",
        onScreenHeadline: sceneItem.onScreenHeadline || "",
        captionText: sceneItem.lyricSnippet || sceneItem.onScreenHeadline || sceneItem.visualIdea || `Scene ${index + 1}`,
        lyricSnippet: sceneItem.lyricSnippet || "",
        visualPrompt: sceneItem.visualIdea || "",
        characters: sceneItem.characters || [],
        transitionEffect: "fade"
      });
    }

    const storyboardDoc = await Storyboard.create({
      projectId: project._id,
      songId: project.activeSongId?._id || null,
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

// 8b. Generate Google Veo / Gemini Omni AI Motion Video Clip for an Individual Scene (Aspect-Ratio Preserved)
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

    const targetAspect = req.body?.aspectRatio || (project.projectType === "ad_promo" ? "9:16" : "16:9");
    const slotKey = aspectRatioToSlotKey(targetAspect);
    const aspectTag = targetAspect.replace(":", "x");

    const promptText = req.body?.prompt || scene.visualPrompt || scene.captionText || "Cinematic celebratory scene with lively motion and atmospheric lighting";
    if (req.body?.prompt) {
      scene.visualPrompt = req.body.prompt;
    }

    // Prefer a reference image matching the target aspect ratio (or user-uploaded photo) so a 16:9 frame never forces a 9:16 clip into landscape
    let sourceImageUrl = null;
    const slotImageId = scene.mediaByAspect?.[slotKey]?.imageMediaId || scene.mediaByAspect?.[slotKey]?.activeMediaId;
    if (slotImageId) {
      const slotMediaDoc = await Media.findById(slotImageId).lean();
      if (slotMediaDoc && slotMediaDoc.mediaType === "image") {
        sourceImageUrl = slotMediaDoc.fileUrl;
      }
    }
    if (!sourceImageUrl && scene.mediaId?.fileUrl && scene.mediaId?.mediaType === "image") {
      if (!scene.mediaId.aspectRatio || scene.mediaId.aspectRatio === targetAspect) {
        sourceImageUrl = scene.mediaId.fileUrl;
      }
    }

    const sceneClipDuration = Math.max(
      2,
      Math.round((Number(scene.endTimeSeconds) || 5) - (Number(scene.startTimeSeconds) || 0))
    );

    console.log(`[API Story Video] Generating ${targetAspect} (${sceneClipDuration}s) Gemini Omni 1.1 Flash video clip for Scene ${scene.sceneNumber}: "${promptText.slice(0, 60)}..."`);

    const videoEngine = getVideoProvider(req.body?.videoProvider);
    const videoUrl = await videoEngine.generateSceneVideoClip({
      imageUrl: sourceImageUrl,
      promptText,
      durationSeconds: sceneClipDuration,
      aspectRatio: targetAspect,
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
      aspectRatio: targetAspect,
      originalFilename: `omni_scene_${scene.sceneNumber}_${aspectTag}.mp4`,
      durationSeconds: sceneClipDuration
    });

    const setUpdate = {
      [`scenes.$.mediaByAspect.${slotKey}.videoMediaId`]: mediaDoc._id,
      [`scenes.$.mediaByAspect.${slotKey}.activeMediaId`]: mediaDoc._id,
      "scenes.$.visualPrompt": scene.visualPrompt
    };
    if (!scene.mediaId) {
      setUpdate["scenes.$.mediaId"] = mediaDoc._id;
    }

    await Storyboard.updateOne(
      { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
      { $set: setUpdate }
    );

    res.json({
      message: `Google Gemini Omni 1.1 (${targetAspect}) motion video clip generated successfully`,
      sceneNumber: scene.sceneNumber,
      aspectRatio: targetAspect,
      media: mediaDoc,
      videoUrl
    });
  } catch (err) {
    next(err);
  }
});

// 8c. Update an Individual Scene (visual prompt, caption, characters, mediaId per aspectRatio)
storyVideoRouter.patch("/projects/:id/scenes/:sceneIndex", async (req, res, next) => {
  try {
    const { id, sceneIndex } = req.params;
    const { visualPrompt, captionText, characters, mediaId, aspectRatio, onScreenHeadline, speakerName, segmentType } = req.body;
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
    if (onScreenHeadline !== undefined) {
      scene.onScreenHeadline = onScreenHeadline;
      updateFields["scenes.$.onScreenHeadline"] = onScreenHeadline;
    }
    if (speakerName !== undefined) {
      scene.speakerName = speakerName;
      updateFields["scenes.$.speakerName"] = speakerName;
    }
    if (segmentType !== undefined) {
      scene.segmentType = segmentType;
      updateFields["scenes.$.segmentType"] = segmentType;
    }
    if (characters !== undefined) {
      scene.characters = characters;
      updateFields["scenes.$.characters"] = characters;
    }
    if (mediaId !== undefined) {
      if (aspectRatio) {
        const slotKey = aspectRatioToSlotKey(aspectRatio);
        updateFields[`scenes.$.mediaByAspect.${slotKey}.activeMediaId`] = mediaId || null;
      } else {
        scene.mediaId = mediaId || null;
        updateFields["scenes.$.mediaId"] = mediaId || null;
      }
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

// 8d. Generate / Regenerate AI Image Frame for an Individual Scene (Saved per Aspect Ratio — Never Overrides Other Aspects)
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

    const targetAspect = req.body?.aspectRatio || (project.projectType === "ad_promo" ? "9:16" : "16:9");
    const slotKey = aspectRatioToSlotKey(targetAspect);
    const aspectTag = targetAspect.replace(":", "x");

    const promptText = req.body?.prompt || scene.visualPrompt || scene.captionText || "Cinematic celebration scene";
    if (req.body?.prompt && req.body.prompt !== scene.visualPrompt) {
      scene.visualPrompt = req.body.prompt;
    }

    console.log(`[API Scene Image] Generating ${targetAspect} AI frame for Scene ${scene.sceneNumber}: "${promptText.slice(0, 60)}..."`);
    const generatedImageUrl = await generateSceneImageWithGemini(promptText, {
      projectId: project._id,
      title: project.title,
      sceneNumber: scene.sceneNumber,
      aspectRatio: targetAspect
    });

    if (!generatedImageUrl) {
      return res.status(500).json({ message: "Unable to generate image frame for this scene" });
    }

    const mimeType = generatedImageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
    const mediaDoc = await Media.create({
      projectId: project._id,
      fileUrl: generatedImageUrl,
      mediaType: "image",
      aspectRatio: targetAspect,
      originalFilename: `scene_frame_${scene.sceneNumber}_${aspectTag}.${mimeType.includes("png") ? "png" : "jpg"}`,
      caption: promptText
    });

    const setUpdate = {
      [`scenes.$.mediaByAspect.${slotKey}.imageMediaId`]: mediaDoc._id,
      [`scenes.$.mediaByAspect.${slotKey}.activeMediaId`]: mediaDoc._id,
      "scenes.$.visualPrompt": scene.visualPrompt
    };
    if (!scene.mediaId) {
      setUpdate["scenes.$.mediaId"] = mediaDoc._id;
    }

    await Storyboard.updateOne(
      { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
      { $set: setUpdate }
    );

    res.json({
      message: `Scene ${targetAspect} image frame generated successfully`,
      sceneNumber: scene.sceneNumber,
      aspectRatio: targetAspect,
      media: mediaDoc,
      imageUrl: generatedImageUrl
    });
  } catch (err) {
    next(err);
  }
});

// 8e. Generate High-Definition Google AI Images for ALL Scenes (Saved into Selected Aspect Ratio Slot — Other Aspect Ratios Untouched)
storyVideoRouter.post("/projects/:id/scenes/generate-all-images", async (req, res, next) => {
  try {
    const { id } = req.params;
    const project = await Project.findById(id).populate({
      path: "activeStoryboardId",
      populate: { path: "scenes.mediaId" }
    });

    if (!project || !project.activeStoryboardId) {
      return res.status(400).json({ message: "Project must have a storyboard generated first" });
    }

    const { overwrite = false, aspectRatio } = req.body || {};
    const targetAspect = aspectRatio || (project.projectType === "ad_promo" ? "9:16" : "16:9");
    const slotKey = aspectRatioToSlotKey(targetAspect);
    const aspectTag = targetAspect.replace(":", "x");

    const storyboard = project.activeStoryboardId;
    let generatedCount = 0;

    for (let idx = 0; idx < storyboard.scenes.length; idx++) {
      const scene = storyboard.scenes[idx];
      const existingSlot = scene.mediaByAspect?.[slotKey];
      // Skip only if THIS aspect ratio already has a dedicated image and overwrite is false
      if (existingSlot?.imageMediaId && !overwrite) {
        continue;
      }

      const promptText = scene.visualPrompt || scene.captionText || `Cinematic moment ${scene.sceneNumber}`;
      console.log(`[API Generate All Images] Generating ${targetAspect} scene ${scene.sceneNumber}/${storyboard.scenes.length}: "${promptText.slice(0, 50)}..."`);

      const generatedImageUrl = await generateSceneImageWithGemini(promptText, {
        projectId: project._id,
        title: project.title,
        sceneNumber: scene.sceneNumber,
        aspectRatio: targetAspect
      });

      if (generatedImageUrl) {
        const mimeType = generatedImageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
        const mediaDoc = await Media.create({
          projectId: project._id,
          fileUrl: generatedImageUrl,
          mediaType: "image",
          aspectRatio: targetAspect,
          originalFilename: `scene_frame_${scene.sceneNumber}_${aspectTag}.${mimeType.includes("png") ? "png" : "jpg"}`,
          caption: promptText
        });

        const setUpdate = {
          [`scenes.$.mediaByAspect.${slotKey}.imageMediaId`]: mediaDoc._id,
          [`scenes.$.mediaByAspect.${slotKey}.activeMediaId`]: mediaDoc._id
        };
        if (!scene.mediaId) {
          setUpdate["scenes.$.mediaId"] = mediaDoc._id;
        }

        await Storyboard.updateOne(
          { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
          { $set: setUpdate }
        );
        generatedCount++;
      }
    }

    const refreshed = await Project.findById(id).populate({
      path: "activeStoryboardId",
      populate: { path: "scenes.mediaId" }
    });

    res.json({
      message: `Successfully generated ${targetAspect} Google AI images for ${generatedCount} scene(s) (other aspect ratios preserved)`,
      aspectRatio: targetAspect,
      generatedCount,
      storyboard: refreshed.activeStoryboardId
    });
  } catch (err) {
    next(err);
  }
});

// 8f. Generate Google Gemini Omni 1.1 AI Motion Video Clips for All Scenes (Saved into Selected Aspect Ratio Slot — Other Aspect Ratios Untouched)
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

    const targetAspect = req.body?.aspectRatio || (project.projectType === "ad_promo" ? "9:16" : "16:9");
    const overwrite = Boolean(req.body?.overwrite);
    const slotKey = aspectRatioToSlotKey(targetAspect);
    const aspectTag = targetAspect.replace(":", "x");

    const storyboard = project.activeStoryboardId;
    const allMedia = await Media.find({ projectId: project._id }).lean();
    const mediaById = new Map(allMedia.map((m) => [String(m._id), m]));
    const videoEngine = getVideoProvider(req.body?.videoProvider);
    const results = [];

    const scenesToProcess = [];
    for (let i = 0; i < storyboard.scenes.length; i++) {
      const scene = storyboard.scenes[i];
      const existingVideoId = scene.mediaByAspect?.[slotKey]?.videoMediaId;
      const existingVideoDoc = existingVideoId ? mediaById.get(String(existingVideoId)) : null;
      if (!overwrite && existingVideoDoc?.mediaType === "video" && existingVideoDoc?.fileUrl?.endsWith(".mp4")) {
        results.push({ sceneNumber: scene.sceneNumber, status: "already_video", aspectRatio: targetAspect, videoUrl: existingVideoDoc.fileUrl });
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
          let sourceImageUrl = null;
          const slotImgId = scene.mediaByAspect?.[slotKey]?.imageMediaId || scene.mediaByAspect?.[slotKey]?.activeMediaId;
          const slotImgDoc = slotImgId ? mediaById.get(String(slotImgId)) : null;
          if (slotImgDoc && slotImgDoc.mediaType === "image") {
            sourceImageUrl = slotImgDoc.fileUrl;
          } else if (scene.mediaId?.fileUrl && scene.mediaId?.mediaType === "image") {
            if (!scene.mediaId.aspectRatio || scene.mediaId.aspectRatio === targetAspect) {
              sourceImageUrl = scene.mediaId.fileUrl;
            }
          }

          const sceneClipDuration = Math.max(
            2,
            Math.round((Number(scene.endTimeSeconds) || 5) - (Number(scene.startTimeSeconds) || 0))
          );

          try {
            console.log(`[API Story Video] Generating ${targetAspect} (${sceneClipDuration}s) scene ${scene.sceneNumber}/${storyboard.scenes.length} with Gemini Omni 1.1 Flash: "${promptText.slice(0, 50)}..."`);
            const videoUrl = await videoEngine.generateSceneVideoClip({
              imageUrl: sourceImageUrl,
              promptText,
              durationSeconds: sceneClipDuration,
              aspectRatio: targetAspect,
              projectId: project._id,
              title: project.title,
              sceneNumber: scene.sceneNumber
            });

            if (videoUrl && videoUrl.endsWith(".mp4")) {
              const mediaDoc = await Media.create({
                projectId: project._id,
                fileUrl: videoUrl,
                mediaType: "video",
                aspectRatio: targetAspect,
                originalFilename: `omni_scene_${scene.sceneNumber}_${aspectTag}.mp4`,
                durationSeconds: sceneClipDuration
              });

              const setUpdate = {
                [`scenes.$.mediaByAspect.${slotKey}.videoMediaId`]: mediaDoc._id,
                [`scenes.$.mediaByAspect.${slotKey}.activeMediaId`]: mediaDoc._id
              };
              if (!scene.mediaId) {
                setUpdate["scenes.$.mediaId"] = mediaDoc._id;
              }

              await Storyboard.updateOne(
                { _id: storyboard._id, "scenes.sceneNumber": scene.sceneNumber },
                { $set: setUpdate }
              );
              results.push({ sceneNumber: scene.sceneNumber, status: "generated", aspectRatio: targetAspect, videoUrl });
            } else {
              results.push({ sceneNumber: scene.sceneNumber, status: "fallback_image", aspectRatio: targetAspect });
            }
          } catch (clipErr) {
            console.error(`Gemini Omni generation failed for scene ${scene.sceneNumber}:`, clipErr.message);
            results.push({ sceneNumber: scene.sceneNumber, status: "error", error: clipErr.message });
          }
        })
      );
    }

    res.json({
      message: `Gemini Omni 1.1 (${targetAspect}) motion video clips generated for ${scenesToProcess.length} scene(s) (other aspect ratios preserved)`,
      aspectRatio: targetAspect,
      results
    });
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
