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
import { createSilentStereoWavBuffer } from "../services/music/adAudioComposer.js";
import { uploadAssetBuffer, buildStoryStorageKey } from "../services/storage/index.js";

const activeFfmpegPath = process.env.FFMPEG_PATH || (fsSync.existsSync("/usr/bin/ffmpeg") ? "/usr/bin/ffmpeg" : (fsSync.existsSync("/usr/local/bin/ffmpeg") ? "/usr/local/bin/ffmpeg" : ffmpegInstaller));
ffmpeg.setFfmpegPath(activeFfmpegPath);

// Helper to convert seconds into SRT timecode format (00:00:05,000)
export function formatSrtTime(secondsTotal) {
  const hrs = Math.floor(secondsTotal / 3600);
  const mins = Math.floor((secondsTotal % 3600) / 60);
  const secs = Math.floor(secondsTotal % 60);
  const millis = Math.floor((secondsTotal % 1) * 1000);

  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

// Helper to convert seconds into WebVTT timecode format (00:00:05.000)
export function formatVttTime(secondsTotal) {
  const hrs = Math.floor(secondsTotal / 3600);
  const mins = Math.floor((secondsTotal % 3600) / 60);
  const secs = Math.floor(secondsTotal % 60);
  const millis = Math.floor((secondsTotal % 1) * 1000);

  const pad = (n, z = 2) => String(n).padStart(z, "0");
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
}

// Helper to format speaker-aware / jingle-aware subtitle lines for Ad & Story scenes
export function formatSceneSubtitleLine(scene, isAdProject = false, fallbackIndex = 0) {
  if (!isAdProject) {
    return scene.captionText || scene.lyricSnippet || `Scene ${scene.sceneNumber || fallbackIndex + 1}`;
  }
  const segType = scene.segmentType || "dialogue";
  const rawLine = (scene.lyricSnippet || scene.captionText || "").trim();
  if (segType === "visual_beat") {
    return (scene.onScreenHeadline || rawLine || "").trim();
  }
  if (!rawLine) {
    return (scene.onScreenHeadline || "").trim();
  }
  if (segType === "sung_jingle") {
    return rawLine.startsWith("♪") ? rawLine : `♪ ${rawLine} ♪`;
  }
  const speaker = (scene.speakerName || "").trim();
  if (speaker && !["narrator", "announcer", "on-screen text", "brand jingle"].includes(speaker.toLowerCase())) {
    return rawLine.toLowerCase().startsWith(`${speaker.toLowerCase()}:`) ? rawLine : `${speaker}: ${rawLine}`;
  }
  return rawLine;
}

// Build a libass (.ass) commercial headline / CTA banner file for burned-in ad overlays
async function writeAdHeadlineAssFile(assPath, { width, height, duration, headline = "", subtext = "", isEndCard = false }) {
  const cleanHeadline = String(headline || "").replace(/[\r\n{}]/g, " ").trim();
  const cleanSubtext = String(subtext || "").replace(/[\r\n{}]/g, " ").trim();
  if (!cleanHeadline) return false;

  const hrs = Math.floor(duration / 3600);
  const mins = Math.floor((duration % 3600) / 60);
  const secs = (duration % 60).toFixed(2).padStart(5, "0");
  const endAssTime = `${hrs}:${String(mins).padStart(2, "0")}:${secs}`;

  const baseScale = Math.min(width, height);
  const titleFontSize = Math.max(28, Math.round(baseScale * (isEndCard ? 0.046 : 0.038)));
  const subFontSize = Math.max(20, Math.round(baseScale * 0.028));
  const marginV = Math.max(60, Math.round(height * (isEndCard ? 0.14 : 0.10)));
  const marginH = Math.max(36, Math.round(width * 0.06));

  // ASS colors use &HAABBGGRR (Deep Indigo #34206F => BGR 6F2034)
  const dialogueText = isEndCard && cleanSubtext
    ? `${cleanHeadline}\\N{\\fs${subFontSize}\\b0}${cleanSubtext}`
    : cleanHeadline;

  const assBody = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: AdBanner,Sans,${titleFontSize},&H00FFFFFF,&H00FFFFFF,&H306F2034,&H406F2034,-1,0,0,0,100,100,0.5,0,3,16,0,2,${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,${endAssTime},AdBanner,,0,0,0,,${dialogueText}
`;
  await fs.writeFile(assPath, assBody, "utf8");
  return true;
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

  // If it references /uploads/ on local server or file already exists locally in uploads/
  if (fileUrlOrPath.includes("/uploads/")) {
    const relPart = fileUrlOrPath.split("/uploads/")[1];
    if (relPart) {
      const localPath = path.join(process.cwd(), "uploads", relPart);
      if (fsSync.existsSync(localPath)) {
        return localPath;
      }
    }
    const filename = path.basename(fileUrlOrPath);
    const fallbackPath = path.join(process.cwd(), "uploads", filename);
    if (fsSync.existsSync(fallbackPath)) {
      return fallbackPath;
    }
  }

  // Check if file with same basename is already cached in uploads/
  const baseFilename = path.basename(fileUrlOrPath.split("?")[0]);
  if (baseFilename) {
    const localUploadsPath = path.join(process.cwd(), "uploads", baseFilename);
    if (fsSync.existsSync(localUploadsPath)) {
      try {
        if (fsSync.statSync(localUploadsPath).size > 0) {
          return localUploadsPath;
        }
      } catch {}
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

    // Fetch Song Document for Exact Song / Ad Audio Duration
    const projectDoc = await Project.findById(projectId).populate("activeSongId activeStoryboardId");
    const isAdProject = projectDoc?.projectType === "ad_promo";
    let songDoc = projectDoc?.activeSongId;
    if (!songDoc) {
      songDoc = await Song.findOne({ projectId }).sort({ createdAt: -1 });
    }

    const effectiveAudioMode = songDoc?.trackMode && songDoc.trackMode !== "song"
      ? songDoc.trackMode
      : (isAdProject ? (projectDoc?.adBrief?.audioMode || "hybrid_conversation_song") : "song");

    const targetSongDuration =
      songDoc?.durationSeconds ||
      (isAdProject ? Number(projectDoc?.adBrief?.targetDurationSeconds) || 30 : 30);

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
      const sceneCount = Math.max(isAdProject ? 3 : 4, mediaDocs.length);
      rawScenes = Array.from({ length: sceneCount }).map((_, i) => ({
        sceneNumber: i + 1,
        captionText: isAdProject ? (projectDoc?.adBrief?.brandName || `Ad Scene ${i + 1}`) : `Event Scene ${i + 1}`,
        onScreenHeadline: isAdProject && i === sceneCount - 1 ? (projectDoc?.adBrief?.callToAction || "") : "",
        mediaId: mediaDocs[i % Math.max(1, mediaDocs.length)] || null
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

      if ((!mediaDoc || !mediaDoc.fileUrl) && mediaDocs.length > 0) {
        mediaDoc = mediaDocs[idx % mediaDocs.length];
      }

      let imgPath = null;
      if (mediaDoc?.fileUrl) {
        imgPath = await ensureLocalFile(mediaDoc.fileUrl, uploadDir, `scene_${idx}`, tempFilesToClean);
      }

      scenesToRender.push({
        sceneNumber: scene.sceneNumber || idx + 1,
        duration: Math.max(1, rawDurations[idx] || 5),
        segmentType: scene.segmentType || (isAdProject ? "dialogue" : "song"),
        speakerName: scene.speakerName || "",
        onScreenHeadline: scene.onScreenHeadline || (isAdProject && idx === rawScenes.length - 1 ? (projectDoc?.adBrief?.callToAction || "") : ""),
        captionText: formatSceneSubtitleLine(scene, isAdProject, idx),
        imgPath
      });
    }

    // Ensure fallback cover image if no media images exist
    const fallbackBmpPath = path.join(uploadDir, "fallback_cover.bmp");
    let hasFallbackCreated = false;

    for (const scene of scenesToRender) {
      if (!scene.imgPath) {
        if (!hasFallbackCreated) {
          const bmpBuffer = createSolidBmpBuffer(800, 600, isAdProject ? "34206F" : "0A2D59");
          await fs.writeFile(fallbackBmpPath, bmpBuffer);
          hasFallbackCreated = true;
          tempFilesToClean.push(fallbackBmpPath);
        }
        scene.imgPath = fallbackBmpPath;
      }
    }

    // Determine audio track path - always localize remote URLs before passing to FFmpeg
    let effectiveAudioPath = null;
    const rawAudioSource = audioPath || songDoc?.audioUrl;
    if (rawAudioSource) {
      effectiveAudioPath = await ensureLocalFile(rawAudioSource, uploadDir, "song_audio", tempFilesToClean);
    }
    if (!effectiveAudioPath) {
      const fallbackWavPath = path.join(uploadDir, `fallback_audio_${timestamp}.wav`);
      // Respect "No Song" modes (dialogue_only / visual_only) — never inject synthetic melody when user chose no song!
      const wavBuffer = (effectiveAudioMode === "dialogue_only" || effectiveAudioMode === "visual_only")
        ? createSilentStereoWavBuffer(targetSongDuration, 44100)
        : createMusicalMelodyWavBuffer(targetSongDuration, 44100, songDoc?.genre || "Pop");
      await fs.writeFile(fallbackWavPath, wavBuffer);
      effectiveAudioPath = fallbackWavPath;
      tempFilesToClean.push(fallbackWavPath);
    }

    console.log("[Video Worker] Target duration:", targetSongDuration, "mode:", effectiveAudioMode);
    console.log("[Video Worker] scenesToRender count:", scenesToRender.length);

    // Detect if running on Render Free Tier or resource-constrained environment
    const isConstrained = Boolean(process.env.RENDER || env.nodeEnv === "production");
    const burnInAdOverlay = Boolean(isAdProject && projectDoc?.adBrief?.burnInCtaOverlay !== false);

    // Render standardized scene MP4 segments matching the selected resolution preset
    const segmentPaths = [];
    for (let index = 0; index < scenesToRender.length; index++) {
      const scene = scenesToRender[index];
      const segPath = path.join(uploadDir, `seg_${timestamp}_${index}.mp4`);
      const srcPath = scene.imgPath;
      const isVideo = [".mp4", ".webm", ".mov", ".mkv", ".avi"].includes(path.extname(srcPath || "").toLowerCase());
      const isFinalScene = index === scenesToRender.length - 1;

      console.log(`[Video Worker] Rendering segment ${index} (${preset.width}x${preset.height}): isVideo=${isVideo}, duration=${scene.duration}`);

      let assOverlayPath = null;
      if (burnInAdOverlay && (isFinalScene || scene.segmentType === "visual_beat" || scene.segmentType === "cta_endcard") && scene.onScreenHeadline) {
        const candidateAss = path.join(uploadDir, `ad_banner_${timestamp}_${index}.ass`);
        const wroteAss = await writeAdHeadlineAssFile(candidateAss, {
          width: preset.width,
          height: preset.height,
          duration: scene.duration,
          headline: scene.onScreenHeadline,
          subtext: isFinalScene ? (projectDoc?.adBrief?.ctaSubtext || "") : "",
          isEndCard: isFinalScene
        }).catch(() => false);
        if (wroteAss) {
          assOverlayPath = candidateAss;
          tempFilesToClean.push(candidateAss);
        }
      }

      const renderSegmentPass = (withAss = true) => new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        if (isVideo) {
          cmd.input(srcPath).inputOptions(["-stream_loop", "-1", "-t", String(scene.duration)]);
        } else {
          cmd.input(srcPath).inputOptions(["-loop", "1", "-t", String(scene.duration)]);
        }

        const baseScaleCrop = `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=increase,crop=${preset.width}:${preset.height}`;
        const safeAssFilter = withAss && assOverlayPath
          ? `,ass=${assOverlayPath.replace(/\\/g, "/").replace(/:/g, "\\:")}`
          : "";
        const vfChain = `${baseScaleCrop}${safeAssFilter},format=yuv420p`;

        const segOutputOpts = [
          "-vf", vfChain,
          "-r", "25",
          "-an",
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-threads", isConstrained ? "1" : "2"
        ];

        cmd.outputOptions(segOutputOpts)
          .save(segPath)
          .on("end", resolve)
          .on("error", (err) => {
            console.error(`Segment ${index} render error (withAss=${withAss}):`, err.message);
            reject(err);
          });
      });

      try {
        await renderSegmentPass(Boolean(assOverlayPath));
      } catch (segErr) {
        if (assOverlayPath) {
          await fs.unlink(segPath).catch(() => {});
          await renderSegmentPass(false);
        } else {
          throw segErr;
        }
      }

      segmentPaths.push(segPath);
    }

    // Verify all segment files exist, are readable, and non-empty
    for (let i = 0; i < segmentPaths.length; i++) {
      const seg = segmentPaths[i];
      const stats = await fs.stat(seg).catch(() => null);
      if (!stats || stats.size === 0) {
        throw new Error(`Rendered segment ${i} is missing or empty (${seg})`);
      }
    }

    // Brief sync buffer ensuring OS disk write descriptors are fully flushed
    await new Promise((resolve) => setTimeout(resolve, 500));

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
    await dbJob.save().catch(() => {});

    // Dual-strategy stitch:
    // 1. Primary: Ultrafast stream copy (-c:v copy) - 10x faster, zero re-encoding memory overhead, immune to multi-threaded CPU segfaults
    // 2. Fallback: Safe re-encode with capped threads (threads=2) if stream copy encounters any container edge cases
    const runStitch = (useStreamCopy = true) => {
      const stitchCmd = ffmpeg()
        .input(concatListPath)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .input(effectiveAudioPath);

      const opts = useStreamCopy
        ? [
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest"
          ]
        : [
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-b:v", preset.bitrate,
            "-maxrate", preset.bitrate,
            "-bufsize", "512k",
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", String(targetSongDuration),
            "-threads", isConstrained ? "1" : "2"
          ];

      return new Promise((resolve, reject) => {
        stitchCmd
          .outputOptions(opts)
          .save(tempOutputPath)
          .on("progress", async (p) => {
            dbJob.progressPercent = Math.min(95, Math.max(50, Math.round(p.percent || 65)));
            dbJob.currentStepMessage = `Finalizing ${preset.name} video stream...`;
            await dbJob.save().catch(() => {});
          })
          .on("end", resolve)
          .on("error", (err, stdout, stderr) => {
            console.error(`FFmpeg stitch attempt failed (streamCopy=${useStreamCopy}):`, stderr || err.message);
            reject(err);
          });
      });
    };

    try {
      await runStitch(true);
    } catch (streamErr) {
      console.warn("[Video Worker] Stream copy stitch failed, attempting fallback re-encode:", streamErr.message);
      await fs.unlink(tempOutputPath).catch(() => {});
      await runStitch(false);
    }

    // Read rendered video and upload via universal storage adapter
    const finalVideoBuffer = await fs.readFile(tempOutputPath);
    const storageKey = buildStoryStorageKey({
      projectId,
      title: projectDoc?.title || "",
      category: "renders",
      filename: outputFilename
    });
    const publicUrl = await uploadAssetBuffer(finalVideoBuffer, storageKey, "video/mp4");

    // Generate and upload .srt and .vtt subtitles synchronized with scenes
    let subtitlesUrl = null;
    let vttUrl = null;
    try {
      let currentSrtTime = 0;
      const srtBlocks = [];
      const vttBlocks = ["WEBVTT\n"];
      scenesToRender.forEach((scene, i) => {
        const startTime = currentSrtTime;
        const endTime = currentSrtTime + scene.duration;
        currentSrtTime = endTime;
        const text = (scene.captionText || "").trim();
        if (text) {
          srtBlocks.push(`${srtBlocks.length + 1}\n${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n${text}\n`);
          vttBlocks.push(`${vttBlocks.length}\n${formatVttTime(startTime)} --> ${formatVttTime(endTime)}\n${text}\n`);
        }
      });

      const srtContent = srtBlocks.join("\n");
      const srtFilename = `subtitles_${timestamp}.srt`;
      const srtStorageKey = buildStoryStorageKey({
        projectId,
        title: projectDoc?.title || "",
        category: "renders",
        filename: srtFilename
      });
      subtitlesUrl = await uploadAssetBuffer(Buffer.from(srtContent, "utf-8"), srtStorageKey, "text/plain; charset=utf-8");

      const vttContent = vttBlocks.join("\n");
      const vttFilename = `subtitles_${timestamp}.vtt`;
      const vttStorageKey = buildStoryStorageKey({
        projectId,
        title: projectDoc?.title || "",
        category: "renders",
        filename: vttFilename
      });
      vttUrl = await uploadAssetBuffer(Buffer.from(vttContent, "utf-8"), vttStorageKey, "text/vtt; charset=utf-8");

      console.log(`[Video Worker] Uploaded synchronized subtitles: SRT=${subtitlesUrl}, VTT=${vttUrl}`);
    } catch (srtErr) {
      console.warn("[Video Worker] Subtitle upload failed (non-critical):", srtErr.message);
    }

    // Cleanup temporary segment files & downloaded cloud assets
    await fs.unlink(tempOutputPath).catch(() => {});
    await fs.unlink(concatListPath).catch(() => {});
    await Promise.all(segmentPaths.map((sp) => fs.unlink(sp).catch(() => {})));
    await Promise.all(tempFilesToClean.map((tf) => fs.unlink(tf).catch(() => {})));

    const effectiveLanguage = projectDoc?.language || songDoc?.language || "en";
    const videoDoc = await Video.create({
      projectId,
      videoUrl: publicUrl,
      durationSeconds: targetSongDuration,
      resolution: `${preset.width}x${preset.height} (${preset.shortLabel})`,
      aspectRatio: preset.aspectRatio,
      preset: presetKey,
      language: effectiveLanguage,
      subtitlesUrl: subtitlesUrl || undefined,
      vttUrl: vttUrl || undefined,
      fileSizeBytes: finalVideoBuffer.length
    });

    dbJob.status = "completed";
    dbJob.progressPercent = 100;
    dbJob.resultRef = videoDoc._id;
    dbJob.currentStepMessage = isAdProject
      ? "Short Advertisement Video rendering complete!"
      : "Event Music Video rendering complete!";
    await dbJob.save();

    await Project.findByIdAndUpdate(projectId, {
      status: "completed",
      activeVideoId: videoDoc._id
    });

    return videoDoc;
  } catch (err) {
    if (tempOutputPath) await fs.unlink(tempOutputPath).catch(() => {});
    if (concatListPath) await fs.unlink(concatListPath).catch(() => {});
    if (Array.isArray(segmentPaths)) {
      await Promise.all(segmentPaths.map((sp) => fs.unlink(sp).catch(() => {})));
    }
    if (Array.isArray(tempFilesToClean)) {
      await Promise.all(tempFilesToClean.map((tf) => fs.unlink(tf).catch(() => {})));
    }
    dbJob.status = "failed";
    dbJob.errorMessage = err.message || "Video rendering failed";
    await dbJob.save().catch(() => {});
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
