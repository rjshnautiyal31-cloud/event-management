import { useState, useEffect, useRef } from "react";
import { api, API_BASE } from "../api.js";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";
import { EventSwitcherModal } from "../components/EventSwitcherModal.jsx";
import {
  resolveSceneMediaForAspect,
  getSavedAspectsForScene,
  collectSavedRenderedVideos,
  aspectRatioToSlotKey,
  getSceneDurationSeconds,
  summarizeStoryboardTiming
} from "../utils/aspectMedia.js";

export function ProjectStudioPage({ auth, token: propToken }) {
  const token = auth?.token || propToken;
  const castSectionRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeTab, setActiveTab] = useState("story"); // story | lyrics | media | storyboard | render
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Event Switcher Modal State (Cmd+K)
  const [switcherModalOpen, setSwitcherModalOpen] = useState(false);

  // Create Project Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStory, setNewTitleStory] = useState("");
  const [newLanguage, setNewLanguage] = useState("en");

  // Multilingual State
  const [languages, setLanguages] = useState([
    { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
    {
      code: "hinglish",
      name: "Hinglish",
      nativeName: "Hindi + English",
      flag: "🇮🇳"
    }
  ]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  // Genre & AI Provider State
  const [selectedGenre, setSelectedGenre] = useState("Pop");
  const [selectedMusicProvider, setSelectedMusicProvider] =
    useState("google_lyria");
  const [selectedTargetDuration, setSelectedTargetDuration] = useState("180");
  const [selectedVoiceType, setSelectedVoiceType] = useState("female");
  const [customVoicePrompt, setCustomVoicePrompt] = useState("");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [generatingVeoSceneIdx, setGeneratingVeoSceneIdx] = useState(null);
  const [generatingAllVeo, setGeneratingAllVeo] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);

  // Characters & Director Guidelines State (Creation modal)
  const [newCharacters, setNewCharacters] = useState([]);
  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("");
  const [newCharDesc, setNewCharDesc] = useState("");
  const [newDirectorGuidelines, setNewDirectorGuidelines] = useState("");
  const [showModalAddChar, setShowModalAddChar] = useState(false);

  // Tab 1 Active Project Characters & Guidelines
  const [projectCharacters, setProjectCharacters] = useState([]);
  const [tabCharName, setTabCharName] = useState("");
  const [tabCharRole, setTabCharRole] = useState("");
  const [tabCharDesc, setTabCharDesc] = useState("");
  const [projectDirectorGuidelines, setProjectDirectorGuidelines] =
    useState("");
  const [savingCastGuidelines, setSavingCastGuidelines] = useState(false);

  // Tab 4 Storyboard Scene Edit State
  const [editingSceneIdx, setEditingSceneIdx] = useState(null);
  const [sceneDraftPrompts, setSceneDraftPrompts] = useState({});
  const [generatingImageSceneIdx, setGeneratingImageSceneIdx] = useState(null);
  const [updatingSceneIdx, setUpdatingSceneIdx] = useState(null);

  // Media State
  const [mediaItems, setMediaItems] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Job Polling & Multi-Format Rendered Video Preview State
  const [activeJob, setActiveJob] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [selectedVideoPreviewId, setSelectedVideoPreviewId] = useState("");

  // Video Resolution Presets State
  const [selectedPreset, setSelectedPreset] = useState("1080p");
  const [videoPresets, setVideoPresets] = useState({
    "1080p": {
      id: "1080p",
      name: "Desktop Full HD (1080p)",
      shortLabel: "1080p Full HD",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      bitrate: "6000k",
      description:
        "Crisp 1080p Full HD for monitors, projectors & presentations",
      icon: "🖥️"
    },
    "720p": {
      id: "720p",
      name: "Desktop HD (720p)",
      shortLabel: "720p HD",
      width: 1280,
      height: 720,
      aspectRatio: "16:9",
      bitrate: "3500k",
      description: "Fast-rendering standard 720p HD",
      icon: "💻"
    },
    mobile: {
      id: "mobile",
      name: "Mobile Vertical (9:16)",
      shortLabel: "Mobile (9:16)",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      bitrate: "4500k",
      description: "Vertical 9:16 for smartphones, Reels & TikTok",
      icon: "📱"
    },
    tablet: {
      id: "tablet",
      name: "Tablet Display (4:3)",
      shortLabel: "Tablet (4:3)",
      width: 1440,
      height: 1080,
      aspectRatio: "4:3",
      bitrate: "4500k",
      description: "4:3 aspect ratio tailored for iPad & tablet screens",
      icon: "📲"
    },
    square: {
      id: "square",
      name: "Social Square (1:1)",
      shortLabel: "Square (1:1)",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      bitrate: "4000k",
      description: "Square 1:1 format for social media feeds",
      icon: "🔲"
    }
  });

  useEffect(() => {
    loadEvents();
    loadVideoPresets();
    loadLanguages();
  }, []);

  // Global keyboard shortcuts: ⌘K / Ctrl+K for Event Switcher, Escape for Create Story Modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSwitcherModalOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setShowCreateModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function loadLanguages() {
    try {
      const data = await api("/api/story-video/languages", { token });
      if (Array.isArray(data) && data.length > 0) {
        setLanguages(data);
      }
    } catch (_) {}
  }

  function getLanguageLabel(code) {
    const match = languages.find((l) => l.code === code);
    return match
      ? `${match.flag} ${match.name} (${match.nativeName})`
      : code
        ? code.toUpperCase()
        : "English";
  }

  function getLanguageShort(code) {
    const match = languages.find((l) => l.code === code);
    return match
      ? `${match.flag} ${match.name}`
      : code
        ? code.toUpperCase()
        : "English";
  }

  async function loadVideoPresets() {
    try {
      const data = await api("/api/story-video/video-presets", { token });
      if (data?.presets) {
        setVideoPresets((prev) => ({
          ...prev,
          ...data.presets
        }));
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (selectedEventId) {
      loadProjects(selectedEventId);
    } else {
      setProjects([]);
      setActiveProject(null);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (activeProject) {
      loadMediaItems(activeProject._id);
      if (activeProject.language) {
        setSelectedLanguage(activeProject.language);
      }
      if (activeProject.voiceType) {
        setSelectedVoiceType(activeProject.voiceType);
      }
      if (activeProject.customVoicePrompt) {
        setCustomVoicePrompt(activeProject.customVoicePrompt);
      }
      if (activeProject.customVoiceId) {
        setCustomVoiceId(activeProject.customVoiceId);
      }
      if (activeProject.activeSongId?.durationSeconds) {
        const d = activeProject.activeSongId.durationSeconds;
        const matchingDuration =
          d <= 45 ? "30" : d <= 75 ? "60" : d <= 105 ? "90" : d <= 150 ? "120" : "180";
        setSelectedTargetDuration(matchingDuration);
      }
      if (activeProject.activeSongId?.genre) {
        setSelectedGenre(activeProject.activeSongId.genre);
      }
      if (
        activeProject.activeSongId?.provider &&
        ["google_lyria", "elevenlabs", "suno", "google_tts"].includes(
          activeProject.activeSongId.provider
        )
      ) {
        setSelectedMusicProvider(activeProject.activeSongId.provider);
      }
      setProjectCharacters(
        Array.isArray(activeProject.characters) ? activeProject.characters : []
      );
      setProjectDirectorGuidelines(activeProject.directorGuidelines || "");
      if (activeProject.activeStoryboardId?.scenes) {
        const drafts = {};
        activeProject.activeStoryboardId.scenes.forEach((s, idx) => {
          drafts[idx] = s.visualPrompt || s.captionText || "";
        });
        setSceneDraftPrompts(drafts);
      }
    }
  }, [activeProject]);

  async function handleLanguageChange(newLang) {
    setSelectedLanguage(newLang);
    if (activeProject?._id) {
      try {
        await api(`/api/story-video/projects/${activeProject._id}`, {
          token,
          method: "PATCH",
          body: { language: newLang }
        });
        setActiveProject((prev) =>
          prev ? { ...prev, language: newLang } : prev
        );
      } catch (err) {
        console.warn("Failed to patch project language:", err.message);
      }
    }
  }

  async function handleVoiceTypeChange(newVoice) {
    setSelectedVoiceType(newVoice);
    if (activeProject?._id) {
      try {
        await api(`/api/story-video/projects/${activeProject._id}`, {
          token,
          method: "PATCH",
          body: { voiceType: newVoice }
        });
        setActiveProject((prev) =>
          prev ? { ...prev, voiceType: newVoice } : prev
        );
      } catch (err) {
        console.warn("Failed to patch project voiceType:", err.message);
      }
    }
  }

  async function loadEvents() {
    try {
      const data = await api("/api/events", { token });
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
      if (eventList.length > 0) {
        setSelectedEventId(eventList[0]._id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadProjects(eventId) {
    try {
      const data = await api(
        `/api/story-video/projects?eventId=${encodeURIComponent(eventId)}&projectType=story_music`,
        {
          token
        }
      );
      setProjects(data);
      if (data.length > 0) {
        setActiveProject(data[0]);
      } else {
        setActiveProject(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadMediaItems(projectId) {
    try {
      const data = await api(
        `/api/story-video/projects/${projectId}/media`,
        { token }
      );
      setMediaItems(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault();
    if (!newTitle || !newStory || !selectedEventId) return;
    setLoading(true);
    setError("");
    try {
      const project = await api("/api/story-video/projects", {
        token,
        method: "POST",
        body: {
          eventId: selectedEventId,
          title: newTitle,
          storyText: newStory,
          language: newLanguage,
          characters: newCharacters,
          directorGuidelines: newDirectorGuidelines
        }
      });
      setSuccess(
        "Story Project created with Cast & Directives successfully!"
      );
      setNewTitle("");
      setNewTitleStory("");
      setNewLanguage("en");
      setNewCharacters([]);
      setNewDirectorGuidelines("");
      setShowCreateModal(false);
      await loadProjects(selectedEventId);
      setActiveProject(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTabCharacter(e) {
    e?.preventDefault();
    if (!tabCharName.trim()) return;
    const newChar = {
      name: tabCharName.trim(),
      role: tabCharRole.trim(),
      visualDescription: tabCharDesc.trim()
    };
    const updated = [...projectCharacters, newChar];
    setProjectCharacters(updated);
    setTabCharName("");
    setTabCharRole("");
    setTabCharDesc("");

    if (activeProject?._id) {
      try {
        setSavingCastGuidelines(true);
        await api(`/api/story-video/projects/${activeProject._id}`, {
          token,
          method: "PATCH",
          body: { characters: updated }
        });
        setActiveProject((prev) =>
          prev ? { ...prev, characters: updated } : prev
        );
        setSuccess(`Added "${newChar.name}" to the project cast!`);
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingCastGuidelines(false);
      }
    }
  }

  async function handleRemoveTabCharacter(idx) {
    const updated = projectCharacters.filter((_, i) => i !== idx);
    setProjectCharacters(updated);

    if (activeProject?._id) {
      try {
        setSavingCastGuidelines(true);
        await api(`/api/story-video/projects/${activeProject._id}`, {
          token,
          method: "PATCH",
          body: { characters: updated }
        });
        setActiveProject((prev) =>
          prev ? { ...prev, characters: updated } : prev
        );
        setSuccess("Character removed from project cast.");
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingCastGuidelines(false);
      }
    }
  }

  async function handleSaveGuidelines() {
    if (!activeProject?._id) return;
    try {
      setSavingCastGuidelines(true);
      await api(`/api/story-video/projects/${activeProject._id}`, {
        token,
        method: "PATCH",
        body: { directorGuidelines: projectDirectorGuidelines }
      });
      setActiveProject((prev) =>
        prev
          ? { ...prev, directorGuidelines: projectDirectorGuidelines }
          : prev
      );
      setSuccess("Director guidelines saved successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCastGuidelines(false);
    }
  }

  async function handleSaveScenePrompt(sceneIdx) {
    if (!activeProject?._id) return;
    setUpdatingSceneIdx(sceneIdx);
    setError("");
    const newPrompt = sceneDraftPrompts[sceneIdx] ?? "";
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`,
        {
          token,
          method: "PATCH",
          body: { visualPrompt: newPrompt }
        }
      );
      setSuccess(`Scene ${sceneIdx + 1} visual prompt updated!`);
      setEditingSceneIdx(null);
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingSceneIdx(null);
    }
  }

  async function handleToggleSceneCharacter(sceneIdx, charName) {
    if (!activeProject?._id || !activeProject.activeStoryboardId?.scenes)
      return;
    const scene = activeProject.activeStoryboardId.scenes[sceneIdx];
    if (!scene) return;
    const currentChars = Array.isArray(scene.characters)
      ? [...scene.characters]
      : [];
    const hasChar = currentChars.includes(charName);
    const updatedChars = hasChar
      ? currentChars.filter((c) => c !== charName)
      : [...currentChars, charName];

    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`,
        {
          token,
          method: "PATCH",
          body: { characters: updatedChars }
        }
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssignSceneMedia(sceneIdx, mediaId) {
    if (!activeProject?._id) return;
    const currentAspect = videoPresets[selectedPreset]?.aspectRatio || "16:9";
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`,
        {
          token,
          method: "PATCH",
          body: { mediaId: mediaId || null, aspectRatio: currentAspect }
        }
      );
      setSuccess(`Scene ${sceneIdx + 1} (${currentAspect}) media updated!`);
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateSceneImage(sceneIdx, prompt) {
    if (!activeProject?._id) return;
    setGeneratingImageSceneIdx(sceneIdx);
    setError("");
    const targetAspectRatio =
      videoPresets[selectedPreset]?.aspectRatio || "16:9";
    setSuccess(
      `Generating AI image frame (${targetAspectRatio}) for Scene ${sceneIdx + 1}...`
    );
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}/image`,
        {
          token,
          method: "POST",
          body: { prompt, aspectRatio: targetAspectRatio }
        }
      );
      setSuccess(`New AI image frame generated for Scene ${sceneIdx + 1}!`);
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingImageSceneIdx(null);
    }
  }

  async function handleAnalyzeStory() {
    if (!activeProject) return;
    setLoading(true);
    setError("");
    const langLabel = getLanguageLabel(selectedLanguage);
    setSuccess(
      `Analyzing story narrative in ${langLabel} with Gemini AI...`
    );
    try {
      await api(`/api/story-video/projects/${activeProject._id}/analyze`, {
        token,
        method: "POST",
        body: { language: selectedLanguage }
      });
      setSuccess(`Story analyzed with Gemini AI in ${langLabel}!`);
      await loadProjects(selectedEventId);
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setActiveTab("lyrics");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateLyrics() {
    if (!activeProject) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const providerLabel =
        selectedMusicProvider === "google_lyria"
          ? "Google Lyria 3 Pro"
          : selectedMusicProvider === "elevenlabs"
            ? "ElevenLabs"
            : selectedMusicProvider === "suno"
              ? "Suno AI"
              : "Google Cloud TTS";
      const langLabel = getLanguageLabel(selectedLanguage);
      const targetSec = Number(selectedTargetDuration) || 180;
      const targetSecLabel =
        targetSec >= 165
          ? "180s (3 min) studio song"
          : targetSec >= 115
            ? "120s (2 min) studio song"
            : `${targetSec}s track`;
      const voiceLabel =
        selectedVoiceType === "male"
          ? "Male Vocals"
          : selectedVoiceType === "duet"
            ? "Duet Vocals"
            : selectedVoiceType === "custom"
              ? `Custom (${customVoicePrompt || customVoiceId || "Vocal Style"})`
              : "Female Vocals";

      setSuccess(
        `Composing ${targetSecLabel} (${voiceLabel}) in ${langLabel} with ${providerLabel}... Generating singing vocals, acoustics & melody.`
      );

      const songRes = await api(
        `/api/story-video/projects/${activeProject._id}/lyrics`,
        {
          token,
          method: "POST",
          body: {
            genre: selectedGenre,
            musicProvider: selectedMusicProvider,
            language: selectedLanguage,
            targetDuration: targetSec,
            voiceType: selectedVoiceType,
            customVoicePrompt,
            customVoiceId
          }
        }
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);

      if (songRes.isFallback) {
        setSuccess(
          `Generated via backup vocal synthesizer (${
            songRes.durationSeconds ? `${songRes.durationSeconds}s` : "30s"
          }) as Lyria 3 Pro was temporarily busy. You can retry with Lyria 3 Pro anytime!`
        );
      } else {
        const mins = songRes.durationSeconds
          ? Math.floor(songRes.durationSeconds / 60)
          : 0;
        const secs = songRes.durationSeconds
          ? songRes.durationSeconds % 60
          : 0;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        setSuccess(
          `Full AI Lyrics & ${providerLabel} song track (${durStr}) generated in ${langLabel} successfully!`
        );
      }
      setActiveTab("lyrics");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVeoScene(sceneIndex, customPrompt) {
    if (!activeProject) return;
    const targetAspectRatio =
      videoPresets[selectedPreset]?.aspectRatio || "16:9";
    const scenes = activeProject.activeStoryboardId?.scenes || [];
    const totalSec =
      activeProject.activeSongId?.durationSeconds ||
      Number(selectedTargetDuration) ||
      30;
    const sceneObj = scenes[sceneIndex];
    const sceneDur = getSceneDurationSeconds(
      sceneObj,
      Math.max(2, Math.round(totalSec / Math.max(1, scenes.length)))
    );
    setGeneratingVeoSceneIdx(sceneIndex);
    setError("");
    setSuccess(
      `Generating ${sceneDur}s Gemini Omni 1.1 Flash (${targetAspectRatio}) motion clip for Scene ${sceneIndex + 1} (${totalSec}s total video)...`
    );
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIndex}/veo`,
        {
          token,
          method: "POST",
          body: { prompt: customPrompt, aspectRatio: targetAspectRatio }
        }
      );
      setSuccess(
        `Saved ${sceneDur}s Gemini Omni 1.1 (${targetAspectRatio}) motion clip for Scene ${sceneIndex + 1} (other aspect ratios preserved)!`
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingVeoSceneIdx(null);
    }
  }

  async function handleGenerateAllVeo(overwrite = false) {
    if (!activeProject) return;
    const targetAspectRatio =
      videoPresets[selectedPreset]?.aspectRatio || "16:9";
    const scenes = activeProject.activeStoryboardId?.scenes || [];
    const timing = summarizeStoryboardTiming(
      scenes,
      activeProject.activeSongId?.durationSeconds ||
        selectedTargetDuration ||
        30
    );
    const slotKey = aspectRatioToSlotKey(targetAspectRatio);
    const pendingScenes = overwrite
      ? scenes
      : scenes.filter((s) => !s.mediaByAspect?.[slotKey]?.videoMediaId);
    const targetCount = pendingScenes.length || scenes.length;

    setGeneratingAllVeo(true);
    setError("");
    setSuccess(
      `Generating ${targetCount} Gemini Omni 1.1 Flash (${targetAspectRatio}) motion clip${targetCount === 1 ? "" : "s"} (${timing.perSceneLabel} per scene • ${timing.totalSec}s total video)...`
    );
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/generate-all-veo`,
        {
          token,
          method: "POST",
          body: { aspectRatio: targetAspectRatio, overwrite }
        }
      );
      setSuccess(
        `Saved ${targetCount} Gemini Omni 1.1 (${targetAspectRatio}) motion clip${targetCount === 1 ? "" : "s"} (${timing.perSceneLabel} per scene • ${timing.totalSec}s video — other aspect ratios preserved)!`
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingAllVeo(false);
    }
  }

  async function handleGenerateAllImages(overwrite = false) {
    if (!activeProject) return;
    setGeneratingAllImages(true);
    setError("");
    const targetAspectRatio =
      videoPresets[selectedPreset]?.aspectRatio || "16:9";
    const scenes = activeProject.activeStoryboardId?.scenes || [];
    const timing = summarizeStoryboardTiming(
      scenes,
      activeProject.activeSongId?.durationSeconds ||
        selectedTargetDuration ||
        30
    );
    setSuccess(
      `Synthesizing ${timing.count || "all"} Google AI high-definition ${targetAspectRatio} scene frame${timing.count === 1 ? "" : "s"} (${timing.perSceneLabel} per scene • ${timing.totalSec}s total video)...`
    );
    try {
      const res = await api(
        `/api/story-video/projects/${activeProject._id}/scenes/generate-all-images`,
        {
          token,
          method: "POST",
          body: { overwrite, aspectRatio: targetAspectRatio }
        }
      );
      setSuccess(
        res.message || "Google AI scene images generated successfully!"
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingAllImages(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;

    setUploadingMedia(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api(`/api/story-video/projects/${activeProject._id}/media`, {
        token,
        method: "POST",
        formData
      });
      setSuccess("Photo uploaded successfully!");
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleDeleteMedia(mediaId) {
    if (!activeProject || !mediaId) return;
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/media/${mediaId}`,
        {
          token,
          method: "DELETE"
        }
      );
      setSuccess("Photo deleted.");
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClearAllMedia() {
    if (!activeProject) return;
    if (
      !window.confirm(
        "Remove all uploaded photos? The model will automatically generate 16:9 AI scene visuals instead."
      )
    )
      return;
    try {
      await api(`/api/story-video/projects/${activeProject._id}/media`, {
        token,
        method: "DELETE"
      });
      setSuccess(
        "All photos cleared! Storyboard will now generate AI scene images."
      );
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateStoryboard() {
    if (!activeProject) return;
    const targetAspectRatio =
      videoPresets[selectedPreset]?.aspectRatio || "16:9";
    setLoading(true);
    setError("");
    try {
      const res = await api(
        `/api/story-video/projects/${activeProject._id}/storyboard`,
        {
          token,
          method: "POST",
          body: { targetSceneDuration: 6, aspectRatio: targetAspectRatio }
        }
      );
      const timing = summarizeStoryboardTiming(
        res.scenes || [],
        activeProject.activeSongId?.durationSeconds ||
          selectedTargetDuration ||
          30
      );
      setSuccess(
        `Storyboard synchronized! Created ${timing.count} lyric-aligned scene${timing.count === 1 ? "" : "s"} (${timing.perSceneLabel} each • ${timing.totalSec}s total song).`
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setActiveTab("storyboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTriggerRender() {
    if (!activeProject) return;
    setRendering(true);
    setError("");
    setSuccess("");
    try {
      const { jobId } = await api(
        `/api/story-video/projects/${activeProject._id}/render`,
        {
          token,
          method: "POST",
          body: { resolutionPreset: selectedPreset }
        }
      );

      setSuccess(
        `Video rendering queued for ${
          videoPresets[selectedPreset]?.shortLabel || selectedPreset
        }...`
      );
      pollJobStatus(jobId);
    } catch (err) {
      setError(err.message);
      setRendering(false);
    }
  }

  function pollJobStatus(jobId) {
    const interval = setInterval(async () => {
      try {
        const job = await api(`/api/story-video/jobs/${jobId}`, { token });
        setActiveJob(job);

        if (job.status === "completed") {
          clearInterval(interval);
          setRendering(false);
          setSuccess("Video rendering complete! Saved alongside your other rendered formats.");
          const updated = await api(
            `/api/story-video/projects/${activeProject._id}`,
            { token }
          );
          setActiveProject(updated);
          if (updated?.activeVideoId?._id) {
            setSelectedVideoPreviewId(String(updated.activeVideoId._id));
          }
        } else if (job.status === "failed") {
          clearInterval(interval);
          setRendering(false);
          setError(job.errorMessage || "Rendering failed");
        }
      } catch (err) {
        clearInterval(interval);
        setRendering(false);
      }
    }, 2000);
  }

  const selectedEvent = events.find((ev) => ev._id === selectedEventId);

  const studioTabs = [
    {
      id: "story",
      step: 1,
      label: "Story Analysis",
      shortLabel: "Story",
      icon: "book",
      done: Boolean(activeProject?.activeStoryAnalysisId)
    },
    {
      id: "lyrics",
      step: 2,
      label: "Lyrics & Audio",
      shortLabel: "Lyrics & Audio",
      icon: "music",
      done: Boolean(
        activeProject?.activeSongId?.audioUrl ||
          activeProject?.activeSongId?.lyrics
      )
    },
    {
      id: "media",
      step: 3,
      label: "Event Photos",
      shortLabel: "Photos",
      icon: "image",
      done: mediaItems.length > 0
    },
    {
      id: "storyboard",
      step: 4,
      label: "Storyboard",
      shortLabel: "Storyboard",
      icon: "studio",
      done: Boolean(activeProject?.activeStoryboardId?.scenes?.length)
    },
    {
      id: "render",
      step: 5,
      label: "Render Video",
      shortLabel: "Render Video",
      icon: "rocket",
      done: Boolean(activeProject?.activeVideoId?.videoUrl)
    }
  ];
  const currentStepIdx = Math.max(
    0,
    studioTabs.findIndex((t) => t.id === activeTab)
  );
  const prevStudioTab =
    currentStepIdx > 0 ? studioTabs[currentStepIdx - 1] : null;
  const nextStudioTab =
    currentStepIdx < studioTabs.length - 1
      ? studioTabs[currentStepIdx + 1]
      : null;

  return (
    <AppShell
      auth={auth}
      pageTitle="AI Story Studio"
      onOpenSwitcher={() => setSwitcherModalOpen(true)}
      selectedEventTitle={selectedEvent?.title}
    >
      {/* Quick Event Switcher Modal (Cmd+K) */}
      <EventSwitcherModal
        isOpen={switcherModalOpen}
        onClose={() => setSwitcherModalOpen(false)}
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={(eventId) => {
          setSelectedEventId(eventId);
          setSwitcherModalOpen(false);
        }}
      />

      {/* Modal: New Event Story Project (Anchored to Viewport Outside <main>) */}
      {showCreateModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-story-modal-title"
        >
          <div className="bg-surface rounded-container max-w-lg w-full shadow-soft flex flex-col max-h-[90vh] my-auto overflow-hidden border border-theme animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme shrink-0 bg-hero-gradient">
              <h3
                id="create-story-modal-title"
                className="text-lg font-bold text-primary truncate pr-2"
              >
                Create AI Story for "{selectedEvent?.title}"
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="h-10 w-10 rounded-tile bg-surface/85 hover:bg-surface border border-theme text-primary flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateProject}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                <div>
                  <label className="ui-label-sm">Story Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Highlights & Key Moments"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="ui-input"
                  />
                </div>

                <div>
                  <label className="ui-label-sm">
                    Language for Song &amp; Video
                  </label>
                  <select
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    className="ui-select"
                  >
                    {languages.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.flag} {l.name} ({l.nativeName})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    Lyrics, singing vocals, and synchronized subtitles will be generated in this language.
                  </p>
                </div>

                <div>
                  <label className="ui-label-sm">
                    Story Narrative / Event Memories
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Type or paste the story, speech, or summary of this event..."
                    value={newStory}
                    onChange={(e) => setNewTitleStory(e.target.value)}
                    className="ui-textarea"
                  />
                </div>

                {/* Cast & Characters (Visual Consistency) */}
                <div className="bg-primary-tint border border-theme p-4 rounded-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-heading flex items-center gap-1.5">
                        <Icon
                          name="users"
                          className="w-4 h-4 text-primary"
                        />
                        <span>Cast &amp; Characters (Optional)</span>
                      </span>
                      <p className="text-xs text-muted mt-0.5">
                        Helps AI render consistent faces &amp; attire across all video scenes.
                      </p>
                    </div>
                    {newCharacters.length > 0 && (
                      <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                        {newCharacters.length} added
                      </span>
                    )}
                  </div>

                  {newCharacters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newCharacters.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 bg-surface border border-theme text-heading text-xs font-semibold px-3 py-1 rounded-full"
                        >
                          <span>{c.name}</span>
                          {c.role && (
                            <span className="text-muted text-[11px]">
                              ({c.role})
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setNewCharacters((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                            className="text-muted hover:text-danger ml-0.5 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Name (e.g. Rahul)"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      className="ui-input-compact text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Groom)"
                      value={newCharRole}
                      onChange={(e) => setNewCharRole(e.target.value)}
                      className="ui-input-compact text-xs"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Appearance / Attire"
                        value={newCharDesc}
                        onChange={(e) => setNewCharDesc(e.target.value)}
                        className="ui-input-compact text-xs flex-1 min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCharName.trim()) return;
                          setNewCharacters((prev) => [
                            ...prev,
                            {
                              name: newCharName.trim(),
                              role: newCharRole.trim(),
                              visualDescription: newCharDesc.trim()
                            }
                          ]);
                          setNewCharName("");
                          setNewCharRole("");
                          setNewCharDesc("");
                        }}
                        className="ui-btn-secondary-sm px-3 text-xs shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Director Guidelines & Must-Have Scenes */}
                <div>
                  <label className="ui-label-sm flex items-center gap-1.5">
                    <Icon name="studio" className="w-4 h-4 text-primary" />
                    <span>
                      Director Guidelines &amp; Must-Have Scenes (Optional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Include stage garland exchange, grand cake cutting, and family toast..."
                    value={newDirectorGuidelines}
                    onChange={(e) =>
                      setNewDirectorGuidelines(e.target.value)
                    }
                    className="ui-textarea text-sm"
                  />
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-theme shrink-0 bg-primary-tint/60">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="ui-btn-secondary-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="ui-btn-primary-sm"
                >
                  <Icon name="sparkles" className="w-4 h-4" />
                  <span>
                    {loading ? "Creating..." : "Create Story Project"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 pb-20 space-y-8 animate-fade-in">
        {/* Centered Bold Two-Line Indigo Heading + Event Context Bar */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-soft border border-pastel-lavender text-xs font-bold text-primary">
            <Icon name="sparkles" className="w-4 h-4" />
            <span>AI Story-to-Song-to-Video Studio</span>
          </div>

          <h1 className="text-[32px] sm:text-[40px] font-bold text-primary leading-[1.15]">
            Event AI Story-to-Video
            <br />
            Song &amp; Cinema Studio
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Generate AI lyrics, studio music tracks, synchronized storyboards, and MP4 videos for your events.
          </p>

          {/* Event Context Pill Bar (Event Selection Only) */}
          <div className="inline-flex items-center gap-2.5 bg-surface px-4 py-2 rounded-full border border-theme shadow-subtle w-full sm:w-auto max-w-xl mx-auto">
            <Icon
              name="calendar"
              className="w-4 h-4 text-primary shrink-0"
            />
            <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">
              Event:
            </span>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-transparent text-heading text-sm font-bold py-1.5 pr-2 focus:outline-none flex-1 min-w-0 truncate cursor-pointer"
              aria-label="Select Event for Studio"
            >
              {events.map((ev) => (
                <option key={ev._id} value={ev._id}>
                  {ev.title}
                </option>
              ))}
            </select>
            {events.length > 1 && (
              <button
                type="button"
                onClick={() => setSwitcherModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-tint hover:bg-primary-soft border border-theme text-xs font-bold text-primary transition-colors shrink-0 cursor-pointer"
                title="Quick Switch Event (⌘K)"
              >
                <span>Switch</span>
                <span className="text-[11px] text-muted">⌘K</span>
              </button>
            )}
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="p-4 rounded-card bg-danger-tint border border-danger/25 text-danger text-sm font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Icon name="alert" className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="h-9 w-9 rounded-full hover:bg-danger/10 flex items-center justify-center text-danger cursor-pointer"
              aria-label="Dismiss error"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-card bg-pastel-mint/80 border border-theme text-heading text-sm font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Icon
                name="check-circle"
                className="w-5 h-5 text-success shrink-0"
              />
              <span>{success}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccess("")}
              className="h-9 w-9 rounded-full hover:bg-surface/60 flex items-center justify-center text-muted hover:text-heading cursor-pointer"
              aria-label="Dismiss notification"
            >
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Story Projects Selector Strip (Shown when stories exist; houses the single + New Story CTA) */}
        {projects.length > 0 && (
          <div className="ui-card p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-heading">
                  {selectedEvent ? selectedEvent.title : "Event"} Stories (
                  {projects.length})
                </h2>
                <p className="text-xs text-muted">
                  Multiple stories and rendered videos per event are supported.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                disabled={!selectedEventId}
                className="ui-btn-pill min-h-[42px] px-5 shrink-0"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span>New Story</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((proj) => {
                const isSelected = activeProject?._id === proj._id;
                return (
                  <button
                    key={proj._id}
                    type="button"
                    onClick={() => setActiveProject(proj)}
                    className={`w-full min-w-0 text-left p-4 rounded-card transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary-soft border-2 border-primary text-primary shadow-subtle"
                        : "bg-primary-tint/70 border border-theme text-heading hover:bg-primary-soft/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">
                        {proj.title}
                      </span>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                          isSelected
                            ? "bg-primary text-white"
                            : "bg-surface text-body border border-theme"
                        }`}
                      >
                        {getLanguageShort(proj.language)}
                      </span>
                    </div>
                    <div className="text-xs text-muted capitalize mt-1">
                      Status:{" "}
                      <span className="font-semibold text-heading">
                        {proj.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Studio Workspace */}
        {activeProject ? (
          <div className="space-y-6">
            {/* Responsive 5-Step Pipeline Stepper (All Stages Visible at Once — Zero Horizontal Scroll) */}
            <div className="bg-surface rounded-card border border-theme p-2.5 sm:p-3 shadow-subtle">
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
                role="tablist"
                aria-label="AI Studio Workflow"
              >
                {studioTabs.map((tab, idx) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-[48px] px-3 py-2 rounded-[16px] flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        idx === 4 ? "col-span-2 sm:col-span-1" : ""
                      } ${
                        active
                          ? "bg-primary-soft text-primary font-bold border-2 border-primary shadow-2xs"
                          : "bg-primary-tint/65 text-heading hover:bg-primary-soft/60 font-semibold border border-theme"
                      }`}
                    >
                      <span
                        className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          active
                            ? "bg-primary text-white"
                            : tab.done
                              ? "bg-pastel-mint text-success border border-success/40"
                              : "bg-surface text-primary border border-theme"
                        }`}
                      >
                        {!active && tab.done ? (
                          <Icon name="check" className="w-3.5 h-3.5" />
                        ) : (
                          tab.step
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs sm:text-[13px] leading-tight truncate">
                          {tab.label}
                        </span>
                        <span
                          className={`block text-[10px] leading-tight mt-0.5 truncate ${
                            active
                              ? "text-primary/80 font-semibold"
                              : tab.done
                                ? "text-success font-semibold"
                                : "text-muted font-medium"
                          }`}
                        >
                          {active ? "Active Step" : tab.done ? "Completed" : `Step ${tab.step}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB 1: STORY INPUT & ANALYSIS (Big Rounded 28px Prompt Card + Tilted Add Tiles + Control Row) */}
            {activeTab === "story" && (
              <div className="space-y-7">
                {/* Big Rounded Prompt Card (28px radius, 1px border, soft shadow) */}
                <div className="ui-container p-6 sm:p-8 space-y-6">
                  {/* Top Row: Tilted Dashed-Border Contextual "Add" Tiles + Project Title Badge */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-theme">
                    <div className="flex flex-wrap items-center gap-3.5 pt-1">
                      {/* Tilted Mint Add Tile: Upload Event Photos for Current Story */}
                      <button
                        type="button"
                        onClick={() => setActiveTab("media")}
                        className="inline-flex items-center gap-2.5 px-4 py-3 rounded-[18px] bg-pastel-mint border-2 border-dashed border-primary/25 text-heading text-xs sm:text-sm font-bold -rotate-2 hover:rotate-0 transition-transform cursor-pointer shadow-subtle"
                      >
                        <span className="h-7 w-7 rounded-full bg-surface text-primary flex items-center justify-center shadow-2xs">
                          <Icon name="plus" className="w-4 h-4" />
                        </span>
                        <span>
                          Add Photos{" "}
                          {mediaItems.length > 0
                            ? `(${mediaItems.length})`
                            : ""}
                        </span>
                      </button>

                      {/* Tilted Lavender Add Tile: Jump to Cast & Director Guidelines for Current Story */}
                      <button
                        type="button"
                        onClick={() =>
                          castSectionRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "start"
                          })
                        }
                        className="inline-flex items-center gap-2.5 px-4 py-3 rounded-[18px] bg-primary-soft border-2 border-dashed border-primary/30 text-primary text-xs sm:text-sm font-bold rotate-2 hover:rotate-0 transition-transform cursor-pointer shadow-subtle"
                      >
                        <span className="h-7 w-7 rounded-full bg-surface text-primary flex items-center justify-center shadow-2xs">
                          <Icon name="users" className="w-4 h-4" />
                        </span>
                        <span>
                          Cast &amp; Guidelines{" "}
                          {projectCharacters.length > 0
                            ? `(${projectCharacters.length})`
                            : ""}
                        </span>
                      </button>
                    </div>

                    <div className="text-left md:text-right">
                      <h3 className="text-lg font-bold text-heading">
                        {activeProject.title}
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Story Project • Status:{" "}
                        <span className="font-bold capitalize text-primary">
                          {activeProject.status}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Middle: Clean Borderless Story Narrative Surface */}
                  <div className="py-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                      Story Narrative
                    </span>
                    <div className="min-h-[110px] text-[15px] sm:text-base text-heading leading-relaxed whitespace-pre-wrap">
                      {activeProject.storyText}
                    </div>
                  </div>

                  {/* Bottom Control Row: Duration/Language Pills + Orientation Toggle Buttons + Sparkle Start CTA */}
                  <div className="pt-5 border-t border-theme flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Duration Dropdown Pill (Clock Icon + Value + Chevron) */}
                      <div className="relative inline-flex items-center rounded-full bg-primary-tint border border-theme px-3.5 min-h-[46px]">
                        <Icon
                          name="clock"
                          className="w-4 h-4 text-primary mr-2 shrink-0"
                        />
                        <select
                          value={selectedTargetDuration}
                          onChange={(e) =>
                            setSelectedTargetDuration(e.target.value)
                          }
                          className="bg-transparent text-xs sm:text-sm font-bold text-heading pr-5 py-2 focus:outline-none appearance-none cursor-pointer"
                          aria-label="Target Song Duration"
                        >
                          <option value="180">3m Studio (180s)</option>
                          <option value="120">2m Song (120s)</option>
                          <option value="90">90s Track</option>
                          <option value="60">60s Track</option>
                          <option value="30">30s Reel</option>
                        </select>
                        <Icon
                          name="chevron-down"
                          className="w-3.5 h-3.5 text-primary pointer-events-none -ml-3.5"
                        />
                      </div>

                      {/* Language Dropdown Pill */}
                      <div className="relative inline-flex items-center rounded-full bg-primary-tint border border-theme px-3.5 min-h-[46px]">
                        <Icon
                          name="globe"
                          className="w-4 h-4 text-primary mr-2 shrink-0"
                        />
                        <select
                          value={selectedLanguage}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          className="bg-transparent text-xs sm:text-sm font-bold text-heading pr-5 py-2 focus:outline-none appearance-none cursor-pointer"
                          aria-label="Story Language"
                        >
                          {languages.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.flag} {l.name} ({l.nativeName})
                            </option>
                          ))}
                        </select>
                        <Icon
                          name="chevron-down"
                          className="w-3.5 h-3.5 text-primary pointer-events-none -ml-3.5"
                        />
                      </div>

                      {/* Two Orientation Toggle Buttons (Selected = Lavender Fill + Violet/Indigo 2px Outline) */}
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPreset("1080p")}
                          className={`min-h-[46px] px-3.5 py-2 rounded-control inline-flex items-center gap-1.5 text-xs sm:text-sm transition-all cursor-pointer ${
                            selectedPreset !== "mobile"
                              ? "bg-primary-soft border-2 border-primary text-primary font-bold"
                              : "bg-surface border border-theme text-body font-medium hover:bg-primary-tint"
                          }`}
                          title="Landscape 16:9 Format"
                        >
                          <Icon name="monitor" className="w-4 h-4" />
                          <span>16:9</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPreset("mobile")}
                          className={`min-h-[46px] px-3.5 py-2 rounded-control inline-flex items-center gap-1.5 text-xs sm:text-sm transition-all cursor-pointer ${
                            selectedPreset === "mobile"
                              ? "bg-primary-soft border-2 border-primary text-primary font-bold"
                              : "bg-surface border border-theme text-body font-medium hover:bg-primary-tint"
                          }`}
                          title="Vertical 9:16 Mobile Format"
                        >
                          <Icon name="phone" className="w-4 h-4" />
                          <span>9:16</span>
                        </button>
                      </div>
                    </div>

                    {/* Flexible Primary Start / Analyze Button with Sparkle Icon */}
                    <button
                      type="button"
                      onClick={handleAnalyzeStory}
                      disabled={loading}
                      className="ui-btn-primary lg:min-w-[270px]"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />
                      <span>
                        {loading
                          ? `Analyzing in ${getLanguageShort(selectedLanguage)}...`
                          : `Analyze Story Narrative (${getLanguageShort(selectedLanguage)})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Gemini Analysis Summary Card */}
                {activeProject.activeStoryAnalysisId && (
                  <div className="rounded-card bg-primary-soft/75 border border-pastel-lavender p-6 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-base text-primary flex items-center gap-2">
                        <Icon name="sparkles" className="w-4 h-4" />
                        <span>Gemini Analysis Summary</span>
                      </h4>
                      <span className="ui-chip bg-surface border-theme text-primary">
                        {getLanguageShort(
                          activeProject.language || selectedLanguage
                        )}
                      </span>
                    </div>
                    <p className="text-heading leading-relaxed">
                      {activeProject.activeStoryAnalysisId.summary}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeProject.activeStoryAnalysisId.themes?.map(
                        (t, idx) => (
                          <span
                            key={idx}
                            className="bg-surface text-primary border border-pastel-lavender text-xs font-bold px-3 py-1 rounded-full"
                          >
                            #{t}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Cast & Characters (Visual Consistency Anchor) */}
                <div
                  ref={castSectionRef}
                  className="ui-card p-6 sm:p-7 space-y-5 scroll-mt-20"
                >
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="font-bold text-heading text-lg flex items-center gap-2">
                        <Icon name="users" className="w-5 h-5 text-primary" />
                        <span>Cast &amp; Characters (Visual Consistency)</span>
                      </h4>
                      <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                        {projectCharacters.length}{" "}
                        {projectCharacters.length === 1
                          ? "Character"
                          : "Characters"}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1 leading-relaxed">
                      Anchor key people with specific physical appearance and attire. Gemini will inject these descriptions into every scene prompt featuring them, ensuring face and outfit consistency throughout your video.
                    </p>
                  </div>

                  {/* Characters List */}
                  {projectCharacters.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {projectCharacters.map((c, idx) => (
                        <div
                          key={idx}
                          className="bg-primary-tint border border-theme rounded-[18px] p-4 flex flex-col justify-between space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-tile bg-indigo-tile text-white flex items-center justify-center font-bold text-sm shrink-0">
                                {c.name ? c.name.charAt(0).toUpperCase() : "C"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-heading truncate">
                                  {c.name}
                                </div>
                                {c.role && (
                                  <div className="text-xs font-semibold text-primary truncate">
                                    {c.role}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTabCharacter(idx)}
                              className="h-8 w-8 rounded-full hover:bg-danger-tint text-muted hover:text-danger flex items-center justify-center transition cursor-pointer shrink-0"
                              title="Remove character"
                              aria-label={`Remove ${c.name}`}
                            >
                              <Icon name="close" className="w-4 h-4" />
                            </button>
                          </div>
                          {c.visualDescription && (
                            <p className="text-xs text-body bg-surface p-2.5 rounded-tile border border-theme italic">
                              "{c.visualDescription}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-primary-tint/70 border border-dashed border-pastel-lavender rounded-card p-5 text-center text-sm text-muted">
                      No characters added yet. Add key people below (e.g. bride, groom, speakers, VIPs, birthday child) so AI keeps their appearance consistent.
                    </div>
                  )}

                  {/* Add Character Form */}
                  <form
                    onSubmit={handleAddTabCharacter}
                    className="bg-primary-tint/60 border border-theme rounded-card p-5 space-y-4"
                  >
                    <span className="text-sm font-bold text-heading block">
                      + Add Character to Cast
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="ui-label-sm">Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Priya"
                          value={tabCharName}
                          onChange={(e) => setTabCharName(e.target.value)}
                          className="ui-input-compact"
                        />
                      </div>
                      <div>
                        <label className="ui-label-sm">Role in Event</label>
                        <input
                          type="text"
                          placeholder="e.g. Bride / Keynote Speaker"
                          value={tabCharRole}
                          onChange={(e) => setTabCharRole(e.target.value)}
                          className="ui-input-compact"
                        />
                      </div>
                      <div>
                        <label className="ui-label-sm">
                          Visual Appearance &amp; Attire
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 28yo woman in red embroidered lehenga"
                          value={tabCharDesc}
                          onChange={(e) => setTabCharDesc(e.target.value)}
                          className="ui-input-compact"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingCastGuidelines || !tabCharName.trim()}
                        className="ui-btn-primary-sm"
                      >
                        <Icon name="plus" className="w-4 h-4" />
                        <span>
                          {savingCastGuidelines
                            ? "Saving..."
                            : "Add Character to Cast"}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Director Guidelines & Must-Have Scenes */}
                <div className="ui-card p-6 sm:p-7 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-heading text-lg flex items-center gap-2">
                        <Icon name="studio" className="w-5 h-5 text-primary" />
                        <span>Director Guidelines &amp; Must-Have Scenes</span>
                      </h4>
                      <p className="text-sm text-muted mt-1">
                        Specify required scenes, key milestones, or camera actions you want Gemini to prioritize when generating the synchronized storyboard.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveGuidelines}
                      disabled={savingCastGuidelines}
                      className="ui-btn-secondary-sm text-primary shrink-0 self-start sm:self-center"
                    >
                      <Icon name="check" className="w-4 h-4" />
                      <span>
                        {savingCastGuidelines ? "Saving..." : "Save Guidelines"}
                      </span>
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    value={projectDirectorGuidelines}
                    onChange={(e) =>
                      setProjectDirectorGuidelines(e.target.value)
                    }
                    placeholder="e.g. 1. Grand welcome and arrival. 2. Stage garland exchange. 3. Family group toast with champagne. 4. Lantern lighting at dusk."
                    className="ui-textarea"
                  />
                </div>

                {/* Gradient-Faded Scene Ideas / Visual Showcase Section (White to Very Pale Mint) */}
                {(activeProject.activeStoryboardId?.scenes?.length > 0 ||
                  mediaItems.length > 0) && (
                  <div className="bg-mint-fade rounded-container border border-theme p-6 sm:p-8 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-heading">
                          Story Visual Highlights
                        </h3>
                        <p className="text-sm text-muted mt-0.5">
                          Preview your story scenes and uploaded event moments.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab(
                            activeProject.activeStoryboardId
                              ? "storyboard"
                              : "media"
                          )
                        }
                        className="ui-btn-secondary-sm text-primary self-start sm:self-center"
                      >
                        <span>Open Full Timeline</span>
                        <Icon name="arrow-right" className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(activeProject.activeStoryboardId?.scenes?.slice(0, 4) ||
                        mediaItems.slice(0, 4)
                      ).map((entry, i) => {
                        const isScene = entry.sceneNumber !== undefined;
                        const media = isScene
                          ? mediaItems.find(
                              (m) =>
                                m._id === entry.mediaId ||
                                m._id === entry.mediaId?._id
                            ) || mediaItems[i % Math.max(1, mediaItems.length)]
                          : entry;
                        const isVideo =
                          media &&
                          (media.mediaType === "video" ||
                            [".mp4", ".webm", ".mov"].some((ext) =>
                              media.fileUrl?.toLowerCase().endsWith(ext)
                            ));

                        return (
                          <div
                            key={i}
                            className="rounded-card bg-surface border border-theme overflow-hidden shadow-subtle"
                          >
                            <div className="h-44 bg-primary-tint relative overflow-hidden">
                              {media ? (
                                isVideo ? (
                                  <video
                                    src={media.fileUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    loop
                                    autoPlay
                                  />
                                ) : (
                                  <img
                                    src={media.fileUrl}
                                    alt="Scene preview"
                                    className="w-full h-full object-cover"
                                  />
                                )
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted text-xs font-semibold">
                                  AI Visual Scene
                                </div>
                              )}
                              <span className="ui-badge-overlay absolute top-3 left-3">
                                {isScene
                                  ? `Scene ${entry.sceneNumber} • ${
                                      isVideo ? "Video" : "Photo"
                                    }`
                                  : isVideo
                                    ? "Video"
                                    : "Photo"}
                              </span>
                            </div>
                            {isScene && (
                              <div className="p-4">
                                <p className="text-sm font-bold text-heading line-clamp-1">
                                  {entry.lyricSnippet ||
                                    entry.captionText ||
                                    `Scene ${entry.sceneNumber}`}
                                </p>
                                <p className="text-xs text-muted line-clamp-1 mt-0.5">
                                  {entry.visualPrompt}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: AI LYRICS & MUSIC */}
            {activeTab === "lyrics" && (
              <div className="space-y-6">
                <div className="ui-container p-6 sm:p-8 space-y-6">
                  <div className="border-b border-theme pb-4">
                    <h3 className="text-xl font-bold text-heading">
                      Compose AI Lyrics &amp; Studio Vocal Track
                    </h3>
                    <p className="text-sm text-muted mt-1">
                      Configure your music engine, genre, duration, language, and vocal style.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="ui-label-sm">Music Model Engine</label>
                      <select
                        value={selectedMusicProvider}
                        onChange={(e) =>
                          setSelectedMusicProvider(e.target.value)
                        }
                        className="ui-select"
                      >
                        <option value="google_lyria">
                          Google DeepMind Lyria 3 Pro (Full Vocals &amp; Song)
                        </option>
                        <option value="elevenlabs">
                          ElevenLabs Music Synthesis
                        </option>
                        <option value="suno">Suno AI Music</option>
                        <option value="google_tts">
                          Google Cloud Neural2 TTS + Rhythm Synth
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="ui-label-sm">
                        Musical Style / Genre
                      </label>
                      <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="ui-select"
                      >
                        <optgroup label="Pop, Dance & Contemporary">
                          <option value="Pop">Pop (Vibrant &amp; Catchy)</option>
                          <option value="Indie Pop">
                            Indie Pop (Dreamy &amp; Melodic)
                          </option>
                          <option value="EDM / Dance Pop">
                            EDM / Dance Pop (High-Energy Club Beats)
                          </option>
                          <option value="Synthwave / Electro">
                            Synthwave / Electro (Retro-Futuristic)
                          </option>
                        </optgroup>
                        <optgroup label="Bollywood, Hinglish & Indian">
                          <option value="Bollywood Pop">
                            Bollywood Pop (Upbeat &amp; Filmy Hooks)
                          </option>
                          <option value="Wedding Sangeet / Punjabi Dhol">
                            Wedding Sangeet / Punjabi Dhol (Festive Bhangra)
                          </option>
                          <option value="Bollywood Romantic">
                            Bollywood Romantic (Soulful Filmy Ballad)
                          </option>
                          <option value="Sufi / Indie Fusion">
                            Sufi / Indie Fusion (Acoustic Guitar, Tabla &amp; Soul)
                          </option>
                          <option value="Indian Classical / Traditional">
                            Indian Classical / Traditional (Sitar, Flute &amp; Raga)
                          </option>
                        </optgroup>
                        <optgroup label="Acoustic, Folk & Soul">
                          <option value="Acoustic">
                            Acoustic (Warm &amp; Organic Guitar/Piano)
                          </option>
                          <option value="Folk / Indie Folk">
                            Folk / Indie Folk (Storytelling &amp; Earthy)
                          </option>
                          <option value="R&B / Soul">
                            R&amp;B / Soul (Smooth Groove &amp; Expressive Vocals)
                          </option>
                          <option value="Jazz / Lounge">
                            Jazz / Lounge (Sophisticated Brass &amp; Piano)
                          </option>
                          <option value="Country">
                            Country (Warm Strumming &amp; Heartfelt)
                          </option>
                        </optgroup>
                        <optgroup label="Cinematic, Rock & Urban">
                          <option value="Cinematic">
                            Cinematic (Epic Orchestral &amp; Score)
                          </option>
                          <option value="Rock">
                            Rock (Energetic &amp; Dynamic Electric Guitars)
                          </option>
                          <option value="Hip-Hop / Rap">
                            Hip-Hop / Rap (Rhythmic Flow &amp; Beats)
                          </option>
                          <option value="Lo-Fi Chill">
                            Lo-Fi Chill (Relaxed Beats &amp; Warm Vinyl)
                          </option>
                          <option value="Uplifting Choir / Gospel">
                            Uplifting Choir / Gospel (Anthemic &amp; Inspiring)
                          </option>
                        </optgroup>
                      </select>
                    </div>

                    <div>
                      <label className="ui-label-sm">Target Song Duration</label>
                      <select
                        value={selectedTargetDuration}
                        onChange={(e) =>
                          setSelectedTargetDuration(e.target.value)
                        }
                        className="ui-select"
                      >
                        <option value="180">Full Studio Song (180 sec / 3 min)</option>
                        <option value="120">Studio Song (120 sec / 2 min)</option>
                        <option value="90">Extended Track (90 sec)</option>
                        <option value="60">Standard Track (60 sec)</option>
                        <option value="30">Short Clip / Reel (30 sec)</option>
                      </select>
                    </div>

                    <div>
                      <label className="ui-label-sm">
                        Lyrics &amp; Vocal Language
                      </label>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="ui-select"
                      >
                        {languages.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.flag} {l.name} ({l.nativeName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="ui-label-sm">Vocal Voice Type</label>
                      <select
                        value={selectedVoiceType}
                        onChange={(e) => handleVoiceTypeChange(e.target.value)}
                        className="ui-select"
                      >
                        <option value="female">Female Lead Vocals</option>
                        <option value="male">Male Lead Vocals</option>
                        <option value="duet">
                          Duet (Male &amp; Female Vocals)
                        </option>
                        <option value="custom">Custom Voice / Timbre</option>
                      </select>
                    </div>
                  </div>

                  {selectedVoiceType === "custom" && (
                    <div className="bg-primary-tint border border-pastel-lavender rounded-card p-5 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-primary">
                        <Icon name="music" className="w-4 h-4" />
                        <span>
                          Custom Vocal Style &amp; Timbre Specifications
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="ui-label-sm">
                            Vocal Performance Style / Timbre Description
                          </label>
                          <input
                            type="text"
                            value={customVoicePrompt}
                            onChange={(e) =>
                              setCustomVoicePrompt(e.target.value)
                            }
                            placeholder="e.g. Warm raspy indie folk baritone, soulful R&B soprano"
                            className="ui-input"
                          />
                          <p className="text-xs text-muted mt-1">
                            Directly conditions Lyria 3 Pro singing style and timbre
                          </p>
                        </div>
                        {selectedMusicProvider === "elevenlabs" && (
                          <div>
                            <label className="ui-label-sm">
                              ElevenLabs Custom Voice ID (Optional)
                            </label>
                            <input
                              type="text"
                              value={customVoiceId}
                              onChange={(e) => setCustomVoiceId(e.target.value)}
                              placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                              className="ui-input font-mono"
                            />
                            <p className="text-xs text-muted mt-1">
                              Overrides default ElevenLabs voice
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleGenerateLyrics}
                      disabled={loading}
                      className="ui-btn-primary"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />
                      <span>
                        {loading
                          ? `Synthesizing in ${getLanguageShort(selectedLanguage)}...`
                          : `Generate AI Lyrics & Song (${getLanguageShort(selectedLanguage)})`}
                      </span>
                    </button>
                  </div>
                </div>

                {activeProject.activeSongId && (
                  <div className="space-y-4">
                    {/* Fallback Warning Notice */}
                    {activeProject.activeSongId.isFallback && (
                      <div className="bg-pastel-peach/75 border border-warning/35 text-heading p-5 rounded-card flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-start gap-3 max-w-2xl">
                          <Icon
                            name="alert"
                            className="w-5 h-5 text-warning shrink-0 mt-0.5"
                          />
                          <div>
                            <div className="font-bold text-sm text-heading">
                              Generated via Backup Vocal Synthesizer (
                              {activeProject.activeSongId.durationSeconds || 30}
                              s)
                            </div>
                            <p className="text-xs text-body mt-1">
                              {activeProject.activeSongId.fallbackReason
                                ? `Lyria 3 Pro was temporarily busy (${activeProject.activeSongId.fallbackReason}). A rhythmic backing vocal track was synthesized instead.`
                                : "Lyria 3 Pro was temporarily busy, so the backup vocal synthesizer created this track."}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateLyrics}
                          disabled={loading}
                          className="ui-btn-primary-sm"
                        >
                          <span>Retry with Lyria 3 Pro (~3 min)</span>
                        </button>
                      </div>
                    )}

                    {/* Soundtrack Audio Player Card */}
                    {activeProject.activeSongId.audioUrl && (
                      <div className="bg-pastel-mint border border-theme p-5 rounded-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="h-8 w-8 rounded-tile bg-surface text-primary flex items-center justify-center">
                              <Icon name="music" className="w-4 h-4" />
                            </span>
                            <span className="text-sm font-bold text-heading">
                              Soundtrack Ready
                            </span>
                          </div>
                          <p className="text-xs text-body font-medium">
                            {activeProject.activeSongId.isFallback
                              ? "Backup Vocal Synthesizer"
                              : activeProject.activeSongId.provider?.includes(
                                    "lyria"
                                  )
                                ? "Google DeepMind Lyria 3 Pro"
                                : activeProject.activeSongId.provider ||
                                  "Studio Audio"}
                            {" • "}
                            {activeProject.activeSongId.durationSeconds
                              ? activeProject.activeSongId.durationSeconds >= 60
                                ? `${Math.floor(
                                    activeProject.activeSongId.durationSeconds /
                                      60
                                  )}m ${
                                    activeProject.activeSongId.durationSeconds %
                                    60
                                  }s`
                                : `${activeProject.activeSongId.durationSeconds}s`
                              : "30s"}
                            {" • "}
                            {activeProject.activeSongId.voiceType === "male"
                              ? "Male Vocals"
                              : activeProject.activeSongId.voiceType === "duet"
                                ? "Duet Vocals"
                                : activeProject.activeSongId.voiceType ===
                                    "custom"
                                  ? "Custom Voice"
                                  : "Female Vocals"}
                          </p>
                        </div>
                        <audio
                          controls
                          src={activeProject.activeSongId.audioUrl}
                          className="h-11 w-full md:w-80"
                        />
                      </div>
                    )}

                    {/* Generated Lyrics Card */}
                    <div className="ui-card p-6 sm:p-7 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme pb-3">
                        <h4 className="font-bold text-lg text-heading">
                          Generated AI Lyrics
                        </h4>
                        <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                          <span>
                            {activeProject.activeSongId.genre} •{" "}
                            {activeProject.activeSongId.mood}
                          </span>
                          <span>•</span>
                          <span>
                            {getLanguageShort(
                              activeProject.activeSongId.language ||
                                selectedLanguage
                            )}
                          </span>
                        </span>
                      </div>
                      <pre className="text-sm text-heading whitespace-pre-wrap font-sans leading-relaxed bg-primary-tint/55 p-5 rounded-[18px] border border-theme">
                        {activeProject.activeSongId.lyrics}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EVENT PHOTOS & MEDIA GALLERY (Gradient-Faded White to Pale Mint Section + Dark Translucent Badges) */}
            {activeTab === "media" && (
              <div className="bg-mint-fade rounded-container border border-theme p-6 sm:p-8 space-y-6 shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-heading">
                      Event Photos &amp; Video Clips ({mediaItems.length})
                    </h3>
                    <p className="text-sm text-muted mt-1">
                      Upload photos or video clips (.mp4, .mov). If no media is uploaded, AI generates scene visuals automatically.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {mediaItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllMedia}
                        className="ui-btn-danger"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                        <span>Clear All Media</span>
                      </button>
                    )}
                    <label className="ui-btn-primary-sm cursor-pointer">
                      <Icon name="upload" className="w-4 h-4" />
                      <span>
                        {uploadingMedia
                          ? "Uploading..."
                          : "Upload Photo / Video Clip"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaItems.map((item) => {
                    const isVideo =
                      item.mediaType === "video" ||
                      [".mp4", ".webm", ".mov"].some((ext) =>
                        item.fileUrl?.toLowerCase().endsWith(ext)
                      );
                    return (
                      <div
                        key={item._id}
                        className="aspect-square bg-surface rounded-card overflow-hidden border border-theme shadow-subtle relative group"
                      >
                        {isVideo ? (
                          <video
                            src={item.fileUrl}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            autoPlay
                          />
                        ) : (
                          <img
                            src={item.fileUrl}
                            alt="Event media"
                            className="w-full h-full object-cover"
                          />
                        )}
                        {/* Dark Translucent Uppercase Category Badge */}
                        <span className="ui-badge-overlay absolute top-3 left-3">
                          {isVideo ? "VIDEO" : "PHOTO"}
                          {item.aspectRatio ? ` • ${item.aspectRatio}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(item._id)}
                          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-danger text-white shadow flex items-center justify-center hover:bg-danger/90 transition opacity-90 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                          title="Delete media"
                          aria-label="Delete media"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  {mediaItems.length === 0 && (
                    <div className="col-span-full text-center py-12 px-6 border-2 border-dashed border-primary/25 bg-surface/85 rounded-card space-y-4">
                      <span className="mx-auto h-12 w-12 rounded-full bg-primary-soft text-primary flex items-center justify-center">
                        <Icon name="sparkles" className="w-6 h-6" />
                      </span>
                      <div className="space-y-1.5">
                        <p className="font-bold text-base text-heading">
                          Pure AI Scene Generation Mode Active
                        </p>
                        <p className="text-sm text-muted max-w-xl mx-auto">
                          No media uploaded. In Tab 4, click{" "}
                          <strong className="text-primary">
                            "Sync Storyboard with Song Lyrics"
                          </strong>{" "}
                          and Google Gemini AI will automatically generate photorealistic visual scenes for every moment.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("storyboard")}
                        className="ui-btn-primary-sm"
                      >
                        <Icon name="music" className="w-4 h-4" />
                        <span>Proceed to Tab 4 (Sync Storyboard)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: STORYBOARD */}
            {activeTab === "storyboard" && (
              <div className="space-y-6">
                <div className="ui-card p-6 sm:p-7 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-bold text-heading">
                          Scene Storyboard &amp; Lyric Timeline
                        </h3>
                        {activeProject.activeSongId &&
                          (() => {
                            const timing = summarizeStoryboardTiming(
                              activeProject.activeStoryboardId?.scenes || [],
                              activeProject.activeSongId.durationSeconds || 30
                            );
                            return (
                              <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                                <span>{timing.totalSec}s Audio</span>
                                <span>•</span>
                                <span>
                                  {timing.count}{" "}
                                  {timing.count === 1 ? "Scene" : "Scenes"} (
                                  {timing.perSceneLabel} each)
                                </span>
                                <span>•</span>
                                <span>
                                  {getLanguageShort(
                                    activeProject.language || selectedLanguage
                                  )}
                                </span>
                              </span>
                            );
                          })()}
                      </div>
                      <p className="text-sm text-muted">
                        Each scene is synchronized to the song lyrics with natural 5-6s cuts matching AI motion video duration so clips never repeat.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Multi-Aspect Ratio Switcher (Each Aspect Ratio Preserves Its Own Frames & Video Clips) */}
                      <div
                        className="inline-flex items-center gap-1 bg-primary-tint border border-theme rounded-full p-1"
                        title="Switch active aspect ratio — each aspect ratio saves its own frames & video clips without overriding others"
                      >
                        {[
                          { presetId: "1080p", label: "16:9" },
                          { presetId: "mobile", label: "9:16" },
                          { presetId: "square", label: "1:1" },
                          { presetId: "tablet", label: "4:3" }
                        ].map((opt) => {
                          const currentAspect =
                            videoPresets[selectedPreset]?.aspectRatio || "16:9";
                          const active = currentAspect === opt.label;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => setSelectedPreset(opt.presetId)}
                              className={`px-2.5 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                                active
                                  ? "bg-primary text-white shadow-2xs"
                                  : "text-heading hover:bg-primary-soft"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerateAllImages(true)}
                        disabled={
                          generatingAllImages ||
                          loading ||
                          !activeProject.activeStoryboardId
                        }
                        className="ui-btn-secondary-sm text-primary"
                        title="Synthesize Google AI images for the selected aspect ratio (preserves other aspect ratios)"
                      >
                        <Icon name="image" className="w-4 h-4" />
                        <span>
                          {generatingAllImages
                            ? "Generating AI Images..."
                            : `Generate ${videoPresets[selectedPreset]?.aspectRatio || "16:9"} Images`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateAllVeo(false)}
                        disabled={
                          generatingAllVeo ||
                          loading ||
                          !activeProject.activeStoryboardId
                        }
                        className="ui-btn-secondary-sm border-primary text-primary bg-primary-soft/50"
                      >
                        <Icon name="sparkles" className="w-4 h-4" />
                        <span>
                          {generatingAllVeo
                            ? "Generating Omni Clips..."
                            : `Generate ${videoPresets[selectedPreset]?.aspectRatio || "16:9"} Omni Clips`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateStoryboard}
                        disabled={loading}
                        className="ui-btn-primary-sm"
                      >
                        <Icon name="music" className="w-4 h-4" />
                        <span>
                          {loading
                            ? "Synchronizing Storyboard..."
                            : "Sync Storyboard with Song Lyrics"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {activeProject.activeStoryboardId && (
                  <div className="bg-mint-fade rounded-container border border-theme p-6 sm:p-7 space-y-5">
                    {activeProject.activeStoryboardId.scenes?.some((s, sIdx) => {
                      const activeAspect =
                        videoPresets[selectedPreset]?.aspectRatio || "16:9";
                      const m = resolveSceneMediaForAspect(
                        s,
                        activeAspect,
                        mediaItems,
                        sIdx
                      );
                      return (
                        !m ||
                        (m.mediaType !== "video" &&
                          ![".mp4", ".webm", ".mov"].some((ext) =>
                            m.fileUrl?.toLowerCase().endsWith(ext)
                          ))
                      );
                    }) && (
                      <div className="bg-surface/90 border border-pastel-lavender text-heading px-5 py-3.5 rounded-card text-xs sm:text-sm flex items-center gap-3 shadow-subtle">
                        <Icon
                          name="sparkles"
                          className="w-5 h-5 text-primary shrink-0"
                        />
                        <span>
                          <strong>Pro Tip:</strong> Viewing{" "}
                          <strong className="text-primary">
                            {videoPresets[selectedPreset]?.aspectRatio || "16:9"}
                          </strong>{" "}
                          scenes (other aspect ratios stay saved separately). Click{" "}
                          <strong className="text-primary">
                            "Generate {videoPresets[selectedPreset]?.aspectRatio || "16:9"} Omni Clips"
                          </strong>{" "}
                          to create motion video for this aspect ratio without overriding others.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {activeProject.activeStoryboardId.scenes?.map(
                        (scene, idx) => {
                          const activeAspect =
                            videoPresets[selectedPreset]?.aspectRatio || "16:9";
                          const activeSlotKey =
                            aspectRatioToSlotKey(activeAspect);
                          const media = resolveSceneMediaForAspect(
                            scene,
                            activeAspect,
                            mediaItems,
                            idx
                          );
                          const savedAspects = getSavedAspectsForScene(scene);
                          const isPortraitPreview =
                            activeAspect === "9:16" || activeAspect === "1:1";
                          const isVideoMedia =
                            media &&
                            (media.mediaType === "video" ||
                              [".mp4", ".webm", ".mov"].some((ext) =>
                                media.fileUrl?.toLowerCase().endsWith(ext)
                              ));
                          const sceneDuration = Math.max(
                            1,
                            Math.round(
                              (scene.endTimeSeconds || 5) -
                                (scene.startTimeSeconds || 0)
                            )
                          );

                          return (
                            <div
                              key={idx}
                              className="bg-surface border border-theme rounded-card overflow-hidden shadow-subtle flex flex-col justify-between"
                            >
                              {media ? (
                                <div
                                  className={`${
                                    isPortraitPreview ? "h-64" : "h-48"
                                  } bg-heading/90 overflow-hidden relative group flex items-center justify-center`}
                                >
                                  {isVideoMedia ? (
                                    <video
                                      key={`${media.fileUrl}_${activeAspect}`}
                                      src={media.fileUrl}
                                      className={`w-full h-full ${
                                        isPortraitPreview
                                          ? "object-contain"
                                          : "object-cover"
                                      }`}
                                      muted
                                      loop
                                      autoPlay
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={media.fileUrl}
                                      alt="Scene media"
                                      className={`w-full h-full ${
                                        isPortraitPreview
                                          ? "object-contain"
                                          : "object-cover"
                                      }`}
                                    />
                                  )}
                                  <span className="ui-badge-overlay absolute top-3 left-3">
                                    Scene {scene.sceneNumber} •{" "}
                                    {scene.startTimeSeconds}s-
                                    {scene.endTimeSeconds}s ({sceneDuration}s) •{" "}
                                    {isVideoMedia ? "VIDEO" : "PHOTO"}
                                    {media.aspectRatio
                                      ? ` (${media.aspectRatio})`
                                      : ""}
                                  </span>
                                  {savedAspects.length > 0 && (
                                    <div className="absolute bottom-2.5 right-2.5 flex flex-wrap gap-1">
                                      {savedAspects.map((ar) => (
                                        <span
                                          key={ar}
                                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            ar === activeAspect
                                              ? "bg-primary text-white"
                                              : "bg-surface/90 text-heading"
                                          }`}
                                          title={`Saved ${ar} asset on this scene`}
                                        >
                                          {ar} ✓
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={`${
                                    isPortraitPreview ? "h-64" : "h-48"
                                  } bg-primary-tint relative flex items-center justify-center text-muted text-xs font-semibold`}
                                >
                                  <span className="ui-badge-overlay absolute top-3 left-3">
                                    Scene {scene.sceneNumber} • {sceneDuration}s •{" "}
                                    {activeAspect}
                                  </span>
                                  <span>
                                    Scene {scene.sceneNumber} ({activeAspect})
                                  </span>
                                </div>
                              )}

                              <div className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                  {/* Song Lyrics */}
                                  {scene.lyricSnippet && (
                                    <div className="bg-primary-soft/80 border border-pastel-lavender p-3 rounded-[16px]">
                                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                        <Icon
                                          name="music"
                                          className="w-3.5 h-3.5"
                                        />
                                        <span>Song Lyrics</span>
                                      </span>
                                      <p className="text-xs font-semibold text-heading italic mt-1">
                                        "{scene.lyricSnippet}"
                                      </p>
                                    </div>
                                  )}

                                  {/* Characters in Scene */}
                                  {projectCharacters.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Cast in Scene
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {projectCharacters.map((c, cIdx) => {
                                          const isTagged =
                                            scene.characters?.includes(c.name);
                                          return (
                                            <button
                                              key={cIdx}
                                              type="button"
                                              onClick={() =>
                                                handleToggleSceneCharacter(
                                                  idx,
                                                  c.name
                                                )
                                              }
                                              className={`text-xs font-bold px-2.5 py-1 rounded-full transition flex items-center gap-1 border cursor-pointer ${
                                                isTagged
                                                  ? "bg-primary text-white border-primary"
                                                  : "bg-primary-tint text-body border-theme hover:bg-primary-soft"
                                              }`}
                                              title={`Toggle ${c.name} in this scene`}
                                            >
                                              <span>
                                                {isTagged ? "✓" : "+"}
                                              </span>
                                              <span>{c.name}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* Visual Prompt / Action (Editable) */}
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                                        Visual Action / Prompt
                                      </span>
                                      {editingSceneIdx !== idx && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingSceneIdx(idx);
                                            if (
                                              sceneDraftPrompts[idx] ===
                                              undefined
                                            ) {
                                              setSceneDraftPrompts((prev) => ({
                                                ...prev,
                                                [idx]:
                                                  scene.visualPrompt ||
                                                  scene.captionText ||
                                                  ""
                                              }));
                                            }
                                          }}
                                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                        >
                                          Edit Prompt
                                        </button>
                                      )}
                                    </div>

                                    {editingSceneIdx === idx ? (
                                      <div className="space-y-2 pt-0.5">
                                        <textarea
                                          rows={3}
                                          value={
                                            sceneDraftPrompts[idx] !== undefined
                                              ? sceneDraftPrompts[idx]
                                              : scene.visualPrompt ||
                                                scene.captionText ||
                                                ""
                                          }
                                          onChange={(e) =>
                                            setSceneDraftPrompts((prev) => ({
                                              ...prev,
                                              [idx]: e.target.value
                                            }))
                                          }
                                          className="ui-textarea text-xs"
                                          placeholder="Describe the visual action, camera motion, and character behavior for this scene..."
                                        />
                                        {projectCharacters.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-[11px] text-muted font-semibold">
                                              Quick insert:
                                            </span>
                                            {projectCharacters.map(
                                              (c, cIdx) => (
                                                <button
                                                  key={cIdx}
                                                  type="button"
                                                  onClick={() => {
                                                    const desc =
                                                      c.visualDescription
                                                        ? `${c.name} (${c.visualDescription})`
                                                        : c.name;
                                                    setSceneDraftPrompts(
                                                      (prev) => {
                                                        const cur =
                                                          prev[idx] ??
                                                          (scene.visualPrompt ||
                                                            scene.captionText ||
                                                            "");
                                                        return {
                                                          ...prev,
                                                          [idx]: cur
                                                            ? `${cur}, featuring ${desc}`
                                                            : desc
                                                        };
                                                      }
                                                    );
                                                  }}
                                                  className="text-[11px] bg-primary-soft hover:bg-pastel-lavender text-primary px-2 py-0.5 rounded-full font-semibold cursor-pointer"
                                                >
                                                  +{c.name}
                                                </button>
                                              )
                                            )}
                                          </div>
                                        )}
                                        <div className="flex justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingSceneIdx(null)
                                            }
                                            className="text-xs font-semibold text-muted px-3 py-1.5 rounded-full hover:bg-primary-tint cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSaveScenePrompt(idx)
                                            }
                                            disabled={updatingSceneIdx === idx}
                                            className="ui-btn-pill text-xs px-3.5 py-1.5 min-h-[34px]"
                                          >
                                            {updatingSceneIdx === idx
                                              ? "Saving..."
                                              : "Save Prompt"}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-body line-clamp-3 bg-primary-tint/70 p-3 rounded-tile border border-theme">
                                        {sceneDraftPrompts[idx] ||
                                          scene.visualPrompt ||
                                          scene.captionText}
                                      </p>
                                    )}
                                  </div>

                                  {/* Media Source Selector */}
                                  {mediaItems.length > 0 && (
                                    <div>
                                      <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                                        Source Visual Media ({activeAspect})
                                      </label>
                                      <select
                                        value={
                                          scene.mediaByAspect?.[activeSlotKey]
                                            ?.activeMediaId?._id ||
                                          scene.mediaByAspect?.[activeSlotKey]
                                            ?.activeMediaId ||
                                          media?._id ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          handleAssignSceneMedia(
                                            idx,
                                            e.target.value
                                          )
                                        }
                                        className="ui-select-compact w-full text-xs"
                                      >
                                        <option value="">
                                          AI Frame / Default ({activeAspect})
                                        </option>
                                        {mediaItems.map((m, mIdx) => (
                                          <option
                                            key={m._id || mIdx}
                                            value={m._id}
                                          >
                                            {m.originalFilename ||
                                              `Media #${mIdx + 1}`}{" "}
                                            (
                                            {m.mediaType === "video"
                                              ? "Video"
                                              : "Photo"}
                                            {m.aspectRatio
                                              ? ` • ${m.aspectRatio}`
                                              : ""}
                                            )
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                {/* Action Generation Buttons */}
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGenerateSceneImage(
                                        idx,
                                        sceneDraftPrompts[idx] ||
                                          scene.visualPrompt ||
                                          scene.captionText
                                      )
                                    }
                                    disabled={
                                      generatingImageSceneIdx === idx ||
                                      generatingVeoSceneIdx === idx
                                    }
                                    className="ui-btn-secondary-sm px-2.5 text-xs"
                                  >
                                    <Icon
                                      name="image"
                                      className="w-3.5 h-3.5 text-primary"
                                    />
                                    <span>
                                      {generatingImageSceneIdx === idx
                                        ? "Painting..."
                                        : "Regen Image"}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleGenerateVeoScene(
                                        idx,
                                        sceneDraftPrompts[idx] ||
                                          scene.visualPrompt ||
                                          scene.captionText
                                      )
                                    }
                                    disabled={
                                      generatingVeoSceneIdx === idx ||
                                      generatingAllVeo ||
                                      generatingImageSceneIdx === idx
                                    }
                                    className="ui-btn-primary-sm px-2.5 text-xs"
                                  >
                                    <Icon
                                      name="sparkles"
                                      className="w-3.5 h-3.5"
                                    />
                                    <span>
                                      {generatingVeoSceneIdx === idx
                                        ? "Rendering..."
                                        : isVideoMedia
                                          ? "Regen Video"
                                          : "Omni Video"}
                                    </span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: RENDER & VIDEO PLAYER (Summary Plan Card Pattern: 2px Indigo Border, Primary-Tint, Orientation Cards) */}
            {activeTab === "render" && (
              <div className="space-y-6">
                <div className="rounded-container border-2 border-primary bg-primary-tint p-6 sm:p-8 shadow-soft space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-primary flex items-center gap-2.5">
                        <span className="h-10 w-10 rounded-tile bg-indigo-tile text-white flex items-center justify-center shrink-0">
                          <Icon name="rocket" className="w-5 h-5" />
                        </span>
                        <span>Render Professional Event Video</span>
                      </h3>
                      <p className="text-sm text-body mt-1.5">
                        Synthesize AI motion clips, vocal song audio, and synchronized scene captions into your chosen display format.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTriggerRender}
                      disabled={rendering}
                      className="ui-btn-primary shrink-0"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />
                      <span>
                        {rendering
                          ? "Rendering Video..."
                          : `Start Render (${
                              videoPresets[selectedPreset]?.shortLabel ||
                              "Video"
                            })`}
                      </span>
                    </button>
                  </div>

                  {/* Target Display Resolution / Orientation Selector (Selected = Lavender Fill + 2px Primary Outline) */}
                  <div className="space-y-3 pt-4 border-t border-pastel-lavender">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-heading">
                        Choose Target Display &amp; Orientation
                      </span>
                      <span className="ui-chip bg-surface border-theme text-primary">
                        {videoPresets[selectedPreset]?.name} •{" "}
                        {videoPresets[selectedPreset]?.aspectRatio}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {Object.values(videoPresets).map((preset) => {
                        const isSelected = selectedPreset === preset.id;
                        const presetIcon =
                          preset.id === "mobile"
                            ? "phone"
                            : preset.id === "square"
                              ? "square"
                              : "monitor";
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setSelectedPreset(preset.id);
                              const matchingSaved = collectSavedRenderedVideos(
                                activeProject
                              ).find((v) => v.preset === preset.id);
                              if (matchingSaved?._id) {
                                setSelectedVideoPreviewId(
                                  String(matchingSaved._id)
                                );
                              }
                            }}
                            className={`flex flex-col text-left p-4 rounded-card transition-all cursor-pointer ${
                              isSelected
                                ? "bg-primary-soft border-2 border-primary shadow-subtle"
                                : "bg-surface border border-theme hover:border-primary/40"
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-2.5">
                              <span
                                className={`h-9 w-9 rounded-tile flex items-center justify-center ${
                                  isSelected
                                    ? "bg-pastel-lavender text-primary"
                                    : "bg-primary-tint text-primary"
                                }`}
                              >
                                <Icon name={presetIcon} className="w-4 h-4" />
                              </span>
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                  isSelected
                                    ? "bg-primary text-white"
                                    : "bg-primary-tint text-muted"
                                }`}
                              >
                                {preset.aspectRatio}
                              </span>
                            </div>
                            <div
                              className={`font-bold text-sm ${
                                isSelected ? "text-primary" : "text-heading"
                              }`}
                            >
                              {preset.shortLabel || preset.name}
                            </div>
                            <div className="text-xs font-mono text-muted mt-0.5">
                              {preset.width} × {preset.height}
                            </div>
                            <div className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">
                              {preset.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Motion Video vs Static Photo Notice + Spec Summary Box */}
                  {(() => {
                    const targetRenderAspect =
                      videoPresets[selectedPreset]?.aspectRatio || "16:9";
                    const totalScenes =
                      activeProject.activeStoryboardId?.scenes?.length || 0;
                    const videoSceneCount =
                      activeProject.activeStoryboardId?.scenes?.filter(
                        (s, sIdx) => {
                          const m = resolveSceneMediaForAspect(
                            s,
                            targetRenderAspect,
                            mediaItems,
                            sIdx
                          );
                          return (
                            m &&
                            (m.mediaType === "video" ||
                              [".mp4", ".webm", ".mov"].some((ext) =>
                                m.fileUrl?.toLowerCase().endsWith(ext)
                              ))
                          );
                        }
                      ).length || 0;

                    return (
                      <>
                        {totalScenes > 0 && videoSceneCount < totalScenes && (
                          <div className="bg-pastel-peach/75 border border-warning/35 text-heading px-5 py-4 rounded-card text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 max-w-2xl">
                              <Icon
                                name="alert"
                                className="w-5 h-5 text-warning shrink-0"
                              />
                              <span>
                                Currently{" "}
                                <strong>
                                  {totalScenes - videoSceneCount} of{" "}
                                  {totalScenes}
                                </strong>{" "}
                                scenes are still photos. To render full cinematic motion video, switch to the{" "}
                                <strong>Storyboard</strong> tab and click{" "}
                                <strong>
                                  "Generate Omni Video Clips (All)"
                                </strong>
                                .
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveTab("storyboard")}
                              className="ui-btn-secondary-sm text-primary shrink-0"
                            >
                              Go to Storyboard
                            </button>
                          </div>
                        )}

                        {/* Inner Rounded Feature Spec Box */}
                        <div className="bg-surface rounded-card border border-theme p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Total Duration
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              {activeProject.activeSongId?.durationSeconds
                                ? `${activeProject.activeSongId.durationSeconds}s`
                                : activeProject.activeStoryboardId?.scenes
                                  ? `${
                                      activeProject.activeStoryboardId.scenes
                                        .length * 5
                                    }s`
                                  : "30 Seconds"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Visual Format
                            </div>
                            <div className="font-bold text-primary mt-0.5">
                              {videoSceneCount > 0
                                ? `${videoSceneCount}/${totalScenes} Omni Videos`
                                : "Static Photos"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Audio Track
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              Lyria 3 Pro Studio Song
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Target Resolution
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              {videoPresets[selectedPreset]?.shortLabel ||
                                "1080p"}{" "}
                              ({videoPresets[selectedPreset]?.width}×
                              {videoPresets[selectedPreset]?.height})
                            </div>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <div className="text-xs text-muted font-medium">
                              Language &amp; Subtitles
                            </div>
                            <div className="font-bold text-primary mt-0.5 truncate">
                              {getLanguageShort(
                                activeProject.language || selectedLanguage
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Render Progress Bar with Running Accent-Violet State */}
                  {activeJob && rendering && (
                    <div className="space-y-2.5 pt-4 border-t border-pastel-lavender">
                      <div className="flex justify-between text-sm font-bold text-heading">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-accent-violet animate-pulse" />
                          <span>{activeJob.currentStepMessage}</span>
                        </span>
                        <span className="text-primary">
                          {activeJob.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-surface border border-theme rounded-full h-3.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${activeJob.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Final Video Preview Player (All Aspect Ratios Preserved) */}
                {(() => {
                  const savedVideos = collectSavedRenderedVideos(activeProject);
                  const activePreviewVideo =
                    savedVideos.find(
                      (v) => String(v._id) === String(selectedVideoPreviewId)
                    ) ||
                    savedVideos.find((v) => v.preset === selectedPreset) ||
                    savedVideos[0] ||
                    null;

                  if (!activePreviewVideo?.videoUrl) return null;

                  return (
                    <div className="ui-card p-6 sm:p-7 space-y-5">
                      {savedVideos.length > 0 && (
                        <div className="bg-primary-tint/70 border border-theme rounded-card p-4 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                              Saved Rendered Formats ({savedVideos.length} Preserved — Never Overridden)
                            </span>
                            <span className="text-xs text-muted">
                              Click any rendered format below to preview or download
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {savedVideos.map((vid, vIdx) => {
                              const isCurrent =
                                String(vid._id || vid.videoUrl) ===
                                String(
                                  activePreviewVideo._id ||
                                    activePreviewVideo.videoUrl
                                );
                              const label =
                                videoPresets[vid.preset]?.shortLabel ||
                                vid.preset ||
                                `Render #${savedVideos.length - vIdx}`;
                              return (
                                <button
                                  key={vid._id || vIdx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedVideoPreviewId(String(vid._id));
                                    if (vid.preset && videoPresets[vid.preset]) {
                                      setSelectedPreset(vid.preset);
                                    }
                                  }}
                                  className={`px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer ${
                                    isCurrent
                                      ? "bg-primary text-white shadow-subtle"
                                      : "bg-surface border border-theme text-heading hover:bg-primary-soft"
                                  }`}
                                >
                                  <span>{label}</span>
                                  {vid.aspectRatio && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] ${
                                        isCurrent
                                          ? "bg-white/20 text-white"
                                          : "bg-primary-soft text-primary"
                                      }`}
                                    >
                                      {vid.aspectRatio}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-theme pb-4">
                        <h4 className="font-bold text-lg text-heading flex items-center gap-2">
                          <Icon
                            name="studio"
                            className="w-5 h-5 text-primary"
                          />
                          <span>Rendered Event Video Preview</span>
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="ui-chip bg-pastel-mint border-theme text-heading">
                            {activePreviewVideo.resolution || "1080p"}
                          </span>
                          {activePreviewVideo.aspectRatio && (
                            <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                              {activePreviewVideo.aspectRatio}
                            </span>
                          )}
                          <span className="ui-chip bg-primary-tint border-theme text-heading">
                            {getLanguageShort(
                              activePreviewVideo.language ||
                                activeProject.language
                            )}
                          </span>
                          <a
                            href={
                              activePreviewVideo.subtitlesUrl ||
                              `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.srt`
                            }
                            download={`subtitles_${
                              activePreviewVideo.preset || "track"
                            }_${
                              activePreviewVideo.language ||
                              activeProject.language ||
                              "en"
                            }.srt`}
                            target="_blank"
                            rel="noreferrer"
                            className="ui-btn-secondary-sm text-xs px-3.5"
                            title="Download SRT subtitle file"
                          >
                            <Icon
                              name="download"
                              className="w-3.5 h-3.5 text-primary"
                            />
                            <span>Subtitles (.srt)</span>
                          </a>
                          <a
                            href={
                              activePreviewVideo.vttUrl ||
                              `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`
                            }
                            download={`subtitles_${
                              activePreviewVideo.preset || "track"
                            }_${
                              activePreviewVideo.language ||
                              activeProject.language ||
                              "en"
                            }.vtt`}
                            target="_blank"
                            rel="noreferrer"
                            className="ui-btn-secondary-sm text-xs px-3.5"
                            title="Download WebVTT subtitle file"
                          >
                            <Icon
                              name="download"
                              className="w-3.5 h-3.5 text-primary"
                            />
                            <span>Subtitles (.vtt)</span>
                          </a>
                          <a
                            href={activePreviewVideo.videoUrl}
                            download={`event_video_${
                              activePreviewVideo.preset || "final"
                            }_${(activePreviewVideo.aspectRatio || "").replace(":", "x")}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="ui-btn-primary-sm text-xs px-4"
                          >
                            <Icon name="download" className="w-4 h-4" />
                            <span>
                              Download {activePreviewVideo.aspectRatio || ""} Video
                            </span>
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-center bg-primary-tint rounded-card p-4 sm:p-6 border border-pastel-lavender">
                        <video
                          key={activePreviewVideo.videoUrl}
                          controls
                          crossOrigin="anonymous"
                          className="max-h-[560px] w-auto max-w-full rounded-[18px] shadow-soft border border-theme bg-black"
                        >
                          <source
                            src={activePreviewVideo.videoUrl}
                            type="video/mp4"
                          />
                          <track
                            kind="subtitles"
                            src={
                              activePreviewVideo.vttUrl ||
                              `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`
                            }
                            srcLang={
                              activePreviewVideo.language ||
                              activeProject.language ||
                              "en"
                            }
                            label={`${getLanguageShort(
                              activePreviewVideo.language ||
                                activeProject.language
                            )} Subtitles`}
                            default
                          />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Bottom Step-by-Step Pipeline Navigation Bar */}
            <div className="ui-card p-4 sm:px-6 flex items-center justify-between gap-3">
              {prevStudioTab ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(prevStudioTab.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="ui-btn-secondary-sm"
                >
                  <Icon name="arrow-left" className="w-4 h-4 text-primary" />
                  <span>
                    Step {prevStudioTab.step}: {prevStudioTab.shortLabel}
                  </span>
                </button>
              ) : (
                <span className="text-xs font-semibold text-muted">
                  Step 1 of {studioTabs.length}
                </span>
              )}

              <span className="hidden md:inline-block text-xs font-semibold text-muted">
                Step {currentStepIdx + 1} of {studioTabs.length} •{" "}
                <strong className="text-primary">
                  {studioTabs[currentStepIdx]?.label}
                </strong>
              </span>

              {nextStudioTab ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(nextStudioTab.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="ui-btn-primary-sm"
                >
                  <span>
                    Next: {nextStudioTab.shortLabel}
                  </span>
                  <Icon name="arrow-right" className="w-4 h-4" />
                </button>
              ) : (
                <span className="ui-chip bg-pastel-mint border-theme text-heading">
                  <Icon
                    name="check-circle"
                    className="w-3.5 h-3.5 text-success"
                  />
                  <span>Final Stage</span>
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Empty State Prompt Card when no Story Project exists yet */
          <div className="ui-container p-8 sm:p-12 text-center space-y-5">
            <div className="flex flex-wrap items-center justify-center gap-3.5 pb-2">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[18px] bg-pastel-mint border-2 border-dashed border-primary/20 text-heading text-xs sm:text-sm font-bold -rotate-2">
                <Icon name="music" className="w-4 h-4 text-primary" />
                <span>AI Lyrics &amp; Vocals</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[18px] bg-primary-soft border-2 border-dashed border-primary/25 text-primary text-xs sm:text-sm font-bold rotate-2">
                <Icon name="users" className="w-4 h-4 text-primary" />
                <span>Cast &amp; Scene Directives</span>
              </span>
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-xl font-bold text-heading">
                No stories created for this event yet
              </h3>
              <p className="text-sm text-muted">
                Turn event memories, speeches, or schedules into a studio vocal song and synchronized MP4 cinema highlight.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedEventId}
              className="ui-btn-primary"
            >
              <Icon name="sparkles" className="w-5 h-5" />
              <span>Create First Story Project</span>
            </button>
          </div>
        )}
      </main>
    </AppShell>
  );
}
