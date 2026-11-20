export function aspectRatioToSlotKey(aspectRatio = "16:9") {
  const clean = String(aspectRatio || "").trim();
  if (clean === "9:16") return "portrait_9_16";
  if (clean === "1:1") return "square_1_1";
  if (clean === "4:3") return "tablet_4_3";
  return "landscape_16_9";
}

export function resolveMediaRef(ref, mediaItems = []) {
  if (!ref) return null;
  if (typeof ref === "object" && ref.fileUrl) return ref;
  const targetId = String(ref._id || ref);
  return mediaItems.find((m) => String(m._id) === targetId) || null;
}

export function resolveSceneMediaForAspect(scene, aspectRatio = "16:9", mediaItems = [], idx = 0) {
  if (!scene) return null;
  const slotKey = aspectRatioToSlotKey(aspectRatio);
  const slot = scene.mediaByAspect?.[slotKey];

  const slotMedia =
    resolveMediaRef(slot?.activeMediaId, mediaItems) ||
    resolveMediaRef(slot?.videoMediaId, mediaItems) ||
    resolveMediaRef(slot?.imageMediaId, mediaItems);
  if (slotMedia) return slotMedia;

  const directMedia = resolveMediaRef(scene.mediaId, mediaItems);
  if (directMedia && (!directMedia.aspectRatio || directMedia.aspectRatio === aspectRatio)) {
    return directMedia;
  }

  const aspectPool = mediaItems.filter((m) => m.aspectRatio === aspectRatio);
  if (aspectPool.length > 0) {
    return aspectPool[idx % aspectPool.length];
  }

  if (directMedia) return directMedia;

  const uploadedPool = mediaItems.filter(
    (m) => !m.aspectRatio && String(m.originalFilename || "").startsWith("upload_")
  );
  if (uploadedPool.length > 0) {
    return uploadedPool[idx % uploadedPool.length];
  }

  return mediaItems.length > 0 ? mediaItems[idx % mediaItems.length] : null;
}

export function getSavedAspectsForScene(scene) {
  if (!scene?.mediaByAspect) return [];
  const mapping = [
    ["9:16", "portrait_9_16"],
    ["16:9", "landscape_16_9"],
    ["1:1", "square_1_1"],
    ["4:3", "tablet_4_3"]
  ];
  return mapping
    .filter(([, key]) => {
      const slot = scene.mediaByAspect?.[key];
      return Boolean(slot?.activeMediaId || slot?.videoMediaId || slot?.imageMediaId);
    })
    .map(([label]) => label);
}

export function getSceneDurationSeconds(scene, fallbackPerScene = 5) {
  if (
    scene &&
    typeof scene.startTimeSeconds === "number" &&
    typeof scene.endTimeSeconds === "number" &&
    scene.endTimeSeconds > scene.startTimeSeconds
  ) {
    return Math.max(1, Math.round(scene.endTimeSeconds - scene.startTimeSeconds));
  }
  if (scene && typeof scene.durationSeconds === "number" && scene.durationSeconds > 0) {
    return Math.max(1, Math.round(scene.durationSeconds));
  }
  return Math.max(1, Math.round(fallbackPerScene));
}

export function summarizeStoryboardTiming(scenes = [], fallbackTotalSeconds = 30) {
  const list = Array.isArray(scenes) ? scenes : [];
  const computedTotalFromScenes =
    list.length > 0 &&
    typeof list[list.length - 1]?.endTimeSeconds === "number" &&
    list[list.length - 1].endTimeSeconds > 0
      ? Math.round(list[list.length - 1].endTimeSeconds)
      : 0;
  const totalSec = Math.max(
    1,
    Math.round(Number(fallbackTotalSeconds) || computedTotalFromScenes || 30)
  );

  if (list.length === 0) {
    const estPerScene = totalSec <= 15 ? 4 : totalSec <= 45 ? 5 : 6;
    return {
      count: 0,
      minSec: estPerScene,
      maxSec: estPerScene,
      perSceneLabel: `~${estPerScene}s`,
      totalSec
    };
  }

  const avgFallback = Math.max(1, Math.round(totalSec / list.length));
  const durations = list.map((s) => getSceneDurationSeconds(s, avgFallback));
  const minSec = Math.min(...durations);
  const maxSec = Math.max(...durations);
  const perSceneLabel = minSec === maxSec ? `${minSec}s` : `${minSec}s–${maxSec}s`;

  return {
    count: list.length,
    minSec,
    maxSec,
    perSceneLabel,
    totalSec
  };
}

export function collectSavedRenderedVideos(project) {
  if (!project) return [];
  const seen = new Set();
  const list = [];
  const candidates = [
    ...(Array.isArray(project.renderedVideos) ? project.renderedVideos : []),
    ...(project.activeVideoId && typeof project.activeVideoId === "object"
      ? [project.activeVideoId]
      : [])
  ];
  for (const vid of candidates) {
    if (!vid?.videoUrl) continue;
    const key = String(vid._id || vid.videoUrl);
    if (!seen.has(key)) {
      seen.add(key);
      list.push(vid);
    }
  }
  return list;
}
