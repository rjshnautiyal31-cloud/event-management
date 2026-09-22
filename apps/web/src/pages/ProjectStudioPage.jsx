import { useState, useEffect } from "react";
import { api, API_BASE } from "../api.js";
import { Navbar } from "../components/Navbar.jsx";
import { EventSwitcherModal } from "../components/EventSwitcherModal.jsx";

export function ProjectStudioPage({ auth, token: propToken }) {
  const token = auth?.token || propToken;
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
    { code: "en", name: "English", nativeName: "English (US)", flag: "🇺🇸" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
    { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
    { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
    { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
    { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
    { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
    { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
    { code: "zh", name: "Chinese", nativeName: "中文 (Mandarin)", flag: "🇨🇳" },
    { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
    { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
    { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
    { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
    { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
    { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
    { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
    { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
    { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" }
  ]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  // Genre & AI Provider State
  const [selectedGenre, setSelectedGenre] = useState("Pop");
  const [selectedMusicProvider, setSelectedMusicProvider] = useState("google_lyria");
  const [selectedTargetDuration, setSelectedTargetDuration] = useState("180");
  const [selectedVoiceType, setSelectedVoiceType] = useState("female");
  const [customVoicePrompt, setCustomVoicePrompt] = useState("");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [generatingVeoSceneIdx, setGeneratingVeoSceneIdx] = useState(null);
  const [generatingAllVeo, setGeneratingAllVeo] = useState(false);

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
  const [projectDirectorGuidelines, setProjectDirectorGuidelines] = useState("");
  const [savingCastGuidelines, setSavingCastGuidelines] = useState(false);

  // Tab 4 Storyboard Scene Edit State
  const [editingSceneIdx, setEditingSceneIdx] = useState(null);
  const [sceneDraftPrompts, setSceneDraftPrompts] = useState({});
  const [generatingImageSceneIdx, setGeneratingImageSceneIdx] = useState(null);
  const [updatingSceneIdx, setUpdatingSceneIdx] = useState(null);

  // Media State
  const [mediaItems, setMediaItems] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Job Polling State
  const [activeJob, setActiveJob] = useState(null);
  const [rendering, setRendering] = useState(false);

  // Video Resolution Presets State
  const [selectedPreset, setSelectedPreset] = useState("1080p");
  const [videoPresets, setVideoPresets] = useState({
    "1080p": { id: "1080p", name: "Desktop Full HD (1080p)", shortLabel: "1080p Full HD", width: 1920, height: 1080, aspectRatio: "16:9", bitrate: "6000k", description: "Crisp 1080p Full HD for monitors, projectors & presentations", icon: "🖥️" },
    "720p": { id: "720p", name: "Desktop HD (720p)", shortLabel: "720p HD", width: 1280, height: 720, aspectRatio: "16:9", bitrate: "3500k", description: "Fast-rendering standard 720p HD", icon: "💻" },
    "mobile": { id: "mobile", name: "Mobile Vertical (9:16)", shortLabel: "Mobile (9:16)", width: 1080, height: 1920, aspectRatio: "9:16", bitrate: "4500k", description: "Vertical 9:16 for smartphones, Reels & TikTok", icon: "📱" },
    "tablet": { id: "tablet", name: "Tablet Display (4:3)", shortLabel: "Tablet (4:3)", width: 1440, height: 1080, aspectRatio: "4:3", bitrate: "4500k", description: "4:3 aspect ratio tailored for iPad & tablet screens", icon: "📲" },
    "square": { id: "square", name: "Social Square (1:1)", shortLabel: "Square (1:1)", width: 1080, height: 1080, aspectRatio: "1:1", bitrate: "4000k", description: "Square 1:1 format for social media feeds", icon: "🔲" }
  });

  useEffect(() => {
    loadEvents();
    loadVideoPresets();
    loadLanguages();
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
    const match = languages.find(l => l.code === code);
    return match ? `${match.flag} ${match.name} (${match.nativeName})` : (code ? code.toUpperCase() : "English");
  }

  function getLanguageShort(code) {
    const match = languages.find(l => l.code === code);
    return match ? `${match.flag} ${match.name}` : (code ? code.toUpperCase() : "English");
  }

  async function loadVideoPresets() {
    try {
      const data = await api("/api/story-video/video-presets", { token });
      if (data?.presets) {
        setVideoPresets(prev => ({
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
      setProjectCharacters(Array.isArray(activeProject.characters) ? activeProject.characters : []);
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
        setActiveProject(prev => prev ? { ...prev, language: newLang } : prev);
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
        setActiveProject(prev => prev ? { ...prev, voiceType: newVoice } : prev);
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
      const data = await api(`/api/story-video/projects?eventId=${eventId}`, { token });
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
      const data = await api(`/api/story-video/projects/${projectId}/media`, { token });
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
      setSuccess("Story Project created with Cast & Directives successfully!");
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
        setActiveProject(prev => prev ? { ...prev, characters: updated } : prev);
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
        setActiveProject(prev => prev ? { ...prev, characters: updated } : prev);
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
      setActiveProject(prev => prev ? { ...prev, directorGuidelines: projectDirectorGuidelines } : prev);
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
      await api(`/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`, {
        token,
        method: "PATCH",
        body: { visualPrompt: newPrompt }
      });
      setSuccess(`Scene ${sceneIdx + 1} visual prompt updated!`);
      setEditingSceneIdx(null);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingSceneIdx(null);
    }
  }

  async function handleToggleSceneCharacter(sceneIdx, charName) {
    if (!activeProject?._id || !activeProject.activeStoryboardId?.scenes) return;
    const scene = activeProject.activeStoryboardId.scenes[sceneIdx];
    if (!scene) return;
    const currentChars = Array.isArray(scene.characters) ? [...scene.characters] : [];
    const hasChar = currentChars.includes(charName);
    const updatedChars = hasChar ? currentChars.filter(c => c !== charName) : [...currentChars, charName];

    try {
      await api(`/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`, {
        token,
        method: "PATCH",
        body: { characters: updatedChars }
      });
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssignSceneMedia(sceneIdx, mediaId) {
    if (!activeProject?._id) return;
    try {
      await api(`/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`, {
        token,
        method: "PATCH",
        body: { mediaId: mediaId || null }
      });
      setSuccess(`Scene ${sceneIdx + 1} media updated!`);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateSceneImage(sceneIdx, prompt) {
    if (!activeProject?._id) return;
    setGeneratingImageSceneIdx(sceneIdx);
    setError("");
    setSuccess(`🎨 Generating AI image frame for Scene ${sceneIdx + 1}...`);
    try {
      await api(`/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}/image`, {
        token,
        method: "POST",
        body: { prompt }
      });
      setSuccess(`🎉 New AI image frame generated for Scene ${sceneIdx + 1}!`);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
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
    setSuccess(`Analyzing story narrative in ${langLabel} with Gemini AI (~10-15s)...`);
    try {
      const analysis = await api(`/api/story-video/projects/${activeProject._id}/analyze`, {
        token,
        method: "POST",
        body: { language: selectedLanguage }
      });
      setSuccess(`Story analyzed with Gemini AI in ${langLabel}!`);
      await loadProjects(selectedEventId);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
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
      const providerLabel = selectedMusicProvider === "google_lyria" ? "Google Lyria 3 Pro" : selectedMusicProvider === "elevenlabs" ? "ElevenLabs" : selectedMusicProvider === "suno" ? "Suno AI" : "Google Cloud TTS";
      const langLabel = getLanguageLabel(selectedLanguage);
      const targetSec = Number(selectedTargetDuration) || 180;
      const targetSecLabel = targetSec >= 120 ? "~3 min full studio song" : `${targetSec}s track`;
      const voiceLabel = selectedVoiceType === "male"
        ? "👨 Male Vocals"
        : selectedVoiceType === "duet"
        ? "👫 Duet Vocals"
        : selectedVoiceType === "custom"
        ? `🎙️ Custom (${customVoicePrompt || customVoiceId || "Vocal Style"})`
        : "👩 Female Vocals";

      setSuccess(`🎵 Composing ${targetSecLabel} (${voiceLabel}) in ${langLabel} with ${providerLabel} (~60-90s)... Generating singing vocals, acoustics & melody.`);

      const songRes = await api(`/api/story-video/projects/${activeProject._id}/lyrics`, {
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
      });
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);

      if (songRes.isFallback) {
        setSuccess(`⚠️ Generated via backup vocal synthesizer (${songRes.durationSeconds ? `${songRes.durationSeconds}s` : "30s"}) as Lyria 3 Pro was temporarily busy. You can retry with Lyria 3 Pro anytime!`);
      } else {
        const mins = songRes.durationSeconds ? Math.floor(songRes.durationSeconds / 60) : 0;
        const secs = songRes.durationSeconds ? songRes.durationSeconds % 60 : 0;
        const durStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        setSuccess(`🎉 Full AI Lyrics & ${providerLabel} song track (${durStr}) generated in ${langLabel} successfully!`);
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
    setGeneratingVeoSceneIdx(sceneIndex);
    setError("");
    setSuccess(`🎬 Generating Gemini Omni 1.1 Flash motion video for Scene ${sceneIndex + 1}... (~30-35s)`);
    try {
      await api(`/api/story-video/projects/${activeProject._id}/scenes/${sceneIndex}/veo`, {
        token,
        method: "POST",
        body: { prompt: customPrompt }
      });
      setSuccess(`🎉 Gemini Omni 1.1 motion video clip ready for Scene ${sceneIndex + 1}!`);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingVeoSceneIdx(null);
    }
  }

  async function handleGenerateAllVeo() {
    if (!activeProject) return;
    setGeneratingAllVeo(true);
    setError("");
    setSuccess("🎬 Generating Gemini Omni 1.1 Flash motion video clips for all scenes (~30-40s per scene)...");
    try {
      const res = await api(`/api/story-video/projects/${activeProject._id}/scenes/generate-all-veo`, {
        token,
        method: "POST"
      });
      setSuccess(`🎉 Gemini Omni 1.1 motion video clips generated for all storyboard scenes!`);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingAllVeo(false);
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
      await api(`/api/story-video/projects/${activeProject._id}/media/${mediaId}`, {
        token,
        method: "DELETE"
      });
      setSuccess("Photo deleted.");
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClearAllMedia() {
    if (!activeProject) return;
    if (!window.confirm("Remove all uploaded photos? The model will automatically generate 16:9 AI scene visuals instead.")) return;
    try {
      await api(`/api/story-video/projects/${activeProject._id}/media`, {
        token,
        method: "DELETE"
      });
      setSuccess("All photos cleared! Storyboard will now generate AI scene images.");
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateStoryboard() {
    if (!activeProject) return;
    setLoading(true);
    setError("");
    try {
      const res = await api(`/api/story-video/projects/${activeProject._id}/storyboard`, {
        token,
        method: "POST",
        body: { targetSceneDuration: 6 }
      });
      setSuccess(`🎉 Storyboard synchronized! Created ${res.scenes?.length || 0} lyric-aligned scenes (~5-6s each) matching your song's duration.`);
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
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
      const { jobId } = await api(`/api/story-video/projects/${activeProject._id}/render`, {
        token,
        method: "POST",
        body: { resolutionPreset: selectedPreset }
      });

      setSuccess(`Video rendering queued for ${videoPresets[selectedPreset]?.shortLabel || selectedPreset}...`);
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
          setSuccess("🎉 Video rendering complete!");
          const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
          setActiveProject(updated);
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

  const selectedEvent = events.find(ev => ev._id === selectedEventId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-16">
      {/* Shared Navbar Header & Hamburger Menu */}
      <Navbar auth={auth} />

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

      {/* Main Studio Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800 w-full flex-1">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A2D59] text-white p-6 rounded-2xl shadow-xl mb-8">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span>🎬</span> Event AI Story-to-Video Studio
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Generate AI lyrics, music tracks, and MP4 videos for your events (Event Admin & Super Admin Access).
          </p>
        </div>

        {/* Event Context Selector */}
        <div className="flex items-center gap-3 bg-white/10 p-2.5 rounded-xl border border-white/20">
          <label className="text-xs font-extrabold uppercase text-slate-200">Event:</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none"
          >
            {events.map((ev) => (
              <option key={ev._id} value={ev._id}>
                {ev.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedEventId}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-lg shadow transition text-xs flex items-center gap-1"
          >
            <span>+</span> Story
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError("")} className="text-rose-500 hover:text-rose-700">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between">
          <span>✅ {success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-500 hover:text-emerald-700">✕</button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Event Projects Selector */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              {selectedEvent ? selectedEvent.title : "Event"} Stories ({projects.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Multiple stories/videos per event supported.</p>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {projects.map((proj) => (
              <button
                key={proj._id}
                onClick={() => setActiveProject(proj)}
                className={`w-full text-left p-3.5 rounded-xl transition border text-sm ${
                  activeProject?._id === proj._id
                    ? "bg-[#0A2D59] text-white border-[#0A2D59] shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate">{proj.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0 ${
                    activeProject?._id === proj._id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {getLanguageShort(proj.language)}
                  </span>
                </div>
                <div className="text-[11px] opacity-75 capitalize mt-0.5">Status: {proj.status}</div>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No stories created for this event yet. Click "+ Story" to create one.
              </div>
            )}
          </div>
        </div>

        {/* Studio Canvas Area */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          {activeProject ? (
            <div>
              {/* Studio Tabs Navigation */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 mb-6">
                {[
                  { id: "story", label: "1. Story Analysis", icon: "📖" },
                  { id: "lyrics", label: "2. AI Lyrics & Audio", icon: "🎵" },
                  { id: "media", label: "3. Event Photos", icon: "🖼️" },
                  { id: "storyboard", label: "4. Storyboard", icon: "🎬" },
                  { id: "render", label: "5. Render Video", icon: "🚀" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? "bg-[#0A2D59] text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <span>{tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Story Input & Analysis */}
              {activeTab === "story" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{activeProject.title}</h3>
                      <div className="text-xs text-slate-500 mt-0.5">Story Project • Status: <span className="font-semibold capitalize text-[#0A2D59]">{activeProject.status}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-600">Language:</label>
                      <select
                        value={selectedLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                      >
                        {languages.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.flag} {l.name} ({l.nativeName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Story Narrative:</label>
                    <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                      {activeProject.storyText}
                    </p>
                  </div>

                  <button
                    onClick={handleAnalyzeStory}
                    disabled={loading}
                    className="bg-[#0A2D59] text-white hover:bg-slate-800 font-bold px-6 py-3 rounded-xl shadow text-sm transition flex items-center gap-2"
                  >
                    <span>✨</span> {loading ? `Analyzing in ${getLanguageShort(selectedLanguage)}...` : `Analyze Story Narrative (${getLanguageShort(selectedLanguage)})`}
                  </button>

                  {activeProject.activeStoryAnalysisId && (
                    <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-[#0A2D59]">Gemini Analysis Summary</h4>
                        <span className="text-xs font-bold bg-blue-200 text-blue-900 px-2.5 py-0.5 rounded-full">
                          🌐 {getLanguageShort(activeProject.language || selectedLanguage)}
                        </span>
                      </div>
                      <p className="text-slate-700">{activeProject.activeStoryAnalysisId.summary}</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {activeProject.activeStoryAnalysisId.themes?.map((t, idx) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Level 1 Control: Cast & Characters (Visual Consistency Anchor) */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[#0A2D59] text-base flex items-center gap-1.5">
                            <span>👥</span> Cast & Characters (Visual Consistency)
                          </h4>
                          <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                            {projectCharacters.length} {projectCharacters.length === 1 ? "Character" : "Characters"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Anchor key people with specific physical appearance and attire. Gemini will inject these descriptions into every scene prompt featuring them, ensuring face and outfit consistency throughout your video.
                        </p>
                      </div>
                    </div>

                    {/* Characters List */}
                    {projectCharacters.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {projectCharacters.map((c, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#0A2D59] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                  {c.name ? c.name.charAt(0).toUpperCase() : "👤"}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900 leading-tight">{c.name}</div>
                                  {c.role && <div className="text-[11px] font-semibold text-indigo-600">{c.role}</div>}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTabCharacter(idx)}
                                className="text-slate-400 hover:text-red-600 text-xs p-1 rounded hover:bg-slate-200 transition"
                                title="Remove character"
                              >
                                ✕
                              </button>
                            </div>
                            {c.visualDescription && (
                              <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200 italic">
                                "{c.visualDescription}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                        No characters added yet. Add key people below (e.g. bride, groom, speakers, VIPs, birthday child) so AI keeps their appearance consistent.
                      </div>
                    )}

                    {/* Add Character Form */}
                    <form onSubmit={handleAddTabCharacter} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-slate-700 block">+ Add Character to Cast:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Priya"
                            value={tabCharName}
                            onChange={(e) => setTabCharName(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Role in Event</label>
                          <input
                            type="text"
                            placeholder="e.g. Bride / Keynote Speaker"
                            value={tabCharRole}
                            onChange={(e) => setTabCharRole(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">Visual Appearance & Attire</label>
                          <input
                            type="text"
                            placeholder="e.g. 28yo woman in red embroidered lehenga, gold jewelry"
                            value={tabCharDesc}
                            onChange={(e) => setTabCharDesc(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59]"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingCastGuidelines || !tabCharName.trim()}
                          className="bg-[#0A2D59] hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow transition disabled:opacity-50"
                        >
                          {savingCastGuidelines ? "Saving..." : "+ Add Character to Cast"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Level 1 Control: Director Guidelines & Must-Have Scenes */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-[#0A2D59] text-base flex items-center gap-1.5">
                          <span>🎬</span> Director Guidelines & Must-Have Scenes
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Specify required scenes, key milestones, or specific camera actions you want Gemini to prioritize when generating the synchronized storyboard.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveGuidelines}
                        disabled={savingCastGuidelines}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs shadow transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {savingCastGuidelines ? "Saving..." : "💾 Save Guidelines"}
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      value={projectDirectorGuidelines}
                      onChange={(e) => setProjectDirectorGuidelines(e.target.value)}
                      placeholder="e.g. 1. Grand welcome and arrival. 2. Stage garland exchange. 3. Family group toast with champagne. 4. Lantern lighting at dusk."
                      className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#0A2D59] transition"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Lyrics & Music */}
              {activeTab === "lyrics" && (
                <div className="space-y-6">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Music Model Engine:</label>
                        <select
                          value={selectedMusicProvider}
                          onChange={(e) => setSelectedMusicProvider(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                        >
                          <option value="google_lyria">🌟 Google DeepMind Lyria 3 Pro (Full Vocals & Song)</option>
                          <option value="elevenlabs">🎵 ElevenLabs Music Synthesis</option>
                          <option value="suno">🎸 Suno AI Music</option>
                          <option value="google_tts">🔊 Google Cloud Neural2 TTS + Rhythm Synth</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Musical Style / Genre:</label>
                        <select
                          value={selectedGenre}
                          onChange={(e) => setSelectedGenre(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                        >
                          <option value="Pop">Pop (Vibrant & Catchy)</option>
                          <option value="Acoustic">Acoustic (Warm & Organic)</option>
                          <option value="Cinematic">Cinematic (Epic & Orchestral)</option>
                          <option value="Rock">Rock (Energetic & Dynamic)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Target Song Duration:</label>
                        <select
                          value={selectedTargetDuration}
                          onChange={(e) => setSelectedTargetDuration(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                        >
                          <option value="180">🌟 Full Studio Song (~3 min)</option>
                          <option value="90">🎵 Extended Track (90 sec)</option>
                          <option value="60">📻 Standard Track (60 sec)</option>
                          <option value="30">⚡ Short Clip / Reel (30 sec)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Lyrics & Vocal Language:</label>
                        <select
                          value={selectedLanguage}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                        >
                          {languages.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.flag} {l.name} ({l.nativeName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">Vocal Voice Type:</label>
                        <select
                          value={selectedVoiceType}
                          onChange={(e) => handleVoiceTypeChange(e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold bg-white focus:ring-2 focus:ring-[#0A2D59]"
                        >
                          <option value="female">👩 Female Lead Vocals</option>
                          <option value="male">👨 Male Lead Vocals</option>
                          <option value="duet">👫 Duet (Male & Female Vocals)</option>
                          <option value="custom">🎙️ Custom Voice / Timbre</option>
                        </select>
                      </div>
                    </div>

                    {selectedVoiceType === "custom" && (
                      <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#0A2D59]">
                          <span>🎙️</span>
                          <span>Custom Vocal Style & Timbre Specifications</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1">
                              Vocal Performance Style / Timbre Description:
                            </label>
                            <input
                              type="text"
                              value={customVoicePrompt}
                              onChange={(e) => setCustomVoicePrompt(e.target.value)}
                              placeholder="e.g. Warm raspy indie folk baritone, soulful R&B soprano with soft vibrato"
                              className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#0A2D59]"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Directly conditions Lyria 3 Pro singing style and timbre</p>
                          </div>
                          {selectedMusicProvider === "elevenlabs" && (
                            <div>
                              <label className="text-xs font-semibold text-slate-600 block mb-1">
                                ElevenLabs Custom Voice ID (Optional):
                              </label>
                              <input
                                type="text"
                                value={customVoiceId}
                                onChange={(e) => setCustomVoiceId(e.target.value)}
                                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM or cloned voice ID"
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:ring-2 focus:ring-[#0A2D59]"
                              />
                              <p className="text-[11px] text-slate-400 mt-1">Overrides default ElevenLabs voice</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleGenerateLyrics}
                        disabled={loading}
                        className="bg-[#0A2D59] hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow transition flex items-center gap-2"
                      >
                        {loading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Synthesizing in {getLanguageShort(selectedLanguage)}...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            Generate AI Lyrics & Song ({getLanguageShort(selectedLanguage)})
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {activeProject.activeSongId && (
                    <div className="space-y-4">
                      {/* Fallback Warning Notice */}
                      {activeProject.activeSongId.isFallback && (
                        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                              <div className="font-bold text-xs uppercase tracking-wider text-amber-800">
                                Generated via Backup Vocal Synthesizer ({activeProject.activeSongId.durationSeconds || 30}s)
                              </div>
                              <p className="text-xs text-amber-700 mt-0.5">
                                {activeProject.activeSongId.fallbackReason
                                  ? `Lyria 3 Pro was temporarily busy (${activeProject.activeSongId.fallbackReason}). A rhythmic backing vocal track was synthesized instead.`
                                  : "Lyria 3 Pro was temporarily busy, so the backup vocal synthesizer created this track."}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleGenerateLyrics}
                            disabled={loading}
                            className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow transition flex items-center gap-1.5"
                          >
                            <span>🔄</span>
                            <span>Retry with Lyria 3 Pro (~3 min)</span>
                          </button>
                        </div>
                      )}

                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-black text-sm text-slate-800">Generated AI Lyrics</h4>
                          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                            <span>{activeProject.activeSongId.genre} • {activeProject.activeSongId.mood}</span>
                            <span>•</span>
                            <span>🌐 {getLanguageShort(activeProject.activeSongId.language || selectedLanguage)}</span>
                          </span>
                        </div>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                          {activeProject.activeSongId.lyrics}
                        </pre>
                      </div>

                      {activeProject.activeSongId.audioUrl && (
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-emerald-950">🎵 Soundtrack Ready:</span>
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-semibold ${activeProject.activeSongId.isFallback ? "bg-amber-200 text-amber-900 border border-amber-300" : "bg-emerald-200 text-emerald-900"}`}>
                              {activeProject.activeSongId.isFallback
                                ? "⚠️ Backup Vocal Synthesizer"
                                : activeProject.activeSongId.provider?.includes("lyria")
                                ? "🌟 Google DeepMind Lyria 3 Pro"
                                : activeProject.activeSongId.provider || "Studio Audio"}
                              {" "}• {activeProject.activeSongId.durationSeconds ? `${Math.floor(activeProject.activeSongId.durationSeconds / 60)}m ${activeProject.activeSongId.durationSeconds % 60}s` : "30s"}
                              {" "}• {activeProject.activeSongId.voiceType === "male"
                                ? "👨 Male Vocals"
                                : activeProject.activeSongId.voiceType === "duet"
                                ? "👫 Duet Vocals"
                                : activeProject.activeSongId.voiceType === "custom"
                                ? "🎙️ Custom Voice"
                                : "👩 Female Vocals"}
                            </span>
                          </div>
                          <audio controls src={activeProject.activeSongId.audioUrl} className="h-9" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Media Gallery */}
              {activeTab === "media" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Event Photos & Video Clips ({mediaItems.length})</h3>
                      <p className="text-xs text-slate-500">Upload photos or video clips (.mp4, .mov). If no media is uploaded, AI generates 16:9 scene visuals!</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {mediaItems.length > 0 && (
                        <button
                          onClick={handleClearAllMedia}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-2 rounded-xl text-xs border border-rose-200 transition"
                        >
                          Clear All Media (Use AI Scenes)
                        </button>
                      )}
                      <label className="bg-[#0A2D59] text-white hover:bg-slate-800 font-bold px-4 py-2 rounded-xl text-xs shadow cursor-pointer transition">
                        {uploadingMedia ? "Uploading..." : "Upload Photo / Video Clip"}
                        <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {mediaItems.map((item) => {
                      const isVideo = item.mediaType === "video" || [".mp4", ".webm", ".mov"].some(ext => item.fileUrl?.toLowerCase().endsWith(ext));
                      return (
                        <div key={item._id} className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative group">
                          {isVideo ? (
                            <video src={item.fileUrl} className="w-full h-full object-cover" muted loop autoPlay />
                          ) : (
                            <img src={item.fileUrl} alt="media" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                            {isVideo ? "🎬 Video" : "📷 Photo"}
                          </div>
                          <button
                            onClick={() => handleDeleteMedia(item._id)}
                            className="absolute top-2 right-2 bg-rose-600/90 text-white p-1.5 rounded-lg shadow text-xs hover:bg-rose-700 transition opacity-0 group-hover:opacity-100"
                            title="Delete media"
                          >
                            🗑️
                          </button>
                        </div>
                      );
                    })}
                    {mediaItems.length === 0 && (
                      <div className="col-span-full text-center py-12 border-2 border-dashed border-emerald-200 bg-emerald-50/50 rounded-2xl text-emerald-800 text-xs font-medium space-y-1">
                        <p className="font-bold text-sm">✨ Pure AI Scene Generation Mode Active</p>
                        <p className="text-slate-600">No media uploaded. When you click <strong>"Generate Scene Storyboard"</strong>, Google Gemini AI will generate 16:9 photorealistic visual scenes for every moment!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Storyboard */}
              {activeTab === "storyboard" && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">Scene Storyboard & Lyric Timeline</h3>
                        {activeProject.activeSongId && (
                          <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-indigo-200 flex items-center gap-1">
                            <span>🎵 {activeProject.activeSongId.durationSeconds || 30}s Audio</span>
                            <span>•</span>
                            <span>{activeProject.activeStoryboardId?.scenes?.length || 0} Scenes (~5-6s each)</span>
                            <span>•</span>
                            <span>🌐 {getLanguageShort(activeProject.language || selectedLanguage)}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Each scene is synchronized to the song lyrics with natural 5-6s cuts matching AI motion video duration so clips never repeat.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGenerateAllVeo}
                        disabled={generatingAllVeo || loading || !activeProject.activeStoryboardId}
                        className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow flex items-center gap-1.5 transition disabled:opacity-50"
                      >
                        {generatingAllVeo ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Generating Omni Video Clips...
                          </>
                        ) : (
                          <>
                            <span>✨</span>
                            Generate Gemini Omni Video Clips (All Scenes)
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleGenerateStoryboard}
                        disabled={loading}
                        className="bg-[#0A2D59] text-white font-bold px-4 py-2 rounded-xl text-xs shadow hover:bg-slate-800 transition"
                      >
                        {loading ? "Synchronizing Storyboard..." : "🎵 Sync Storyboard with Song Lyrics"}
                      </button>
                    </div>
                  </div>

                  {activeProject.activeStoryboardId && (
                    <div className="space-y-4">
                      {activeProject.activeStoryboardId.scenes?.some(s => {
                        const m = mediaItems.find(item => item._id === s.mediaId || item._id === s.mediaId?._id);
                        return !m || (m.mediaType !== "video" && ![".mp4", ".webm", ".mov"].some(ext => m.fileUrl?.toLowerCase().endsWith(ext)));
                      }) && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-base">💡</span>
                            <span>
                              <strong>Pro Tip:</strong> Your scenes currently use static image frames. Click <strong className="text-indigo-800 font-bold">"Generate Gemini Omni Video Clips (All Scenes)"</strong> to render real motion video for each lyric-aligned scene without any looping!
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeProject.activeStoryboardId.scenes?.map((scene, idx) => {
                          const media = mediaItems.find(m => m._id === scene.mediaId || m._id === scene.mediaId?._id) || mediaItems[idx % mediaItems.length];
                          const isVideoMedia = media && (media.mediaType === "video" || [".mp4", ".webm", ".mov"].some(ext => media.fileUrl?.toLowerCase().endsWith(ext)));
                          const sceneDuration = Math.max(1, Math.round((scene.endTimeSeconds || 5) - (scene.startTimeSeconds || 0)));

                          return (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                              {media ? (
                                <div className="h-44 bg-slate-200 overflow-hidden relative group">
                                  {isVideoMedia ? (
                                    <video src={media.fileUrl} className="w-full h-full object-cover" muted loop autoPlay controls />
                                  ) : (
                                    <img src={media.fileUrl} alt="scene media" className="w-full h-full object-cover" />
                                  )}
                                  <div className="absolute top-2 left-2 bg-slate-900/85 text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow">
                                    <span>Scene {scene.sceneNumber}</span>
                                    <span>•</span>
                                    <span>{scene.startTimeSeconds}s - {scene.endTimeSeconds}s ({sceneDuration}s)</span>
                                    <span>•</span>
                                    <span>{isVideoMedia ? "🎬 Video" : "📷 Photo"}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="h-44 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium">
                                  Scene {scene.sceneNumber} Frame
                                </div>
                              )}

                              <div className="p-3.5 space-y-2.5">
                                {/* Song Lyrics */}
                                {scene.lyricSnippet && (
                                  <div className="bg-indigo-50/80 border border-indigo-200/70 p-2 rounded-xl">
                                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block flex items-center gap-1">
                                      <span>🎵</span> Song Lyrics
                                    </span>
                                    <p className="text-xs font-semibold text-indigo-950 italic mt-0.5">"{scene.lyricSnippet}"</p>
                                  </div>
                                )}

                                {/* Characters in Scene */}
                                {projectCharacters.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      👥 Cast in Scene:
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                      {projectCharacters.map((c, cIdx) => {
                                        const isTagged = scene.characters?.includes(c.name);
                                        return (
                                          <button
                                            key={cIdx}
                                            type="button"
                                            onClick={() => handleToggleSceneCharacter(idx, c.name)}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition flex items-center gap-1 border ${
                                              isTagged
                                                ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                                                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                                            }`}
                                            title={`Toggle ${c.name} in this scene`}
                                          >
                                            <span>{isTagged ? "✓" : "+"}</span> {c.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Visual Prompt / Action (Editable) */}
                                <div>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🎬 Visual Action / Prompt</span>
                                    {editingSceneIdx !== idx && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingSceneIdx(idx);
                                          if (sceneDraftPrompts[idx] === undefined) {
                                            setSceneDraftPrompts(prev => ({ ...prev, [idx]: scene.visualPrompt || scene.captionText || "" }));
                                          }
                                        }}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                      >
                                        ✏️ Edit Prompt
                                      </button>
                                    )}
                                  </div>

                                  {editingSceneIdx === idx ? (
                                    <div className="space-y-1.5 pt-0.5">
                                      <textarea
                                        rows={3}
                                        value={sceneDraftPrompts[idx] !== undefined ? sceneDraftPrompts[idx] : (scene.visualPrompt || scene.captionText || "")}
                                        onChange={(e) => setSceneDraftPrompts(prev => ({ ...prev, [idx]: e.target.value }))}
                                        className="w-full border border-indigo-300 rounded-lg p-2 text-xs bg-white focus:ring-1 focus:ring-indigo-500 shadow-inner"
                                        placeholder="Describe the visual action, camera motion, and character behavior for this scene..."
                                      />
                                      {projectCharacters.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1">
                                          <span className="text-[10px] text-slate-400 font-semibold">Quick insert:</span>
                                          {projectCharacters.map((c, cIdx) => (
                                            <button
                                              key={cIdx}
                                              type="button"
                                              onClick={() => {
                                                const desc = c.visualDescription ? `${c.name} (${c.visualDescription})` : c.name;
                                                setSceneDraftPrompts(prev => {
                                                  const cur = prev[idx] ?? (scene.visualPrompt || scene.captionText || "");
                                                  return { ...prev, [idx]: cur ? `${cur}, featuring ${desc}` : desc };
                                                });
                                              }}
                                              className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded font-medium"
                                            >
                                              +{c.name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      <div className="flex justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setEditingSceneIdx(null)}
                                          className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded hover:bg-slate-200"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSaveScenePrompt(idx)}
                                          disabled={updatingSceneIdx === idx}
                                          className="text-[10px] font-bold bg-[#0A2D59] hover:bg-slate-800 text-white px-2.5 py-1 rounded-md shadow-sm transition"
                                        >
                                          {updatingSceneIdx === idx ? "Saving..." : "Save Prompt"}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-700 line-clamp-3 bg-white p-2 rounded-lg border border-slate-200">
                                      {sceneDraftPrompts[idx] || scene.visualPrompt || scene.captionText}
                                    </p>
                                  )}
                                </div>

                                {/* Media Source Selector (if uploaded media exists) */}
                                {mediaItems.length > 0 && (
                                  <div className="pt-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Source Visual Media:</label>
                                    <select
                                      value={scene.mediaId?._id || scene.mediaId || ""}
                                      onChange={(e) => handleAssignSceneMedia(idx, e.target.value)}
                                      className="w-full border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white text-slate-700 font-medium"
                                    >
                                      <option value="">AI Frame / Default Media</option>
                                      {mediaItems.map((m, mIdx) => (
                                        <option key={m._id || mIdx} value={m._id}>
                                          {m.originalFilename || `Media #${mIdx + 1}`} ({m.mediaType === "video" ? "🎬 Video" : "📷 Photo"})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* Action Generation Buttons */}
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateSceneImage(idx, sceneDraftPrompts[idx] || scene.visualPrompt || scene.captionText)}
                                    disabled={generatingImageSceneIdx === idx || generatingVeoSceneIdx === idx}
                                    className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold py-1.5 px-2 rounded-lg text-[11px] shadow-sm flex items-center justify-center gap-1 transition disabled:opacity-50"
                                  >
                                    {generatingImageSceneIdx === idx ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></span>
                                        <span>Painting...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🎨</span>
                                        <span>Regen Image</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleGenerateVeoScene(idx, sceneDraftPrompts[idx] || scene.visualPrompt || scene.captionText)}
                                    disabled={generatingVeoSceneIdx === idx || generatingAllVeo || generatingImageSceneIdx === idx}
                                    className="bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold py-1.5 px-2 rounded-lg text-[11px] shadow-sm flex items-center justify-center gap-1 transition disabled:opacity-50"
                                  >
                                    {generatingVeoSceneIdx === idx ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        <span>Rendering...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>✨</span>
                                        <span>{isVideoMedia ? "Regen Video" : "Omni Video"}</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Render & Video Player */}
              {activeTab === "render" && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black flex items-center gap-2">🚀 Render Professional Event Video</h3>
                        <p className="text-xs text-slate-300 mt-1">
                          Synthesize AI motion clips, vocal song audio, and synchronized scene captions into your chosen display format.
                        </p>
                      </div>
                      <button
                        onClick={handleTriggerRender}
                        disabled={rendering}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-3 rounded-xl shadow-lg text-sm transition shrink-0"
                      >
                        {rendering ? "Rendering Video..." : `Start Render (${videoPresets[selectedPreset]?.shortLabel || "Video"})`}
                      </button>
                    </div>

                    {/* Target Display Resolution Selector */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>📐</span> Choose Target Display & Resolution:
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {videoPresets[selectedPreset]?.name} • {videoPresets[selectedPreset]?.aspectRatio}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {Object.values(videoPresets).map((preset) => {
                          const isSelected = selectedPreset === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setSelectedPreset(preset.id)}
                              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all ${
                                isSelected
                                  ? "bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-950/50"
                                  : "bg-slate-800/80 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-center justify-between w-full mb-2">
                                <span className="text-xl">
                                  {preset.icon || (preset.id === "1080p" ? "🖥️" : preset.id === "720p" ? "💻" : preset.id === "mobile" ? "📱" : preset.id === "tablet" ? "📲" : "🔲")}
                                </span>
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${isSelected ? "bg-emerald-400 text-slate-950" : "bg-slate-700 text-slate-300"}`}>
                                  {preset.aspectRatio}
                                </span>
                              </div>
                              <div className={`font-black text-xs ${isSelected ? "text-emerald-300" : "text-white"}`}>
                                {preset.shortLabel || preset.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {preset.width} × {preset.height}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                                {preset.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Motion Video vs Static Photo Notice */}
                    {(() => {
                      const totalScenes = activeProject.activeStoryboardId?.scenes?.length || 0;
                      const videoSceneCount = activeProject.activeStoryboardId?.scenes?.filter(s => {
                        const m = mediaItems.find(item => item._id === s.mediaId || item._id === s.mediaId?._id);
                        return m && (m.mediaType === "video" || [".mp4", ".webm", ".mov"].some(ext => m.fileUrl?.toLowerCase().endsWith(ext)));
                      }).length || 0;

                      return (
                        <>
                          {totalScenes > 0 && videoSceneCount < totalScenes && (
                            <div className="bg-amber-950/60 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-inner">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">⚠️</span>
                                <span>
                                  Currently <strong>{totalScenes - videoSceneCount} of {totalScenes}</strong> scenes are still photos.
                                  To render full cinematic motion video, switch to the <strong>Storyboard</strong> tab and click <strong>"Generate Gemini Omni Video Clips"</strong>!
                                </span>
                              </div>
                              <button
                                onClick={() => setActiveTab("storyboard")}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs shrink-0 transition"
                              >
                                Go to Storyboard
                              </button>
                            </div>
                          )}

                          {/* Pre-Render Specifications Summary */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 text-xs border-t border-slate-800">
                            <div className="bg-slate-800/80 p-3 rounded-xl">
                              <div className="text-slate-400 font-bold">Total Duration:</div>
                              <div className="font-extrabold text-emerald-400 mt-0.5">
                                {activeProject.activeSongId?.durationSeconds
                                  ? `${activeProject.activeSongId.durationSeconds}s`
                                  : activeProject.activeStoryboardId?.scenes
                                    ? `${activeProject.activeStoryboardId.scenes.length * 5}s`
                                    : "30 Seconds"}
                              </div>
                            </div>
                            <div className="bg-slate-800/80 p-3 rounded-xl">
                              <div className="text-slate-400 font-bold">Visual Format:</div>
                              <div className="font-extrabold text-blue-400 mt-0.5">
                                {videoSceneCount > 0 ? `${videoSceneCount}/${totalScenes} Omni Videos` : "Static Photos"}
                              </div>
                            </div>
                            <div className="bg-slate-800/80 p-3 rounded-xl">
                              <div className="text-slate-400 font-bold">Audio Track:</div>
                              <div className="font-extrabold text-amber-400 mt-0.5">Lyria 3 Pro Studio Song</div>
                            </div>
                            <div className="bg-slate-800/80 p-3 rounded-xl">
                              <div className="text-slate-400 font-bold">Target Resolution:</div>
                              <div className="font-extrabold text-purple-400 mt-0.5">
                                {videoPresets[selectedPreset]?.shortLabel || "1080p"} ({videoPresets[selectedPreset]?.width}x{videoPresets[selectedPreset]?.height})
                              </div>
                            </div>
                            <div className="bg-slate-800/80 p-3 rounded-xl col-span-2 md:col-span-1">
                              <div className="text-slate-400 font-bold">Language & Subtitles:</div>
                              <div className="font-extrabold text-pink-400 mt-0.5 truncate">
                                {getLanguageShort(activeProject.language || selectedLanguage)}
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {activeJob && rendering && (
                      <div className="space-y-2 pt-4 border-t border-slate-800">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>{activeJob.currentStepMessage}</span>
                          <span>{activeJob.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-400 h-2.5 rounded-full transition-all duration-300"
                            style={{ width: `${activeJob.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Final Video Preview Player */}
                  {activeProject.activeVideoId?.videoUrl && (
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                          <span>🎬</span> Rendered Event Video Preview
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-emerald-100 text-emerald-800 font-black text-xs px-2.5 py-1 rounded-full border border-emerald-300">
                            {activeProject.activeVideoId.resolution || "1080p"}
                          </span>
                          {activeProject.activeVideoId.aspectRatio && (
                            <span className="bg-blue-100 text-blue-800 font-black text-xs px-2.5 py-1 rounded-full border border-blue-300">
                              {activeProject.activeVideoId.aspectRatio}
                            </span>
                          )}
                          <span className="bg-purple-100 text-purple-800 font-black text-xs px-2.5 py-1 rounded-full border border-purple-300">
                            🌐 {getLanguageShort(activeProject.activeVideoId.language || activeProject.language)}
                          </span>
                          <a
                            href={activeProject.activeVideoId.subtitlesUrl || `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.srt`}
                            download={`subtitles_${activeProject.activeVideoId.language || activeProject.language || "track"}.srt`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-purple-900 hover:bg-purple-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow inline-flex items-center gap-1.5 transition"
                            title="Download SRT subtitle file"
                          >
                            <span>💬</span> Subtitles (.srt)
                          </a>
                          <a
                            href={activeProject.activeVideoId.vttUrl || `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`}
                            download={`subtitles_${activeProject.activeVideoId.language || activeProject.language || "track"}.vtt`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-indigo-900 hover:bg-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow inline-flex items-center gap-1.5 transition"
                            title="Download WebVTT subtitle file"
                          >
                            <span>📝</span> Subtitles (.vtt)
                          </a>
                          <a
                            href={activeProject.activeVideoId.videoUrl}
                            download={`event_video_${activeProject.activeVideoId.preset || "final"}.mp4`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow inline-flex items-center gap-1.5 transition"
                          >
                            <span>⬇️</span> Download Video
                          </a>
                        </div>
                      </div>

                      <div className="flex justify-center bg-black/5 rounded-2xl p-4">
                        <video
                          key={activeProject.activeVideoId.videoUrl}
                          controls
                          crossOrigin="anonymous"
                          className="max-h-[500px] w-auto max-w-full rounded-xl shadow-xl border border-slate-300"
                        >
                          <source src={activeProject.activeVideoId.videoUrl} type="video/mp4" />
                          <track
                            kind="subtitles"
                            src={activeProject.activeVideoId.vttUrl || `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`}
                            srcLang={activeProject.activeVideoId.language || activeProject.language || "en"}
                            label={`${getLanguageShort(activeProject.activeVideoId.language || activeProject.language)} Subtitles`}
                            default
                          />
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 space-y-3">
              <div className="text-4xl">🎬</div>
              <div className="font-bold text-sm">Select or create a story project for this event</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Event Story Project */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">
              Create AI Story for "{selectedEvent?.title}"
            </h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Story Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Highlights & Key Moments"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2D59]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Language for Song & Video</label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-[#0A2D59] bg-white"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name} ({l.nativeName})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Lyrics, singing vocals, and synchronized subtitles will be generated in this language.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Story Narrative / Event Memories</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type or paste the story, speech, or summary of this event..."
                  value={newStory}
                  onChange={(e) => setNewTitleStory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2D59]"
                />
              </div>

              {/* Cast & Characters (Visual Consistency) */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <span>👥</span> Cast & Characters (Optional)
                    </span>
                    <p className="text-[11px] text-slate-500">Helps AI render consistent faces & attire across all video scenes.</p>
                  </div>
                  {newCharacters.length > 0 && (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {newCharacters.length} added
                    </span>
                  )}
                </div>

                {newCharacters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {newCharacters.map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-sm">
                        <span>👤 {c.name}</span>
                        {c.role && <span className="text-slate-400 text-[10px]">({c.role})</span>}
                        <button
                          type="button"
                          onClick={() => setNewCharacters(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-slate-400 hover:text-red-500 text-xs ml-1 font-bold"
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
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59]"
                  />
                  <input
                    type="text"
                    placeholder="Role (e.g. Groom)"
                    value={newCharRole}
                    onChange={(e) => setNewCharRole(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59]"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="Appearance / Attire"
                      value={newCharDesc}
                      onChange={(e) => setNewCharDesc(e.target.value)}
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-1 focus:ring-[#0A2D59] flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCharName.trim()) return;
                        setNewCharacters(prev => [...prev, {
                          name: newCharName.trim(),
                          role: newCharRole.trim(),
                          visualDescription: newCharDesc.trim()
                        }]);
                        setNewCharName("");
                        setNewCharRole("");
                        setNewCharDesc("");
                      }}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Director Guidelines & Must-Have Scenes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <span>🎬</span> Director Guidelines & Must-Have Scenes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Include stage garland exchange, grand cake cutting, and family toast..."
                  value={newDirectorGuidelines}
                  onChange={(e) => setNewDirectorGuidelines(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-[#0A2D59]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#0A2D59] text-white font-bold px-5 py-2 rounded-xl text-xs shadow hover:bg-slate-800 transition"
                >
                  {loading ? "Creating..." : "Create Story Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
