import { useState, useEffect, useRef } from "react";
import { api, API_BASE } from "../api.js";
import { AppShell } from "../components/Navbar.jsx";
import { Icon } from "../components/Icons.jsx";
import { EventSwitcherModal } from "../components/EventSwitcherModal.jsx";

export function AdStudioPage({ auth, token: propToken }) {
  const token = auth?.token || propToken;
  const userRole = auth?.user?.role || "";
  const canUseStandalone = !["event_admin", "event_staff", "staff"].includes(userRole);
  const castSectionRef = useRef(null);

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeTab, setActiveTab] = useState("story"); // story | lyrics | media | storyboard | render
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Event & Workspace Switcher Modal State (Cmd+K)
  const [switcherModalOpen, setSwitcherModalOpen] = useState(false);

  // Create Short Advertisement Modal Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdScope, setNewAdScope] = useState("event"); // "event" | "standalone"
  const [newTitle, setNewTitle] = useState("");
  const [newStory, setNewStory] = useState("");
  const [newLanguage, setNewLanguage] = useState("en");
  const [newAdBrandName, setNewAdBrandName] = useState("");
  const [newAdOffer, setNewAdOffer] = useState("");
  const [newAdAudience, setNewAdAudience] = useState("");
  const [newAdCta, setNewAdCta] = useState("");
  const [newAdCtaSubtext, setNewAdCtaSubtext] = useState("");
  const [newAdDuration, setNewAdDuration] = useState("15");
  const [newAdAudioMode, setNewAdAudioMode] = useState("hybrid_conversation_song");
  const [newAdSpeakerFormat, setNewAdSpeakerFormat] = useState("two_speaker_chat");
  const [newAdBurnInCta, setNewAdBurnInCta] = useState(true);

  // Multilingual State
  const [languages, setLanguages] = useState([
    { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
    { code: "hinglish", name: "Hinglish", nativeName: "Hindi + English", flag: "🇮🇳" }
  ]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");

  // Voice & Jingle Provider State
  const [selectedMusicProvider, setSelectedMusicProvider] = useState("google_lyria");
  const [generatingVeoSceneIdx, setGeneratingVeoSceneIdx] = useState(null);
  const [generatingAllVeo, setGeneratingAllVeo] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);

  // Creation Modal Speakers & Guidelines
  const [newCharacters, setNewCharacters] = useState([]);
  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("");
  const [newCharDesc, setNewCharDesc] = useState("");
  const [newCharVoiceGender, setNewCharVoiceGender] = useState("female");
  const [newDirectorGuidelines, setNewDirectorGuidelines] = useState("");

  // Tab 1 Active Project Speakers, Ad Brief & Guidelines
  const [projectCharacters, setProjectCharacters] = useState([]);
  const [tabCharName, setTabCharName] = useState("");
  const [tabCharRole, setTabCharRole] = useState("");
  const [tabCharDesc, setTabCharDesc] = useState("");
  const [tabCharVoiceGender, setTabCharVoiceGender] = useState("female");
  const [tabCharVoiceRole, setTabCharVoiceRole] = useState("speaker_a");
  const [projectDirectorGuidelines, setProjectDirectorGuidelines] = useState("");
  const [savingCastGuidelines, setSavingCastGuidelines] = useState(false);

  // Active Advertisement Project Brief & Script Segments State
  const [adBriefDraft, setAdBriefDraft] = useState({
    brandName: "",
    productOrOffer: "",
    objective: "",
    targetAudience: "",
    callToAction: "",
    ctaSubtext: "",
    burnInCtaOverlay: true,
    targetDurationSeconds: 15,
    audioMode: "hybrid_conversation_song",
    speakerFormat: "two_speaker_chat",
    bgmStyle: "Upbeat Commercial"
  });
  const [adStoryDraft, setAdStoryDraft] = useState("");
  const [savingAdBrief, setSavingAdBrief] = useState(false);
  const [adSegmentsDraft, setAdSegmentsDraft] = useState([]);
  const [savingAdScript, setSavingAdScript] = useState(false);
  const [synthesizingAdAudio, setSynthesizingAdAudio] = useState(false);
  const [includeVisualBgm, setIncludeVisualBgm] = useState(true);

  // Tab 4 Storyboard Scene Edit State
  const [editingSceneIdx, setEditingSceneIdx] = useState(null);
  const [sceneDraftPrompts, setSceneDraftPrompts] = useState({});
  const [sceneDraftHeadlines, setSceneDraftHeadlines] = useState({});
  const [generatingImageSceneIdx, setGeneratingImageSceneIdx] = useState(null);
  const [updatingSceneIdx, setUpdatingSceneIdx] = useState(null);

  // Media State
  const [mediaItems, setMediaItems] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Job Polling State
  const [activeJob, setActiveJob] = useState(null);
  const [rendering, setRendering] = useState(false);

  // Video Resolution Presets State (Default to vertical 9:16 mobile for Short Ads)
  const [selectedPreset, setSelectedPreset] = useState("mobile");
  const [videoPresets, setVideoPresets] = useState({
    mobile: {
      id: "mobile",
      name: "Mobile Vertical (9:16)",
      shortLabel: "Mobile (9:16)",
      width: 1080,
      height: 1920,
      aspectRatio: "9:16",
      bitrate: "4500k",
      description: "Vertical 9:16 for Reels, Shorts, Stories & TikTok ads",
      icon: "📱"
    },
    square: {
      id: "square",
      name: "Social Square (1:1)",
      shortLabel: "Square (1:1)",
      width: 1080,
      height: 1080,
      aspectRatio: "1:1",
      bitrate: "4000k",
      description: "Square 1:1 format for Instagram & LinkedIn ad feeds",
      icon: "🔲"
    },
    "1080p": {
      id: "1080p",
      name: "Desktop Full HD (1080p)",
      shortLabel: "1080p Full HD",
      width: 1920,
      height: 1080,
      aspectRatio: "16:9",
      bitrate: "6000k",
      description: "Crisp 1080p 16:9 widescreen for YouTube & venue screens",
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
      description: "Fast-rendering 720p 16:9 commercial preview",
      icon: "💻"
    },
    tablet: {
      id: "tablet",
      name: "Tablet Display (4:3)",
      shortLabel: "Tablet (4:3)",
      width: 1440,
      height: 1080,
      aspectRatio: "4:3",
      bitrate: "4500k",
      description: "4:3 aspect ratio tailored for kiosk & tablet displays",
      icon: "📲"
    }
  });

  useEffect(() => {
    loadEvents();
    loadVideoPresets();
    loadLanguages();
  }, []);

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
      if (
        activeProject.activeSongId?.provider &&
        ["google_lyria", "elevenlabs", "google_tts"].includes(
          activeProject.activeSongId.provider
        )
      ) {
        setSelectedMusicProvider(activeProject.activeSongId.provider);
      }
      setProjectCharacters(
        Array.isArray(activeProject.characters) ? activeProject.characters : []
      );
      setProjectDirectorGuidelines(activeProject.directorGuidelines || "");
      setAdStoryDraft(activeProject.storyText || "");
      const b = activeProject.adBrief || {};
      setAdBriefDraft({
        brandName: b.brandName || "",
        productOrOffer: b.productOrOffer || "",
        objective: b.objective || "",
        targetAudience: b.targetAudience || "",
        callToAction: b.callToAction || "",
        ctaSubtext: b.ctaSubtext || "",
        burnInCtaOverlay: b.burnInCtaOverlay !== false,
        targetDurationSeconds: Number(b.targetDurationSeconds) || 30,
        audioMode: b.audioMode || "hybrid_conversation_song",
        speakerFormat: b.speakerFormat || "two_speaker_chat",
        bgmStyle: b.bgmStyle || "Upbeat Commercial"
      });
      setAdSegmentsDraft(
        Array.isArray(activeProject.activeSongId?.scriptSegments)
          ? activeProject.activeSongId.scriptSegments.map((s) => ({ ...s }))
          : []
      );
      if (activeProject.activeStoryboardId?.scenes) {
        const drafts = {};
        const headlines = {};
        activeProject.activeStoryboardId.scenes.forEach((s, idx) => {
          drafts[idx] = s.visualPrompt || s.captionText || "";
          headlines[idx] = s.onScreenHeadline || "";
        });
        setSceneDraftPrompts(drafts);
        setSceneDraftHeadlines(headlines);
      } else {
        setSceneDraftPrompts({});
        setSceneDraftHeadlines({});
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
        console.warn("Failed to patch ad project language:", err.message);
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
      } else if (canUseStandalone) {
        setSelectedEventId("standalone");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadProjects(workspaceId) {
    try {
      const scopeParam =
        workspaceId === "standalone"
          ? "scope=standalone&projectType=ad_promo"
          : `eventId=${encodeURIComponent(workspaceId)}&projectType=ad_promo`;
      const data = await api(`/api/story-video/projects?${scopeParam}`, {
        token
      });
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

  function openCreateAdModal() {
    const isStandaloneView = selectedEventId === "standalone" || !selectedEventId;
    setNewAdScope(isStandaloneView ? "standalone" : "event");
    if (!isStandaloneView) {
      const ev = events.find((item) => item._id === selectedEventId);
      if (ev && !newAdBrandName) {
        setNewAdBrandName(ev.title || "");
      }
    }
    setShowCreateModal(true);
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
    if (!newTitle.trim()) return;
    const targetWorkspaceId =
      newAdScope === "standalone" && canUseStandalone
        ? "standalone"
        : selectedEventId || (canUseStandalone ? "standalone" : "");

    if ((!targetWorkspaceId || targetWorkspaceId === "standalone") && !canUseStandalone) {
      setError("Please select an event first.");
      return;
    }
    if (!newStory.trim() && !newAdOffer.trim() && !newAdBrandName.trim()) {
      setError("Please enter an advertisement offer, brand name, or ad concept.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const bodyPayload = {
        eventId: targetWorkspaceId === "standalone" ? null : targetWorkspaceId,
        projectType: "ad_promo",
        title: newTitle.trim(),
        storyText: newStory.trim(),
        language: newLanguage,
        characters: newCharacters,
        directorGuidelines: newDirectorGuidelines,
        adBrief: {
          brandName: newAdBrandName.trim() || newTitle.trim(),
          productOrOffer: newAdOffer.trim(),
          targetAudience: newAdAudience.trim(),
          callToAction: newAdCta.trim(),
          ctaSubtext: newAdCtaSubtext.trim(),
          burnInCtaOverlay: newAdBurnInCta,
          targetDurationSeconds: Number(newAdDuration) || 15,
          audioMode: newAdAudioMode,
          speakerFormat: newAdSpeakerFormat,
          bgmStyle: "Upbeat Commercial"
        }
      };

      const project = await api("/api/story-video/projects", {
        token,
        method: "POST",
        body: bodyPayload
      });

      setSuccess("Short Advertisement created! Ready to analyze strategy & draft script.");
      setNewTitle("");
      setNewStory("");
      setNewLanguage("en");
      setNewAdBrandName("");
      setNewAdOffer("");
      setNewAdAudience("");
      setNewAdCta("");
      setNewAdCtaSubtext("");
      setNewAdDuration("15");
      setNewAdAudioMode("hybrid_conversation_song");
      setNewAdSpeakerFormat("two_speaker_chat");
      setNewCharacters([]);
      setNewDirectorGuidelines("");
      setShowCreateModal(false);

      if (targetWorkspaceId !== selectedEventId) {
        setSelectedEventId(targetWorkspaceId);
      } else {
        await loadProjects(targetWorkspaceId);
      }
      setActiveProject(project);
      setActiveTab("story");
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
      visualDescription: tabCharDesc.trim(),
      voiceGender: tabCharVoiceGender || "female",
      voiceRole: tabCharVoiceRole || "speaker_a"
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
        setSuccess(`Added "${newChar.name}" to the ad cast!`);
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
        setSuccess("Speaker removed from ad cast.");
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
      setSuccess("Commercial director guidelines saved!");
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
    const newHeadline = sceneDraftHeadlines[sceneIdx];
    try {
      const bodyPayload = { visualPrompt: newPrompt };
      if (newHeadline !== undefined) {
        bodyPayload.onScreenHeadline = newHeadline;
      }
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`,
        {
          token,
          method: "PATCH",
          body: bodyPayload
        }
      );
      setSuccess(`Commercial cut #${sceneIdx + 1} updated!`);
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
    if (!activeProject?._id || !activeProject.activeStoryboardId?.scenes) return;
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
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIdx}`,
        {
          token,
          method: "PATCH",
          body: { mediaId: mediaId || null }
        }
      );
      setSuccess(`Scene ${sceneIdx + 1} visual asset updated!`);
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
      videoPresets[selectedPreset]?.aspectRatio || "9:16";
    setSuccess(
      `Generating AI commercial frame (${targetAspectRatio}) for Scene ${sceneIdx + 1}...`
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
      setSuccess(`New AI commercial frame generated for Scene ${sceneIdx + 1}!`);
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

  async function handleSaveAdBrief() {
    if (!activeProject?._id) return;
    setSavingAdBrief(true);
    setError("");
    try {
      await api(`/api/story-video/projects/${activeProject._id}`, {
        token,
        method: "PATCH",
        body: {
          storyText: adStoryDraft,
          adBrief: adBriefDraft
        }
      });
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setSuccess("Advertisement brief & settings saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAdBrief(false);
    }
  }

  async function handleAnalyzeAdBrief() {
    if (!activeProject) return;
    setLoading(true);
    setError("");
    const langLabel = getLanguageLabel(selectedLanguage);
    setSuccess(
      `Analyzing commercial hook & strategy in ${langLabel} with Gemini AI (~10s)...`
    );
    try {
      await api(`/api/story-video/projects/${activeProject._id}`, {
        token,
        method: "PATCH",
        body: { storyText: adStoryDraft, adBrief: adBriefDraft }
      });
      await api(`/api/story-video/projects/${activeProject._id}/analyze`, {
        token,
        method: "POST",
        body: { language: selectedLanguage, adBrief: adBriefDraft }
      });
      setSuccess(
        `Commercial strategy ready in ${langLabel}! Now craft your Script, Voices & Jingle.`
      );
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

  async function handleGenerateAdScript() {
    if (!activeProject?._id) return;
    setLoading(true);
    setError("");
    setSuccess("Drafting timed commercial script segments with Gemini AI...");
    try {
      const songRes = await api(
        `/api/story-video/projects/${activeProject._id}/ad-script`,
        {
          token,
          method: "POST",
          body: {
            audioMode: adBriefDraft.audioMode,
            speakerFormat: adBriefDraft.speakerFormat,
            targetDurationSeconds: Number(adBriefDraft.targetDurationSeconds) || 30,
            bgmStyle: adBriefDraft.bgmStyle || "Upbeat Commercial",
            language: selectedLanguage
          }
        }
      );
      setAdSegmentsDraft(
        Array.isArray(songRes.scriptSegments)
          ? songRes.scriptSegments.map((s) => ({ ...s }))
          : []
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setSuccess(
        `Generated ${songRes.scriptSegments?.length || 0} commercial script blocks! Review or edit lines below, then synthesize audio.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAdScript() {
    if (!activeProject?._id) return;
    setSavingAdScript(true);
    setError("");
    try {
      const songRes = await api(
        `/api/story-video/projects/${activeProject._id}/ad-script`,
        {
          token,
          method: "PATCH",
          body: {
            scriptSegments: adSegmentsDraft,
            audioMode: adBriefDraft.audioMode,
            speakerFormat: adBriefDraft.speakerFormat,
            targetDurationSeconds: Number(adBriefDraft.targetDurationSeconds) || 30,
            bgmStyle: adBriefDraft.bgmStyle
          }
        }
      );
      setAdSegmentsDraft(
        Array.isArray(songRes.scriptSegments)
          ? songRes.scriptSegments.map((s) => ({ ...s }))
          : []
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setSuccess("Ad script timeline saved!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingAdScript(false);
    }
  }

  async function handleSynthesizeAdAudio() {
    if (!activeProject?._id) return;
    setSynthesizingAdAudio(true);
    setError("");
    const modeDesc =
      adBriefDraft.audioMode === "dialogue_only"
        ? "multi-speaker conversation (no music)"
        : adBriefDraft.audioMode === "dialogue_bgm"
          ? "conversation + ducked instrumental underscore"
          : adBriefDraft.audioMode === "visual_only"
            ? includeVisualBgm
              ? "instrumental commercial soundtrack"
              : "silent visual track"
            : "conversation + sung AI jingle mix";
    setSuccess(`Synthesizing & mastering ${modeDesc} (~20-60s)...`);
    try {
      const songRes = await api(
        `/api/story-video/projects/${activeProject._id}/ad-audio`,
        {
          token,
          method: "POST",
          body: {
            scriptSegments: adSegmentsDraft,
            audioMode: adBriefDraft.audioMode,
            bgmStyle: adBriefDraft.bgmStyle || "Upbeat Commercial",
            musicProvider: selectedMusicProvider,
            language: selectedLanguage,
            targetDurationSeconds: Number(adBriefDraft.targetDurationSeconds) || 30,
            includeVisualBgm
          }
        }
      );
      setAdSegmentsDraft(
        Array.isArray(songRes.scriptSegments)
          ? songRes.scriptSegments.map((s) => ({ ...s }))
          : []
      );
      const updated = await api(
        `/api/story-video/projects/${activeProject._id}`,
        { token }
      );
      setActiveProject(updated);
      setSuccess(
        `Mastered ${songRes.durationSeconds || 30}s commercial audio track! Exact timestamps are ready for Storyboard sync.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSynthesizingAdAudio(false);
    }
  }

  function handleUpdateAdSegment(idx, field, value) {
    setAdSegmentsDraft((prev) =>
      prev.map((seg, i) => {
        if (i !== idx) return seg;
        const next = { ...seg, [field]: value };
        if (field === "segmentType") {
          if (value === "sung_jingle") {
            next.voiceRole = "jingle_vocal";
            next.bgmBehavior = "full";
            if (!next.speakerName || next.speakerName === "Narrator") {
              next.speakerName = "Brand Jingle";
            }
          } else if (value === "narration") {
            next.voiceRole = "narrator";
            next.bgmBehavior =
              adBriefDraft.audioMode === "dialogue_only" ? "none" : "ducked";
          } else if (value === "visual_beat") {
            next.text = "";
            next.bgmBehavior = "full";
          } else {
            next.bgmBehavior =
              adBriefDraft.audioMode === "dialogue_only" ? "none" : "ducked";
          }
        }
        return next;
      })
    );
  }

  function handleAddAdSegment(type = "dialogue") {
    setAdSegmentsDraft((prev) => [
      ...prev,
      {
        segmentOrder: prev.length + 1,
        segmentType: type,
        speakerName:
          type === "sung_jingle"
            ? "Brand Jingle"
            : type === "narration"
              ? "Announcer"
              : prev.length % 2 === 0
                ? "Speaker A"
                : "Speaker B",
        voiceRole:
          type === "sung_jingle"
            ? "jingle_vocal"
            : type === "narration"
              ? "narrator"
              : prev.length % 2 === 0
                ? "speaker_a"
                : "speaker_b",
        voiceGender: prev.length % 2 === 0 ? "female" : "male",
        text: "",
        onScreenHeadline: "",
        targetDurationSeconds: type === "sung_jingle" ? 7 : 4,
        startTimeSeconds: 0,
        endTimeSeconds: type === "sung_jingle" ? 7 : 4,
        bgmBehavior:
          type === "sung_jingle"
            ? "full"
            : adBriefDraft.audioMode === "dialogue_only"
              ? "none"
              : "ducked"
      }
    ]);
  }

  function handleMoveAdSegment(idx, dir) {
    setAdSegmentsDraft((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy.map((s, i) => ({ ...s, segmentOrder: i + 1 }));
    });
  }

  function handleRemoveAdSegment(idx) {
    setAdSegmentsDraft((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, segmentOrder: i + 1 }))
    );
  }

  async function handleGenerateVeoScene(sceneIndex, customPrompt) {
    if (!activeProject) return;
    setGeneratingVeoSceneIdx(sceneIndex);
    setError("");
    setSuccess(
      `Generating Gemini Omni 1.1 Flash motion video for Scene ${sceneIndex + 1}... (~30-35s)`
    );
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/${sceneIndex}/veo`,
        {
          token,
          method: "POST",
          body: { prompt: customPrompt }
        }
      );
      setSuccess(
        `Gemini Omni 1.1 motion video clip ready for Scene ${sceneIndex + 1}!`
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

  async function handleGenerateAllVeo() {
    if (!activeProject) return;
    setGeneratingAllVeo(true);
    setError("");
    setSuccess(
      "Generating Gemini Omni 1.1 Flash motion video clips for all commercial cuts (~30-40s per scene)..."
    );
    try {
      await api(
        `/api/story-video/projects/${activeProject._id}/scenes/generate-all-veo`,
        {
          token,
          method: "POST"
        }
      );
      setSuccess(
        "Gemini Omni 1.1 motion video clips generated for all ad scenes!"
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
      videoPresets[selectedPreset]?.aspectRatio || "9:16";
    setSuccess(
      `Synthesizing Google AI high-definition ${targetAspectRatio} commercial frames (~5-10s per scene)...`
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
        res.message || "Google AI commercial scene images generated successfully!"
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
      setSuccess("Media asset uploaded successfully!");
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
      setSuccess("Media asset deleted.");
      await loadMediaItems(activeProject._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClearAllMedia() {
    if (!activeProject) return;
    if (
      !window.confirm(
        "Remove all uploaded product/brand media? AI will automatically generate commercial scene visuals instead."
      )
    )
      return;
    try {
      await api(`/api/story-video/projects/${activeProject._id}/media`, {
        token,
        method: "DELETE"
      });
      setSuccess(
        "All media cleared! Storyboard will now generate pure AI commercial visuals."
      );
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
      const res = await api(
        `/api/story-video/projects/${activeProject._id}/storyboard`,
        {
          token,
          method: "POST",
          body: { targetSceneDuration: 4 }
        }
      );
      setSuccess(
        `Ad Storyboard ready! Created ${
          res.scenes?.length || 0
        } commercial cuts synchronized to your script & CTA.`
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
        `Short Ad rendering queued for ${
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
          setSuccess("Short Advertisement Video rendering complete!");
          const updated = await api(
            `/api/story-video/projects/${activeProject._id}`,
            { token }
          );
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

  const isStandaloneWorkspace = selectedEventId === "standalone";
  const selectedEvent = events.find((ev) => ev._id === selectedEventId);
  const selectedWorkspaceLabel = isStandaloneWorkspace
    ? "Standalone Brand & Product Ads"
    : selectedEvent?.title || "Ad Workspace";

  function getAudioModeShortLabel(mode) {
    if (mode === "dialogue_only") return "Dialogue Only";
    if (mode === "dialogue_bgm") return "Dialogue + BGM";
    if (mode === "visual_only") return "Visual Kinetic";
    return "Conversation + Jingle";
  }

  const studioTabs = [
    {
      id: "story",
      step: 1,
      label: "Ad Brief & Cast",
      shortLabel: "Ad Brief",
      icon: "sparkles",
      done: Boolean(activeProject?.activeStoryAnalysisId)
    },
    {
      id: "lyrics",
      step: 2,
      label: "Script, Voices & Jingle",
      shortLabel: "Script & Audio",
      icon: "music",
      done: Boolean(
        activeProject?.activeSongId?.audioUrl ||
          activeProject?.activeSongId?.scriptSegments?.length
      )
    },
    {
      id: "media",
      step: 3,
      label: "Product & Brand Media",
      shortLabel: "Media",
      icon: "image",
      done: mediaItems.length > 0
    },
    {
      id: "storyboard",
      step: 4,
      label: "Ad Storyboard",
      shortLabel: "Storyboard",
      icon: "studio",
      done: Boolean(activeProject?.activeStoryboardId?.scenes?.length)
    },
    {
      id: "render",
      step: 5,
      label: "Render Ad",
      shortLabel: "Render Ad",
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
      pageTitle="AI Ad Studio"
      onOpenSwitcher={() => setSwitcherModalOpen(true)}
      selectedEventTitle={selectedWorkspaceLabel}
    >
      {/* Quick Event & Standalone Workspace Switcher Modal (Cmd+K) */}
      <EventSwitcherModal
        isOpen={switcherModalOpen}
        onClose={() => setSwitcherModalOpen(false)}
        events={events}
        selectedEventId={selectedEventId}
        allowStandalone={canUseStandalone}
        onSelectEvent={(eventId) => {
          setSelectedEventId(eventId);
          setSwitcherModalOpen(false);
        }}
      />

      {/* Modal: Create Short Advertisement Video */}
      {showCreateModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          className="fixed inset-0 z-50 bg-heading/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-ad-modal-title"
        >
          <div className="bg-surface rounded-container max-w-xl w-full shadow-soft flex flex-col max-h-[90vh] my-auto overflow-hidden border border-theme animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme shrink-0 bg-hero-gradient">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="h-9 w-9 rounded-tile bg-indigo-tile text-white flex items-center justify-center shrink-0">
                  <Icon name="rocket" className="w-4 h-4" />
                </span>
                <h3
                  id="create-ad-modal-title"
                  className="text-lg font-bold text-primary truncate"
                >
                  Create Short Advertisement Video
                </h3>
              </div>
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
                {/* Ad Scope Selector: Tied to Event vs Standalone Brand Ad */}
                {canUseStandalone && (
                  <div className="bg-primary-tint/70 border border-theme rounded-card p-3.5 space-y-2">
                    <label className="ui-label-sm mb-0">
                      Advertisement Scope
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {events.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewAdScope("event");
                            if (selectedEventId === "standalone" && events[0]) {
                              setSelectedEventId(events[0]._id);
                            }
                          }}
                          className={`px-3 py-2.5 rounded-tile text-xs font-bold text-left transition cursor-pointer ${
                            newAdScope === "event" && events.length > 0
                              ? "bg-primary text-white"
                              : "bg-surface text-heading border border-theme hover:bg-primary-soft"
                          }`}
                        >
                          Event Promo: {selectedEvent?.title || events[0]?.title}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNewAdScope("standalone")}
                        className={`px-3 py-2.5 rounded-tile text-xs font-bold text-left transition cursor-pointer ${
                          newAdScope === "standalone" || events.length === 0
                            ? "bg-primary text-white"
                            : "bg-surface text-heading border border-theme hover:bg-primary-soft"
                        }`}
                      >
                        Standalone Brand / Product Ad (No Event)
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="ui-label-sm">Ad Campaign Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Early Bird Pass Promo 15s"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="ui-input"
                    />
                  </div>

                  <div>
                    <label className="ui-label-sm">Language</label>
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
                  </div>
                </div>

                {/* Short Advertisement Brief Controls */}
                <div className="bg-primary-soft/55 border border-pastel-lavender rounded-card p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="ui-label-sm">
                        Brand / Event / Product Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. NovaBrew / TechSummit 2026"
                        value={newAdBrandName}
                        onChange={(e) => setNewAdBrandName(e.target.value)}
                        className="ui-input-compact"
                      />
                    </div>
                    <div>
                      <label className="ui-label-sm">Ad Duration Preset</label>
                      <select
                        value={newAdDuration}
                        onChange={(e) => setNewAdDuration(e.target.value)}
                        className="ui-select-compact w-full"
                      >
                        <option value="15">15s Bumper / Reels Spot</option>
                        <option value="30">30s Standard Commercial</option>
                        <option value="45">45s Promo Reel</option>
                        <option value="60">60s Brand Story Ad</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="ui-label-sm">Audio &amp; Song Mode</label>
                      <select
                        value={newAdAudioMode}
                        onChange={(e) => setNewAdAudioMode(e.target.value)}
                        className="ui-select-compact w-full"
                      >
                        <option value="hybrid_conversation_song">
                          Conversation + Sung Jingle Mix
                        </option>
                        <option value="dialogue_bgm">
                          Conversation + Soft BGM (No Song)
                        </option>
                        <option value="dialogue_only">
                          Conversation / Voiceover Only (No Music)
                        </option>
                        <option value="visual_only">
                          Visual Kinetic Ad Only (No Voiceover)
                        </option>
                      </select>
                    </div>

                    {newAdAudioMode !== "visual_only" && (
                      <div>
                        <label className="ui-label-sm">Speaker Style</label>
                        <select
                          value={newAdSpeakerFormat}
                          onChange={(e) => setNewAdSpeakerFormat(e.target.value)}
                          className="ui-select-compact w-full"
                        >
                          <option value="two_speaker_chat">
                            2-Person Conversation + CTA
                          </option>
                          <option value="single_narrator">
                            Single Voiceover Narrator
                          </option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="ui-label-sm">
                      Key Offer / Promo Hook
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Zero sugar cold brew, Buy 1 Get 1 Free this week"
                      value={newAdOffer}
                      onChange={(e) => setNewAdOffer(e.target.value)}
                      className="ui-input-compact"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="ui-label-sm">
                        Call-to-Action (CTA Headline)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Order Now — Buy 1 Get 1 Free!"
                        value={newAdCta}
                        onChange={(e) => setNewAdCta(e.target.value)}
                        className="ui-input-compact"
                      />
                    </div>
                    <div>
                      <label className="ui-label-sm">
                        CTA Subtext / Link (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. novabrew.in • Use Code BREW2X"
                        value={newAdCtaSubtext}
                        onChange={(e) => setNewAdCtaSubtext(e.target.value)}
                        className="ui-input-compact"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="ui-label-sm">
                    Ad Concept / Talking Points
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe the scene vibe, problem/solution, or conversational angle (e.g. Two colleagues yawning at 3 PM before discovering our iced latte)..."
                    value={newStory}
                    onChange={(e) => setNewStory(e.target.value)}
                    className="ui-textarea"
                  />
                </div>

                {/* Ad Speakers & Cast (Voice & Visual Consistency) */}
                <div className="bg-primary-tint border border-theme p-4 rounded-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-heading flex items-center gap-1.5">
                        <Icon name="users" className="w-4 h-4 text-primary" />
                        <span>Ad Speakers &amp; Cast (Optional)</span>
                      </span>
                      <p className="text-xs text-muted mt-0.5">
                        Anchors consistent speaker voices and actor appearances across cuts.
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
                          <span className="text-muted text-[11px]">
                            ({c.role || c.voiceGender || "Speaker"})
                          </span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      placeholder="Name (e.g. Priya)"
                      value={newCharName}
                      onChange={(e) => setNewCharName(e.target.value)}
                      className="ui-input-compact text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Friend)"
                      value={newCharRole}
                      onChange={(e) => setNewCharRole(e.target.value)}
                      className="ui-input-compact text-xs"
                    />
                    <select
                      value={newCharVoiceGender}
                      onChange={(e) => setNewCharVoiceGender(e.target.value)}
                      className="ui-select-compact text-xs"
                    >
                      <option value="female">Female Voice</option>
                      <option value="male">Male Voice</option>
                    </select>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Attire / Look"
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
                              visualDescription: newCharDesc.trim(),
                              voiceGender: newCharVoiceGender,
                              voiceRole:
                                prev.length % 2 === 0 ? "speaker_a" : "speaker_b"
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

                {/* Director Guidelines & Must-Have Shots */}
                <div>
                  <label className="ui-label-sm flex items-center gap-1.5">
                    <Icon name="studio" className="w-4 h-4 text-primary" />
                    <span>
                      Director Guidelines &amp; Must-Have Shots (Optional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Close-up product splash reveal at 5s, energetic smile reaction, bold CTA end-card..."
                    value={newDirectorGuidelines}
                    onChange={(e) => setNewDirectorGuidelines(e.target.value)}
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
                  <Icon name="rocket" className="w-4 h-4" />
                  <span>
                    {loading ? "Creating..." : "Create Short Ad Project"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 pb-20 space-y-8 animate-fade-in">
        {/* Centered Bold Two-Line Indigo Heading + Dedicated Ad Scope Pills */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-soft border border-pastel-lavender text-xs font-bold text-primary">
            <Icon name="rocket" className="w-4 h-4" />
            <span>AI Short Advertisement &amp; Promo Studio</span>
          </div>

          <h1 className="text-[32px] sm:text-[40px] font-bold text-primary leading-[1.15]">
            Short Advertisement
            <br />
            Video &amp; Jingle Studio
          </h1>

          <p className="text-sm sm:text-base text-muted leading-relaxed">
            Create 15s–60s commercial promos with multi-speaker dialogue, voiceover + background music, or a hybrid conversation + sung AI jingle — tied to an event or standalone for your brand.
          </p>

          {/* Clean Two-Pill Ad Scope Segmented Control (No Hidden Standalone Dropdown!) */}
          <div className="space-y-2.5 pt-1">
            {canUseStandalone && (
              <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-surface p-1.5 rounded-full border border-theme shadow-subtle">
                {events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEventId === "standalone" && events[0]) {
                        setSelectedEventId(events[0]._id);
                      }
                    }}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                      !isStandaloneWorkspace
                        ? "bg-primary text-white shadow-2xs"
                        : "text-heading hover:bg-primary-tint"
                    }`}
                  >
                    <Icon name="calendar" className="w-4 h-4" />
                    <span>Event Promo Ads</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedEventId("standalone")}
                  className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
                    isStandaloneWorkspace
                      ? "bg-primary text-white shadow-2xs"
                      : "text-heading hover:bg-primary-tint"
                  }`}
                >
                  <Icon name="building" className="w-4 h-4" />
                  <span>Standalone Brand &amp; Product Ads</span>
                </button>
              </div>
            )}

            {/* Event Selector Pill (Visible only when in Event Promo Ads scope) */}
            {!isStandaloneWorkspace && events.length > 0 && (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2.5 bg-surface px-4 py-2 rounded-full border border-theme shadow-subtle w-full sm:w-auto max-w-lg">
                  <Icon name="calendar" className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-muted uppercase tracking-wider shrink-0">
                    Event:
                  </span>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="bg-transparent text-heading text-sm font-bold py-1 pr-2 focus:outline-none flex-1 min-w-0 truncate cursor-pointer"
                    aria-label="Select Event for Promo Ads"
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

        {/* Ad Projects Selector Strip */}
        {projects.length > 0 && (
          <div className="ui-card p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-heading">
                  {isStandaloneWorkspace
                    ? `Standalone Brand & Product Ads (${projects.length})`
                    : `${selectedEvent ? selectedEvent.title : "Event"} Promo Ads (${projects.length})`}
                </h2>
                <p className="text-xs text-muted">
                  {isStandaloneWorkspace
                    ? "Company-wide short commercial spots without an event link."
                    : "Short promotional advertisements created specifically for this event."}
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateAdModal}
                disabled={!selectedEventId && !canUseStandalone}
                className="ui-btn-pill min-h-[42px] px-5 shrink-0"
              >
                <Icon name="plus" className="w-4 h-4" />
                <span>New Short Ad</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((proj) => {
                const isSelected = activeProject?._id === proj._id;
                const dur = proj.adBrief?.targetDurationSeconds || 30;
                const modeLabel = getAudioModeShortLabel(proj.adBrief?.audioMode);
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
                    <div className="flex items-center justify-between gap-2 text-xs text-muted mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-pastel-mint text-heading border border-theme truncate">
                        {dur}s • {modeLabel}
                      </span>
                      <span className="capitalize truncate">
                        <span className="font-semibold text-heading">
                          {proj.status.replace(/_/g, " ")}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Active Ad Studio Workspace */}
        {activeProject ? (
          <div className="space-y-6">
            {/* Responsive 5-Step Ad Pipeline Stepper */}
            <div className="bg-surface rounded-card border border-theme p-2.5 sm:p-3 shadow-subtle">
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
                role="tablist"
                aria-label="AI Ad Studio Workflow"
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

            {/* TAB 1: AD BRIEF, STRATEGY & SPEAKERS CAST */}
            {activeTab === "story" && (
              <div className="space-y-7">
                <div className="ui-container p-6 sm:p-8 space-y-6">
                  {/* Top Row: Tilted Quick-Action Tiles + Project Title */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-theme">
                    <div className="flex flex-wrap items-center gap-3.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab("media")}
                        className="inline-flex items-center gap-2.5 px-4 py-3 rounded-[18px] bg-pastel-mint border-2 border-dashed border-primary/25 text-heading text-xs sm:text-sm font-bold -rotate-2 hover:rotate-0 transition-transform cursor-pointer shadow-subtle"
                      >
                        <span className="h-7 w-7 rounded-full bg-surface text-primary flex items-center justify-center shadow-2xs">
                          <Icon name="plus" className="w-4 h-4" />
                        </span>
                        <span>
                          Add Product/Brand Media{" "}
                          {mediaItems.length > 0 ? `(${mediaItems.length})` : ""}
                        </span>
                      </button>

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
                          Speakers &amp; Cast{" "}
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
                        Short Ad • {adBriefDraft.targetDurationSeconds || 30}s •{" "}
                        {activeProject.eventId ? "Event Promo" : "Standalone Brand Ad"} •{" "}
                        Status:{" "}
                        <span className="font-bold capitalize text-primary">
                          {activeProject.status?.replace(/_/g, " ")}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Editable Advertisement Campaign Brief */}
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Advertisement Campaign Brief &amp; Offer Details
                      </span>
                      <button
                        type="button"
                        onClick={handleSaveAdBrief}
                        disabled={savingAdBrief}
                        className="ui-btn-secondary-sm text-primary text-xs px-3.5 py-1.5"
                      >
                        <Icon name="check" className="w-3.5 h-3.5" />
                        <span>{savingAdBrief ? "Saving..." : "Save Brief"}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      <div>
                        <label className="ui-label-sm">
                          Brand / Event / Product Name
                        </label>
                        <input
                          type="text"
                          value={adBriefDraft.brandName}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              brandName: e.target.value
                            }))
                          }
                          placeholder="e.g. NovaBrew / TechSummit 2026"
                          className="ui-input-compact"
                        />
                      </div>

                      <div>
                        <label className="ui-label-sm">
                          Audio &amp; Song Mode
                        </label>
                        <select
                          value={adBriefDraft.audioMode}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              audioMode: e.target.value
                            }))
                          }
                          className="ui-select-compact w-full"
                        >
                          <option value="hybrid_conversation_song">
                            Conversation + Sung Jingle Mix
                          </option>
                          <option value="dialogue_bgm">
                            Conversation + Soft BGM (No Song)
                          </option>
                          <option value="dialogue_only">
                            Conversation / Voiceover Only (No Music)
                          </option>
                          <option value="visual_only">
                            Visual Kinetic Ad Only (No Voiceover)
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="ui-label-sm">Speaker Format</label>
                        <select
                          value={adBriefDraft.speakerFormat}
                          disabled={adBriefDraft.audioMode === "visual_only"}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              speakerFormat: e.target.value
                            }))
                          }
                          className="ui-select-compact w-full"
                        >
                          <option value="two_speaker_chat">
                            2-Person Conversation + CTA
                          </option>
                          <option value="single_narrator">
                            Single Voiceover Narrator
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="ui-label-sm">
                          Key Offer / Promo Value Hook
                        </label>
                        <input
                          type="text"
                          value={adBriefDraft.productOrOffer}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              productOrOffer: e.target.value
                            }))
                          }
                          placeholder="e.g. Zero sugar cold brew, Buy 1 Get 1 Free"
                          className="ui-input-compact"
                        />
                      </div>

                      <div>
                        <label className="ui-label-sm">
                          Target Audience (Optional)
                        </label>
                        <input
                          type="text"
                          value={adBriefDraft.targetAudience}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              targetAudience: e.target.value
                            }))
                          }
                          placeholder="e.g. Founders, developers & young professionals"
                          className="ui-input-compact"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="ui-label-sm">
                          Call-to-Action Headline (CTA)
                        </label>
                        <input
                          type="text"
                          value={adBriefDraft.callToAction}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              callToAction: e.target.value
                            }))
                          }
                          placeholder="e.g. Order Now — Buy 1 Get 1 Free!"
                          className="ui-input-compact"
                        />
                      </div>

                      <div>
                        <label className="ui-label-sm">
                          CTA Subtext / Website / Promo Code
                        </label>
                        <input
                          type="text"
                          value={adBriefDraft.ctaSubtext}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              ctaSubtext: e.target.value
                            }))
                          }
                          placeholder="e.g. novabrew.in • Use Code BREW2X"
                          className="ui-input-compact"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="ui-label-sm">
                        Ad Concept / Conversational Angle
                      </label>
                      <textarea
                        rows={3}
                        value={adStoryDraft}
                        onChange={(e) => setAdStoryDraft(e.target.value)}
                        placeholder="Describe the conversational hook, pain point, or vibe..."
                        className="ui-textarea"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-heading cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={adBriefDraft.burnInCtaOverlay !== false}
                        onChange={(e) =>
                          setAdBriefDraft((prev) => ({
                            ...prev,
                            burnInCtaOverlay: e.target.checked
                          }))
                        }
                        className="h-4 w-4 accent-primary rounded cursor-pointer"
                      />
                      <span>
                        Burn crisp on-screen headlines &amp; final CTA banner directly into rendered MP4 video
                      </span>
                    </label>
                  </div>

                  {/* Bottom Control Row */}
                  <div className="pt-5 border-t border-theme flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative inline-flex items-center rounded-full bg-primary-tint border border-theme px-3.5 min-h-[46px]">
                        <Icon
                          name="clock"
                          className="w-4 h-4 text-primary mr-2 shrink-0"
                        />
                        <select
                          value={String(adBriefDraft.targetDurationSeconds || 30)}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              targetDurationSeconds: Number(e.target.value) || 30
                            }))
                          }
                          className="bg-transparent text-xs sm:text-sm font-bold text-heading pr-5 py-2 focus:outline-none appearance-none cursor-pointer"
                          aria-label="Target Advertisement Duration"
                        >
                          <option value="15">15s Bumper</option>
                          <option value="30">30s Ad</option>
                          <option value="45">45s Promo</option>
                          <option value="60">60s Brand Ad</option>
                        </select>
                        <Icon
                          name="chevron-down"
                          className="w-3.5 h-3.5 text-primary pointer-events-none -ml-3.5"
                        />
                      </div>

                      <div className="relative inline-flex items-center rounded-full bg-primary-tint border border-theme px-3.5 min-h-[46px]">
                        <Icon
                          name="globe"
                          className="w-4 h-4 text-primary mr-2 shrink-0"
                        />
                        <select
                          value={selectedLanguage}
                          onChange={(e) => handleLanguageChange(e.target.value)}
                          className="bg-transparent text-xs sm:text-sm font-bold text-heading pr-5 py-2 focus:outline-none appearance-none cursor-pointer"
                          aria-label="Ad Language"
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

                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPreset("mobile")}
                          className={`min-h-[46px] px-3.5 py-2 rounded-control inline-flex items-center gap-1.5 text-xs sm:text-sm transition-all cursor-pointer ${
                            selectedPreset === "mobile"
                              ? "bg-primary-soft border-2 border-primary text-primary font-bold"
                              : "bg-surface border border-theme text-body font-medium hover:bg-primary-tint"
                          }`}
                          title="Vertical 9:16 Reels / Shorts Format"
                        >
                          <Icon name="phone" className="w-4 h-4" />
                          <span>9:16</span>
                        </button>

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
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAnalyzeAdBrief}
                      disabled={loading}
                      className="ui-btn-primary lg:min-w-[270px]"
                    >
                      <Icon name="sparkles" className="w-5 h-5" />
                      <span>
                        {loading
                          ? `Analyzing in ${getLanguageShort(selectedLanguage)}...`
                          : `Analyze Ad Strategy (${getLanguageShort(selectedLanguage)})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Gemini Commercial Strategy Card */}
                {activeProject.activeStoryAnalysisId && (
                  <div className="rounded-card bg-primary-soft/75 border border-pastel-lavender p-6 space-y-4 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-base text-primary flex items-center gap-2">
                        <Icon name="sparkles" className="w-4 h-4" />
                        <span>Gemini Commercial Strategy &amp; Ad Blueprint</span>
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

                    {activeProject.activeStoryAnalysisId.adStrategy?.hook && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="bg-surface border border-theme rounded-tile p-3.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                            3-Second Opening Hook
                          </span>
                          <p className="text-xs sm:text-sm font-semibold text-heading mt-1">
                            {activeProject.activeStoryAnalysisId.adStrategy.hook}
                          </p>
                        </div>
                        {activeProject.activeStoryAnalysisId.adStrategy
                          .valueProposition && (
                          <div className="bg-surface border border-theme rounded-tile p-3.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                              Core Value Proposition
                            </span>
                            <p className="text-xs sm:text-sm font-semibold text-heading mt-1">
                              {
                                activeProject.activeStoryAnalysisId.adStrategy
                                  .valueProposition
                              }
                            </p>
                          </div>
                        )}
                        {activeProject.activeStoryAnalysisId.adStrategy
                          .jingleHookIdea && (
                          <div className="bg-surface border border-theme rounded-tile p-3.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                              Catchy Jingle / Sonic Hook Idea
                            </span>
                            <p className="text-xs sm:text-sm text-heading italic mt-1">
                              "
                              {
                                activeProject.activeStoryAnalysisId.adStrategy
                                  .jingleHookIdea
                              }
                              "
                            </p>
                          </div>
                        )}
                        {activeProject.activeStoryAnalysisId.adStrategy
                          .callToActionLine && (
                          <div className="bg-surface border border-theme rounded-tile p-3.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary block">
                              Recommended Closing CTA
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-heading mt-1">
                              {
                                activeProject.activeStoryAnalysisId.adStrategy
                                  .callToActionLine
                              }
                            </p>
                          </div>
                        )}
                      </div>
                    )}

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

                {/* Ad Speakers & Cast */}
                <div
                  ref={castSectionRef}
                  className="ui-card p-6 sm:p-7 space-y-5 scroll-mt-20"
                >
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="font-bold text-heading text-lg flex items-center gap-2">
                        <Icon name="users" className="w-5 h-5 text-primary" />
                        <span>
                          Ad Speakers &amp; Cast (Voice + Visual Consistency)
                        </span>
                      </h4>
                      <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                        {projectCharacters.length}{" "}
                        {projectCharacters.length === 1 ? "Person" : "People"}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-1 leading-relaxed">
                      Define commercial speakers or actors with their voice gender/slot and visual look so both multi-speaker dialogue synthesis and AI scene visuals stay consistent.
                    </p>
                  </div>

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
                                {c.name ? c.name.charAt(0).toUpperCase() : "S"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-heading truncate">
                                  {c.name}
                                </div>
                                <div className="text-xs font-semibold text-primary truncate">
                                  {[
                                    c.role,
                                    c.voiceGender ? `${c.voiceGender} voice` : null
                                  ]
                                    .filter(Boolean)
                                    .join(" • ") || "Speaker"}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTabCharacter(idx)}
                              className="h-8 w-8 rounded-full hover:bg-danger-tint text-muted hover:text-danger flex items-center justify-center transition cursor-pointer shrink-0"
                              title="Remove speaker"
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
                      No custom speakers added yet. Add 1–2 characters below (e.g. Priya &amp; Rohan) or let AI automatically assign distinct voices.
                    </div>
                  )}

                  <form
                    onSubmit={handleAddTabCharacter}
                    className="bg-primary-tint/60 border border-theme rounded-card p-5 space-y-4"
                  >
                    <span className="text-sm font-bold text-heading block">
                      + Add Speaker / Actor to Ad Cast
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-3.5">
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
                        <label className="ui-label-sm">Role in Ad</label>
                        <input
                          type="text"
                          placeholder="e.g. Colleague / Host"
                          value={tabCharRole}
                          onChange={(e) => setTabCharRole(e.target.value)}
                          className="ui-input-compact"
                        />
                      </div>
                      <div>
                        <label className="ui-label-sm">Voice Gender</label>
                        <select
                          value={tabCharVoiceGender}
                          onChange={(e) => setTabCharVoiceGender(e.target.value)}
                          className="ui-select-compact w-full"
                        >
                          <option value="female">Female Voice</option>
                          <option value="male">Male Voice</option>
                        </select>
                      </div>
                      <div>
                        <label className="ui-label-sm">Speaker Slot</label>
                        <select
                          value={tabCharVoiceRole}
                          onChange={(e) => setTabCharVoiceRole(e.target.value)}
                          className="ui-select-compact w-full"
                        >
                          <option value="speaker_a">Speaker A</option>
                          <option value="speaker_b">Speaker B</option>
                          <option value="narrator">Narrator / CTA</option>
                        </select>
                      </div>
                      <div>
                        <label className="ui-label-sm">
                          Visual Appearance &amp; Attire
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Smart casual blazer, warm smile"
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
                            : "Add Speaker to Cast"}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Director Guidelines & Must-Have Commercial Shots */}
                <div className="ui-card p-6 sm:p-7 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-heading text-lg flex items-center gap-2">
                        <Icon name="studio" className="w-5 h-5 text-primary" />
                        <span>Director Guidelines &amp; Must-Have Shots</span>
                      </h4>
                      <p className="text-sm text-muted mt-1">
                        Specify product hero angles, lighting mood, or camera cuts you want Gemini to prioritize in your ad storyboard.
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
                    placeholder="e.g. 1. Opening relatable office hook. 2. Macro product reveal at 5s. 3. Bold end-card with promo code."
                    className="ui-textarea"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: AD SCRIPT, MULTI-SPEAKER VOICES & JINGLE STUDIO */}
            {activeTab === "lyrics" && (
              <div className="space-y-6">
                <div className="ui-container p-6 sm:p-8 space-y-6">
                  <div className="border-b border-theme pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-heading">
                        Ad Script, Multi-Speaker Voices &amp; Jingle Studio
                      </h3>
                      <p className="text-sm text-muted mt-1">
                        Create a conversation-only spot, voiceover + background bed, or a hybrid conversation + sung AI jingle mixup.
                      </p>
                    </div>
                    <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary self-start sm:self-center">
                      {adBriefDraft.audioMode === "dialogue_only"
                        ? "No Music • Dialogue Only"
                        : adBriefDraft.audioMode === "dialogue_bgm"
                          ? "Conversation + Soft BGM"
                          : adBriefDraft.audioMode === "visual_only"
                            ? "Visual Kinetic Ad"
                            : "Conversation + Sung Jingle"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="ui-label-sm">
                        Ad Audio &amp; Song Mode
                      </label>
                      <select
                        value={adBriefDraft.audioMode}
                        onChange={(e) =>
                          setAdBriefDraft((prev) => ({
                            ...prev,
                            audioMode: e.target.value
                          }))
                        }
                        className="ui-select"
                      >
                        <option value="hybrid_conversation_song">
                          Conversation + Sung Jingle Mix
                        </option>
                        <option value="dialogue_bgm">
                          Conversation + Soft BGM (No Singing)
                        </option>
                        <option value="dialogue_only">
                          Conversation / Voiceover Only (No Music)
                        </option>
                        <option value="visual_only">
                          Visual Kinetic Ad Only (No Voiceover)
                        </option>
                      </select>
                    </div>

                    {adBriefDraft.audioMode !== "visual_only" && (
                      <div>
                        <label className="ui-label-sm">
                          Dialogue / Speaker Format
                        </label>
                        <select
                          value={adBriefDraft.speakerFormat}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              speakerFormat: e.target.value
                            }))
                          }
                          className="ui-select"
                        >
                          <option value="two_speaker_chat">
                            2-Person Conversation + Announcer CTA
                          </option>
                          <option value="single_narrator">
                            Single Commercial Voiceover Narrator
                          </option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="ui-label-sm">
                        Target Commercial Duration
                      </label>
                      <select
                        value={String(adBriefDraft.targetDurationSeconds || 30)}
                        onChange={(e) =>
                          setAdBriefDraft((prev) => ({
                            ...prev,
                            targetDurationSeconds: Number(e.target.value) || 30
                          }))
                        }
                        className="ui-select"
                      >
                        <option value="15">15s Bumper / Reels Spot</option>
                        <option value="30">30s Standard Commercial</option>
                        <option value="45">45s Promo Reel</option>
                        <option value="60">60s Full Brand Ad</option>
                      </select>
                    </div>

                    <div>
                      <label className="ui-label-sm">
                        Script &amp; Voice Language
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

                    {adBriefDraft.audioMode !== "dialogue_only" && (
                      <div>
                        <label className="ui-label-sm">
                          {adBriefDraft.audioMode === "hybrid_conversation_song"
                            ? "Jingle & Underscore Style"
                            : "Instrumental Background Style"}
                        </label>
                        <select
                          value={adBriefDraft.bgmStyle || "Upbeat Commercial"}
                          onChange={(e) =>
                            setAdBriefDraft((prev) => ({
                              ...prev,
                              bgmStyle: e.target.value
                            }))
                          }
                          className="ui-select"
                        >
                          <option value="Upbeat Commercial">
                            Upbeat Commercial Pop
                          </option>
                          <option value="Warm Acoustic Corporate">
                            Warm Acoustic &amp; Piano
                          </option>
                          <option value="Modern Tech Synth">
                            Modern Tech &amp; Startup Pulse
                          </option>
                          <option value="Festive Bollywood Fusion">
                            Festive Indian / Hinglish Groove
                          </option>
                          <option value="Luxury Minimalist">
                            Luxury Lounge &amp; Minimalist
                          </option>
                          <option value="High-Energy EDM">
                            High-Energy Event Drop
                          </option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="ui-label-sm">
                        Voice &amp; Jingle Engine
                      </label>
                      <select
                        value={selectedMusicProvider}
                        onChange={(e) =>
                          setSelectedMusicProvider(e.target.value)
                        }
                        className="ui-select"
                      >
                        <option value="google_lyria">
                          Google Neural2 Voices + Lyria 3 Pro Jingle
                        </option>
                        <option value="elevenlabs">
                          ElevenLabs Expressive Voices &amp; Music
                        </option>
                        <option value="google_tts">
                          Google Cloud Neural2 Studio TTS
                        </option>
                      </select>
                    </div>
                  </div>

                  {adBriefDraft.audioMode === "visual_only" && (
                    <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-heading bg-primary-tint/70 border border-theme px-4 py-3 rounded-tile cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeVisualBgm}
                        onChange={(e) => setIncludeVisualBgm(e.target.checked)}
                        className="h-4 w-4 accent-primary rounded cursor-pointer"
                      />
                      <span>
                        Include instrumental background soundtrack (uncheck for a completely silent kinetic typography MP4)
                      </span>
                    </label>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-theme">
                    <button
                      type="button"
                      onClick={handleGenerateAdScript}
                      disabled={loading || synthesizingAdAudio}
                      className="ui-btn-secondary-sm border-primary text-primary bg-primary-soft/60 min-h-[46px] px-5"
                    >
                      <Icon name="sparkles" className="w-4 h-4" />
                      <span>
                        {loading
                          ? "Drafting Script..."
                          : adSegmentsDraft.length > 0
                            ? "1. Regenerate AI Ad Script"
                            : "1. Generate AI Ad Script"}
                      </span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {adSegmentsDraft.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveAdScript}
                          disabled={savingAdScript || synthesizingAdAudio}
                          className="ui-btn-secondary-sm min-h-[46px] px-4"
                        >
                          <Icon name="check" className="w-4 h-4 text-primary" />
                          <span>
                            {savingAdScript ? "Saving..." : "Save Script Edits"}
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSynthesizeAdAudio}
                        disabled={synthesizingAdAudio || loading}
                        className="ui-btn-primary"
                      >
                        <Icon name="music" className="w-5 h-5" />
                        <span>
                          {synthesizingAdAudio
                            ? "Synthesizing & Mixing Ad Audio..."
                            : adBriefDraft.audioMode === "dialogue_only"
                              ? "2. Synthesize Conversation Audio"
                              : adBriefDraft.audioMode === "visual_only"
                                ? "2. Build Visual Ad Soundtrack"
                                : "2. Synthesize & Mix Ad Audio"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mastered Ad Audio Player Card */}
                {activeProject.activeSongId?.audioUrl && (
                  <div className="bg-pastel-mint border border-theme p-5 rounded-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-tile bg-surface text-primary flex items-center justify-center">
                          <Icon name="music" className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-bold text-heading">
                          Mastered Commercial Audio Track Ready
                        </span>
                      </div>
                      <p className="text-xs text-body font-medium">
                        {activeProject.activeSongId.trackMode === "dialogue_only"
                          ? "Multi-Speaker Conversation (No Music)"
                          : activeProject.activeSongId.trackMode ===
                              "dialogue_bgm"
                            ? "Conversation + Auto-Ducked Background Music"
                            : activeProject.activeSongId.trackMode ===
                                "visual_only"
                              ? "Visual Kinetic Ad Track"
                              : "Hybrid Conversation + Sung Jingle Mix"}
                        {" • "}
                        {activeProject.activeSongId.durationSeconds || 30}s
                        {" • "}
                        {getLanguageShort(
                          activeProject.activeSongId.language ||
                            selectedLanguage
                        )}
                      </p>
                    </div>
                    <audio
                      key={activeProject.activeSongId.audioUrl}
                      controls
                      src={activeProject.activeSongId.audioUrl}
                      className="h-11 w-full md:w-80"
                    />
                  </div>
                )}

                {/* Interactive Commercial Script Block Timeline Editor */}
                <div className="ui-card p-6 sm:p-7 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-4">
                    <div>
                      <h4 className="font-bold text-lg text-heading">
                        Commercial Script &amp; Segment Timeline (
                        {adSegmentsDraft.length}{" "}
                        {adSegmentsDraft.length === 1 ? "Block" : "Blocks"})
                      </h4>
                      <p className="text-xs sm:text-sm text-muted mt-0.5">
                        Mix spoken conversation lines, sung jingle hooks, voiceover CTAs, and on-screen headlines in any sequence.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddAdSegment("dialogue")}
                        className="ui-btn-secondary-sm text-xs px-3 py-1.5"
                      >
                        + Dialogue
                      </button>
                      {adBriefDraft.audioMode === "hybrid_conversation_song" && (
                        <button
                          type="button"
                          onClick={() => handleAddAdSegment("sung_jingle")}
                          className="ui-btn-secondary-sm text-primary border-primary/40 bg-primary-soft/50 text-xs px-3 py-1.5"
                        >
                          + Sung Jingle
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAddAdSegment("narration")}
                        className="ui-btn-secondary-sm text-xs px-3 py-1.5"
                      >
                        + CTA Voiceover
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddAdSegment("visual_beat")}
                        className="ui-btn-secondary-sm text-xs px-3 py-1.5"
                      >
                        + Visual Beat
                      </button>
                    </div>
                  </div>

                  {adSegmentsDraft.length > 0 ? (
                    <div className="space-y-3.5">
                      {adSegmentsDraft.map((seg, idx) => {
                        const isJingle = seg.segmentType === "sung_jingle";
                        const isVisualBeat = seg.segmentType === "visual_beat";
                        return (
                          <div
                            key={idx}
                            className={`rounded-card p-4 sm:p-5 border space-y-3.5 transition ${
                              isJingle
                                ? "bg-primary-soft/65 border-pastel-lavender"
                                : isVisualBeat
                                  ? "bg-pastel-mint/45 border-theme"
                                  : "bg-primary-tint/55 border-theme"
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="h-7 w-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="ui-chip bg-surface border-theme text-primary text-xs">
                                  {seg.startTimeSeconds !== undefined &&
                                  seg.endTimeSeconds !== undefined
                                    ? `${seg.startTimeSeconds}s – ${seg.endTimeSeconds}s`
                                    : `~${seg.targetDurationSeconds || 4}s`}
                                </span>
                                {isJingle && (
                                  <span className="ui-chip bg-primary text-white text-[11px]">
                                    Sung Jingle Hook
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveAdSegment(idx, -1)}
                                  className="px-2.5 py-1 rounded-full bg-surface border border-theme text-xs font-bold text-heading disabled:opacity-40 cursor-pointer"
                                  title="Move block earlier"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === adSegmentsDraft.length - 1}
                                  onClick={() => handleMoveAdSegment(idx, 1)}
                                  className="px-2.5 py-1 rounded-full bg-surface border border-theme text-xs font-bold text-heading disabled:opacity-40 cursor-pointer"
                                  title="Move block later"
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAdSegment(idx)}
                                  className="px-2.5 py-1 rounded-full bg-surface hover:bg-danger-tint border border-theme text-xs font-bold text-danger cursor-pointer"
                                  title="Remove block"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                              <div>
                                <label className="ui-label-sm">Block Type</label>
                                <select
                                  value={seg.segmentType || "dialogue"}
                                  onChange={(e) =>
                                    handleUpdateAdSegment(
                                      idx,
                                      "segmentType",
                                      e.target.value
                                    )
                                  }
                                  className="ui-select-compact w-full text-xs"
                                >
                                  <option value="dialogue">
                                    Spoken Dialogue
                                  </option>
                                  <option value="narration">
                                    Narrator / CTA Voiceover
                                  </option>
                                  <option value="sung_jingle">
                                    Sung AI Jingle Hook
                                  </option>
                                  <option value="visual_beat">
                                    Visual / Kinetic Beat (No Voice)
                                  </option>
                                </select>
                              </div>

                              {!isVisualBeat && (
                                <div>
                                  <label className="ui-label-sm">
                                    Speaker / Vocal Label
                                  </label>
                                  <input
                                    type="text"
                                    value={seg.speakerName || ""}
                                    onChange={(e) =>
                                      handleUpdateAdSegment(
                                        idx,
                                        "speakerName",
                                        e.target.value
                                      )
                                    }
                                    placeholder="e.g. Priya / Announcer"
                                    className="ui-input-compact text-xs"
                                  />
                                </div>
                              )}

                              {!isVisualBeat && (
                                <div>
                                  <label className="ui-label-sm">
                                    Voice Gender
                                  </label>
                                  <select
                                    value={seg.voiceGender || "female"}
                                    onChange={(e) =>
                                      handleUpdateAdSegment(
                                        idx,
                                        "voiceGender",
                                        e.target.value
                                      )
                                    }
                                    className="ui-select-compact w-full text-xs"
                                  >
                                    <option value="female">Female Voice</option>
                                    <option value="male">Male Voice</option>
                                  </select>
                                </div>
                              )}

                              {!isVisualBeat && !isJingle && (
                                <div>
                                  <label className="ui-label-sm">
                                    Voice Slot
                                  </label>
                                  <select
                                    value={seg.voiceRole || "speaker_a"}
                                    onChange={(e) =>
                                      handleUpdateAdSegment(
                                        idx,
                                        "voiceRole",
                                        e.target.value
                                      )
                                    }
                                    className="ui-select-compact w-full text-xs"
                                  >
                                    <option value="speaker_a">Speaker A</option>
                                    <option value="speaker_b">Speaker B</option>
                                    <option value="narrator">
                                      Commercial Announcer
                                    </option>
                                  </select>
                                </div>
                              )}

                              <div>
                                <label className="ui-label-sm">
                                  Target Secs
                                </label>
                                <input
                                  type="number"
                                  min={2}
                                  max={25}
                                  value={seg.targetDurationSeconds || 4}
                                  onChange={(e) =>
                                    handleUpdateAdSegment(
                                      idx,
                                      "targetDurationSeconds",
                                      Math.max(
                                        2,
                                        Math.min(
                                          25,
                                          Number(e.target.value) || 4
                                        )
                                      )
                                    )
                                  }
                                  className="ui-input-compact text-xs"
                                />
                              </div>
                            </div>

                            {!isVisualBeat && (
                              <div>
                                <label className="ui-label-sm">
                                  {isJingle
                                    ? "Sung Jingle Lyrics (Catchy 2–4 Rhyming Lines)"
                                    : "Spoken Dialogue / Voiceover Script"}
                                </label>
                                <textarea
                                  rows={2}
                                  value={seg.text || ""}
                                  onChange={(e) =>
                                    handleUpdateAdSegment(
                                      idx,
                                      "text",
                                      e.target.value
                                    )
                                  }
                                  placeholder={
                                    isJingle
                                      ? "Write 2–4 catchy rhyming jingle chorus lines..."
                                      : "Write natural conversational dialogue or crisp voiceover copy..."
                                  }
                                  className="ui-textarea text-sm"
                                />
                              </div>
                            )}

                            <div>
                              <label className="ui-label-sm">
                                On-Screen Headline / Banner Text (Optional)
                              </label>
                              <input
                                type="text"
                                value={seg.onScreenHeadline || ""}
                                onChange={(e) =>
                                  handleUpdateAdSegment(
                                    idx,
                                    "onScreenHeadline",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Zero Sugar • Buy 1 Get 1 Free"
                                className="ui-input-compact text-xs"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-primary-tint/65 border border-dashed border-pastel-lavender rounded-card p-8 text-center space-y-3">
                      <p className="text-sm font-bold text-heading">
                        No commercial script blocks yet
                      </p>
                      <p className="text-xs sm:text-sm text-muted max-w-lg mx-auto">
                        Click{" "}
                        <strong className="text-primary">
                          "1. Generate AI Ad Script"
                        </strong>{" "}
                        above to draft a timed multi-speaker or hybrid jingle script automatically, or add blocks manually.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PRODUCT, BRAND & EVENT MEDIA */}
            {activeTab === "media" && (
              <div className="bg-mint-fade rounded-container border border-theme p-6 sm:p-8 space-y-6 shadow-soft">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-heading">
                      Product, Brand &amp; Event Media ({mediaItems.length})
                    </h3>
                    <p className="text-sm text-muted mt-1">
                      Upload product shots, brand visuals, or promo clips (.mp4, .mov). Leave empty to generate 100% AI commercial visuals.
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
                            alt="Ad media"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="ui-badge-overlay absolute top-3 left-3">
                          {isVideo ? "VIDEO" : "PHOTO"}
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
                          Pure AI Commercial Visuals Active
                        </p>
                        <p className="text-sm text-muted max-w-xl mx-auto">
                          No media uploaded. In Step 4, click{" "}
                          <strong className="text-primary">
                            "Sync Storyboard with Ad Script"
                          </strong>{" "}
                          and Gemini AI will automatically generate photorealistic commercial cuts for every beat.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("storyboard")}
                        className="ui-btn-primary-sm"
                      >
                        <Icon name="studio" className="w-4 h-4" />
                        <span>Proceed to Step 4 (Ad Storyboard)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: AD STORYBOARD & COMMERCIAL TIMELINE */}
            {activeTab === "storyboard" && (
              <div className="space-y-6">
                <div className="ui-card p-6 sm:p-7 space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-xl font-bold text-heading">
                          Ad Storyboard &amp; Commercial Timeline
                        </h3>
                        <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                          <span>
                            {activeProject.activeSongId?.durationSeconds ||
                              adBriefDraft.targetDurationSeconds ||
                              30}
                            s Ad
                          </span>
                          <span>•</span>
                          <span>
                            {activeProject.activeStoryboardId?.scenes?.length ||
                              0}{" "}
                            Cuts (~3-5s each)
                          </span>
                          <span>•</span>
                          <span>
                            {getLanguageShort(
                              activeProject.language || selectedLanguage
                            )}
                          </span>
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        Each commercial cut is aligned to your spoken dialogue, sung jingle chorus, on-screen headline, and closing CTA end-card.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateAllImages(true)}
                        disabled={
                          generatingAllImages ||
                          loading ||
                          !activeProject.activeStoryboardId
                        }
                        className="ui-btn-secondary-sm text-primary"
                        title="Synthesize watermark-free Google AI commercial images for all scenes"
                      >
                        <Icon name="image" className="w-4 h-4" />
                        <span>
                          {generatingAllImages
                            ? "Generating AI Images..."
                            : "Generate AI Images (All)"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateAllVeo}
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
                            ? "Generating Omni Video Clips..."
                            : "Generate Omni Video Clips (All)"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateStoryboard}
                        disabled={loading}
                        className="ui-btn-primary-sm"
                      >
                        <Icon name="rocket" className="w-4 h-4" />
                        <span>
                          {loading
                            ? "Synchronizing Storyboard..."
                            : "Sync Storyboard with Ad Script"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {activeProject.activeStoryboardId && (
                  <div className="bg-mint-fade rounded-container border border-theme p-6 sm:p-7 space-y-5">
                    {activeProject.activeStoryboardId.scenes?.some((s) => {
                      const m = mediaItems.find(
                        (item) =>
                          item._id === s.mediaId || item._id === s.mediaId?._id
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
                          <strong>Pro Tip:</strong> Your cuts currently use static image frames. Click{" "}
                          <strong className="text-primary">
                            "Generate Omni Video Clips (All)"
                          </strong>{" "}
                          to render smooth motion video for each commercial cut.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {activeProject.activeStoryboardId.scenes?.map(
                        (scene, idx) => {
                          const media =
                            mediaItems.find(
                              (m) =>
                                m._id === scene.mediaId ||
                                m._id === scene.mediaId?._id
                            ) ||
                            mediaItems[idx % Math.max(1, mediaItems.length)];
                          const isVideoMedia =
                            media &&
                            (media.mediaType === "video" ||
                              [".mp4", ".webm", ".mov"].some((ext) =>
                                media.fileUrl?.toLowerCase().endsWith(ext)
                              ));
                          const sceneDuration = Math.max(
                            1,
                            Math.round(
                              (scene.endTimeSeconds || 4) -
                                (scene.startTimeSeconds || 0)
                            )
                          );
                          const effectiveHeadline =
                            sceneDraftHeadlines[idx] !== undefined
                              ? sceneDraftHeadlines[idx]
                              : scene.onScreenHeadline || "";
                          const segmentLabel =
                            scene.segmentType === "sung_jingle"
                              ? "Sung Jingle Hook"
                              : scene.segmentType === "cta_endcard"
                                ? `CTA End-Card${scene.speakerName ? ` • ${scene.speakerName}` : ""}`
                                : scene.segmentType === "visual_card"
                                  ? "Visual Beat"
                                  : `Dialogue${scene.speakerName ? ` • ${scene.speakerName}` : ""}`;

                          return (
                            <div
                              key={idx}
                              className="bg-surface border border-theme rounded-card overflow-hidden shadow-subtle flex flex-col justify-between"
                            >
                              {media ? (
                                <div className="h-48 bg-primary-tint overflow-hidden relative group">
                                  {isVideoMedia ? (
                                    <video
                                      src={media.fileUrl}
                                      className="w-full h-full object-cover"
                                      muted
                                      loop
                                      autoPlay
                                      controls
                                    />
                                  ) : (
                                    <img
                                      src={media.fileUrl}
                                      alt="Ad cut media"
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  <span className="ui-badge-overlay absolute top-3 left-3">
                                    Cut {scene.sceneNumber} •{" "}
                                    {scene.startTimeSeconds}s-
                                    {scene.endTimeSeconds}s ({sceneDuration}s) •{" "}
                                    {isVideoMedia ? "VIDEO" : "PHOTO"}
                                  </span>
                                </div>
                              ) : (
                                <div className="h-48 bg-primary-tint relative flex items-center justify-center text-muted text-xs font-semibold">
                                  <span className="ui-badge-overlay absolute top-3 left-3">
                                    Cut {scene.sceneNumber} • {sceneDuration}s
                                  </span>
                                  <span>Cut {scene.sceneNumber} Frame</span>
                                </div>
                              )}

                              <div className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                  {(scene.lyricSnippet ||
                                    scene.segmentType === "visual_card") && (
                                    <div className="bg-primary-soft/80 border border-pastel-lavender p-3 rounded-[16px]">
                                      <span className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                        <Icon
                                          name={
                                            scene.segmentType === "sung_jingle"
                                              ? "music"
                                              : "sparkles"
                                          }
                                          className="w-3.5 h-3.5"
                                        />
                                        <span>{segmentLabel}</span>
                                      </span>
                                      {scene.lyricSnippet && (
                                        <p className="text-xs font-semibold text-heading italic mt-1">
                                          "{scene.lyricSnippet}"
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {effectiveHeadline &&
                                    editingSceneIdx !== idx && (
                                      <div className="bg-pastel-mint/75 border border-theme px-3 py-2 rounded-tile">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                                          On-Screen Banner / CTA
                                        </span>
                                        <p className="text-xs font-bold text-primary mt-0.5">
                                          {effectiveHeadline}
                                        </p>
                                      </div>
                                    )}

                                  {projectCharacters.length > 0 && (
                                    <div>
                                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                                        Cast in Cut
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
                                              title={`Toggle ${c.name} in this cut`}
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
                                            if (
                                              sceneDraftHeadlines[idx] ===
                                              undefined
                                            ) {
                                              setSceneDraftHeadlines((prev) => ({
                                                ...prev,
                                                [idx]:
                                                  scene.onScreenHeadline || ""
                                              }));
                                            }
                                          }}
                                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                                        >
                                          Edit Shot &amp; Banner
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
                                          placeholder="Describe the commercial shot, product angle, and camera motion..."
                                        />
                                        <div>
                                          <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                                            On-Screen Headline / CTA Overlay
                                          </label>
                                          <input
                                            type="text"
                                            value={
                                              sceneDraftHeadlines[idx] !==
                                              undefined
                                                ? sceneDraftHeadlines[idx]
                                                : scene.onScreenHeadline || ""
                                            }
                                            onChange={(e) =>
                                              setSceneDraftHeadlines(
                                                (prev) => ({
                                                  ...prev,
                                                  [idx]: e.target.value
                                                })
                                              )
                                            }
                                            placeholder="e.g. Buy 1 Get 1 Free • Order Today"
                                            className="ui-input-compact text-xs"
                                          />
                                        </div>
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
                                              : "Save Cut"}
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

                                  {mediaItems.length > 0 && (
                                    <div>
                                      <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                                        Source Visual Media
                                      </label>
                                      <select
                                        value={
                                          scene.mediaId?._id ||
                                          scene.mediaId ||
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
                                          AI Frame / Default Media
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
                                            )
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

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

            {/* TAB 5: RENDER SHORT ADVERTISEMENT & PREVIEW */}
            {activeTab === "render" && (
              <div className="space-y-6">
                <div className="rounded-container border-2 border-primary bg-primary-tint p-6 sm:p-8 shadow-soft space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-primary flex items-center gap-2.5">
                        <span className="h-10 w-10 rounded-tile bg-indigo-tile text-white flex items-center justify-center shrink-0">
                          <Icon name="rocket" className="w-5 h-5" />
                        </span>
                        <span>Render Short Advertisement Video</span>
                      </h3>
                      <p className="text-sm text-body mt-1.5">
                        Master your commercial visual cuts, multi-speaker dialogue / jingle soundtrack, burned-in CTA headlines, and subtitles into an ad-ready MP4.
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
                          ? "Rendering Ad..."
                          : `Start Render (${
                              videoPresets[selectedPreset]?.shortLabel ||
                              "Mobile 9:16"
                            })`}
                      </span>
                    </button>
                  </div>

                  {/* Burn-In CTA Banner Toggle */}
                  <div className="bg-surface rounded-card border border-theme px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-heading cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={adBriefDraft.burnInCtaOverlay !== false}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          const nextBrief = {
                            ...adBriefDraft,
                            burnInCtaOverlay: checked
                          };
                          setAdBriefDraft(nextBrief);
                          try {
                            await api(
                              `/api/story-video/projects/${activeProject._id}`,
                              {
                                token,
                                method: "PATCH",
                                body: { adBrief: nextBrief }
                              }
                            );
                          } catch (_) {}
                        }}
                        className="h-4 w-4 accent-primary rounded cursor-pointer"
                      />
                      <span>
                        Burn on-screen scene headlines &amp; final Call-to-Action banner into rendered MP4
                      </span>
                    </label>
                    {adBriefDraft.callToAction && (
                      <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary text-xs">
                        CTA: {adBriefDraft.callToAction}
                      </span>
                    )}
                  </div>

                  {/* Target Display Resolution / Orientation Selector */}
                  <div className="space-y-3 pt-4 border-t border-pastel-lavender">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-heading">
                        Choose Target Ad Format &amp; Orientation
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
                            onClick={() => setSelectedPreset(preset.id)}
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

                  {/* Motion Video Notice + Spec Summary Box */}
                  {(() => {
                    const totalScenes =
                      activeProject.activeStoryboardId?.scenes?.length || 0;
                    const videoSceneCount =
                      activeProject.activeStoryboardId?.scenes?.filter((s) => {
                        const m = mediaItems.find(
                          (item) =>
                            item._id === s.mediaId ||
                            item._id === s.mediaId?._id
                        );
                        return (
                          m &&
                          (m.mediaType === "video" ||
                            [".mp4", ".webm", ".mov"].some((ext) =>
                              m.fileUrl?.toLowerCase().endsWith(ext)
                            ))
                        );
                      }).length || 0;

                    const activeTrackMode =
                      activeProject.activeSongId?.trackMode ||
                      adBriefDraft.audioMode;
                    const audioTrackLabel =
                      activeTrackMode === "dialogue_only"
                        ? "Dialogue Only (No Music)"
                        : activeTrackMode === "dialogue_bgm"
                          ? "Dialogue + Soft BGM"
                          : activeTrackMode === "visual_only"
                            ? "Visual Kinetic Ad"
                            : "Conversation + Jingle Mix";

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
                                cuts are still frames. For smooth motion video, open{" "}
                                <strong>Ad Storyboard</strong> and click{" "}
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

                        <div className="bg-surface rounded-card border border-theme p-5 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Ad Duration
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              {activeProject.activeSongId?.durationSeconds
                                ? `${activeProject.activeSongId.durationSeconds}s`
                                : `${adBriefDraft.targetDurationSeconds || 30}s`}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Visual Format
                            </div>
                            <div className="font-bold text-primary mt-0.5">
                              {videoSceneCount > 0
                                ? `${videoSceneCount}/${totalScenes} Omni Videos`
                                : "Static / Ken Burns"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Audio Mode
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              {audioTrackLabel}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted font-medium">
                              Target Resolution
                            </div>
                            <div className="font-bold text-heading mt-0.5">
                              {videoPresets[selectedPreset]?.shortLabel ||
                                "Mobile (9:16)"}{" "}
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

                  {/* Render Progress Bar */}
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

                {/* Final Rendered Advertisement Video Preview Player */}
                {activeProject.activeVideoId?.videoUrl && (
                  <div className="ui-card p-6 sm:p-7 space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-3 border-b border-theme pb-4">
                      <h4 className="font-bold text-lg text-heading flex items-center gap-2">
                        <Icon
                          name="rocket"
                          className="w-5 h-5 text-primary"
                        />
                        <span>Rendered Advertisement Video Preview</span>
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="ui-chip bg-pastel-mint border-theme text-heading">
                          {activeProject.activeVideoId.resolution || "1080x1920"}
                        </span>
                        {activeProject.activeVideoId.aspectRatio && (
                          <span className="ui-chip bg-primary-soft border-pastel-lavender text-primary">
                            {activeProject.activeVideoId.aspectRatio}
                          </span>
                        )}
                        <span className="ui-chip bg-primary-tint border-theme text-heading">
                          {getLanguageShort(
                            activeProject.activeVideoId.language ||
                              activeProject.language
                          )}
                        </span>
                        <a
                          href={
                            activeProject.activeVideoId.subtitlesUrl ||
                            `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.srt`
                          }
                          download={`ad_subtitles_${
                            activeProject.activeVideoId.language ||
                            activeProject.language ||
                            "track"
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
                            activeProject.activeVideoId.vttUrl ||
                            `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`
                          }
                          download={`ad_subtitles_${
                            activeProject.activeVideoId.language ||
                            activeProject.language ||
                            "track"
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
                          href={activeProject.activeVideoId.videoUrl}
                          download={`short_ad_${
                            activeProject.activeVideoId.preset || "final"
                          }.mp4`}
                          target="_blank"
                          rel="noreferrer"
                          className="ui-btn-primary-sm text-xs px-4"
                        >
                          <Icon name="download" className="w-4 h-4" />
                          <span>Download Ad MP4</span>
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-center bg-primary-tint rounded-card p-4 sm:p-6 border border-pastel-lavender">
                      <video
                        key={activeProject.activeVideoId.videoUrl}
                        controls
                        crossOrigin="anonymous"
                        className="max-h-[520px] w-auto max-w-full rounded-[18px] shadow-soft border border-theme bg-black"
                      >
                        <source
                          src={activeProject.activeVideoId.videoUrl}
                          type="video/mp4"
                        />
                        <track
                          kind="subtitles"
                          src={
                            activeProject.activeVideoId.vttUrl ||
                            `${API_BASE}/api/story-video/projects/${activeProject._id}/subtitles.vtt`
                          }
                          srcLang={
                            activeProject.activeVideoId.language ||
                            activeProject.language ||
                            "en"
                          }
                          label={`${getLanguageShort(
                            activeProject.activeVideoId.language ||
                              activeProject.language
                          )} Subtitles`}
                          default
                        />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  </div>
                )}
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
                  <span>Next: {nextStudioTab.shortLabel}</span>
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
          /* Empty State Card when no Short Ad exists yet in active scope */
          <div className="ui-container p-8 sm:p-12 text-center space-y-5">
            <div className="flex flex-wrap items-center justify-center gap-3.5 pb-2">
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[18px] bg-pastel-mint border-2 border-dashed border-primary/20 text-heading text-xs sm:text-sm font-bold -rotate-2">
                <Icon name="rocket" className="w-4 h-4 text-primary" />
                <span>15s–60s Reels &amp; Commercials</span>
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[18px] bg-primary-soft border-2 border-dashed border-primary/25 text-primary text-xs sm:text-sm font-bold rotate-2">
                <Icon name="music" className="w-4 h-4 text-primary" />
                <span>Dialogue, BGM &amp; Sung Jingles</span>
              </span>
            </div>

            <div className="max-w-lg mx-auto space-y-2">
              <h3 className="text-xl font-bold text-heading">
                {isStandaloneWorkspace
                  ? "No standalone brand or product ads yet"
                  : `No short promo ads created${selectedEvent ? ` for "${selectedEvent.title}"` : ""} yet`}
              </h3>
              <p className="text-sm text-muted">
                {isStandaloneWorkspace
                  ? "Create 15s–60s brand commercials with conversation-only dialogue, voiceover + background bed, or a hybrid conversation + sung jingle — no event required."
                  : "Create punchy 15s–60s event promotional ads with multi-speaker conversation, voiceover + BGM, or a catchy AI jingle."}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={openCreateAdModal}
                disabled={!selectedEventId && !canUseStandalone}
                className="ui-btn-primary"
              >
                <Icon name="rocket" className="w-5 h-5" />
                <span>Create Short Advertisement</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
