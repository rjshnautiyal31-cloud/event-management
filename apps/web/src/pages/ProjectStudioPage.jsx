import { useState, useEffect } from "react";
import { api } from "../api.js";
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

  // Genre Selection State
  const [selectedGenre, setSelectedGenre] = useState("Pop");

  // Media State
  const [mediaItems, setMediaItems] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Job Polling State
  const [activeJob, setActiveJob] = useState(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

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
    }
  }, [activeProject]);

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
        body: { eventId: selectedEventId, title: newTitle, storyText: newStory }
      });
      setSuccess("Story Project created for Event successfully!");
      setNewTitle("");
      setNewTitleStory("");
      setShowCreateModal(false);
      await loadProjects(selectedEventId);
      setActiveProject(project);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeStory() {
    if (!activeProject) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const analysis = await api(`/api/story-video/projects/${activeProject._id}/analyze`, {
        token,
        method: "POST"
      });
      setSuccess("Story analyzed with Gemini AI!");
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
      await api(`/api/story-video/projects/${activeProject._id}/lyrics`, {
        token,
        method: "POST",
        body: { genre: selectedGenre }
      });
      setSuccess("AI Lyrics & synth audio track generated!");
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
      setActiveTab("media");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      await api(`/api/story-video/projects/${activeProject._id}/storyboard`, {
        token,
        method: "POST"
      });
      setSuccess("Storyboard timeline generated!");
      const updated = await api(`/api/story-video/projects/${activeProject._id}`, { token });
      setActiveProject(updated);
      setActiveTab("render");
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
        method: "POST"
      });

      setSuccess("Video rendering task queued...");
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
                <div className="font-bold truncate">{proj.title}</div>
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
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{activeProject.title}</h3>
                    <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap">
                      {activeProject.storyText}
                    </p>
                  </div>

                  <button
                    onClick={handleAnalyzeStory}
                    disabled={loading}
                    className="bg-[#0A2D59] text-white hover:bg-slate-800 font-bold px-6 py-3 rounded-xl shadow text-sm transition flex items-center gap-2"
                  >
                    <span>✨</span> {loading ? "Analyzing with Gemini AI..." : "Analyze Story Narrative"}
                  </button>

                  {activeProject.activeStoryAnalysisId && (
                    <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl space-y-3 text-sm">
                      <h4 className="font-bold text-[#0A2D59]">Gemini Analysis Summary</h4>
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
                </div>
              )}

              {/* Tab 2: Lyrics & Music */}
              {activeTab === "lyrics" && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-bold text-slate-700">Select Music Style:</label>
                    <select
                      value={selectedGenre}
                      onChange={(e) => setSelectedGenre(e.target.value)}
                      className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[#0A2D59]"
                    >
                      <option value="Pop">Pop</option>
                      <option value="Acoustic">Acoustic</option>
                      <option value="Cinematic">Cinematic</option>
                      <option value="Rock">Rock</option>
                    </select>
                    <button
                      onClick={handleGenerateLyrics}
                      disabled={loading}
                      className="bg-[#0A2D59] text-white hover:bg-slate-800 font-bold px-5 py-2 rounded-xl text-sm transition"
                    >
                      {loading ? "Generating..." : "Generate Lyrics & Audio"}
                    </button>
                  </div>

                  {activeProject.activeSongId && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h4 className="font-black text-sm text-slate-700 mb-2">Generated AI Lyrics</h4>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                          {activeProject.activeSongId.lyrics}
                        </pre>
                      </div>

                      {activeProject.activeSongId.audioUrl && (
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900">🎵 Audio Track Ready:</span>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Scene Storyboard & Timeline</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Maps story key moments to uploaded event photos, video clips, and AI scenes.</p>
                    </div>
                    <button
                      onClick={handleGenerateStoryboard}
                      disabled={loading}
                      className="bg-[#0A2D59] text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow hover:bg-slate-800 transition"
                    >
                      {loading ? "Generating Storyboard..." : "Generate Scene Storyboard"}
                    </button>
                  </div>

                  {activeProject.activeStoryboardId && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeProject.activeStoryboardId.scenes?.map((scene, idx) => {
                          const media = mediaItems.find(m => m._id === scene.mediaId || m._id === scene.mediaId?._id) || mediaItems[idx % mediaItems.length];
                          const isVideoMedia = media && (media.mediaType === "video" || [".mp4", ".webm", ".mov"].some(ext => media.fileUrl?.toLowerCase().endsWith(ext)));

                          return (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
                              {media ? (
                                <div className="h-36 bg-slate-200 overflow-hidden relative">
                                  {isVideoMedia ? (
                                    <video src={media.fileUrl} className="w-full h-full object-cover" muted loop autoPlay />
                                  ) : (
                                    <img src={media.fileUrl} alt="scene media" className="w-full h-full object-cover" />
                                  )}
                                  <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    Scene {scene.sceneNumber} • {scene.startTimeSeconds}s - {scene.endTimeSeconds}s {isVideoMedia ? "🎬 Video" : "📷 Photo"}
                                  </div>
                                </div>
                              ) : (
                                <div className="h-36 bg-slate-100 flex items-center justify-center text-slate-400 text-xs font-medium">
                                  Fallback Cover Image
                                </div>
                              )}
                              <div className="p-3.5 space-y-1">
                                <div className="font-bold text-xs text-slate-800">Visual Caption:</div>
                                <p className="text-xs text-slate-600 line-clamp-2">{scene.captionText}</p>
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
                  <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-black flex items-center gap-2">🚀 Render Professional Event Video</h3>
                        <p className="text-xs text-slate-300 mt-1">
                          Stitches photos, vocal audio track, and scene subtitles into a 720p HD MP4 video.
                        </p>
                      </div>
                      <button
                        onClick={handleTriggerRender}
                        disabled={rendering}
                        className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-3 rounded-xl shadow text-sm transition"
                      >
                        {rendering ? "Rendering Video..." : "Start Video Render"}
                      </button>
                    </div>

                    {/* Pre-Render Specifications Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs border-t border-slate-800">
                      <div className="bg-slate-800/80 p-3 rounded-xl">
                        <div className="text-slate-400 font-bold">Total Duration:</div>
                        <div className="font-extrabold text-emerald-400 mt-0.5">
                          {activeProject.activeStoryboardId?.scenes ? `${activeProject.activeStoryboardId.scenes.length * 5}s` : "30 Seconds"}
                        </div>
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl">
                        <div className="text-slate-400 font-bold">Scene Captions:</div>
                        <div className="font-extrabold text-blue-400 mt-0.5">SRT Burned Subtitles</div>
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl">
                        <div className="text-slate-400 font-bold">Audio Track:</div>
                        <div className="font-extrabold text-amber-400 mt-0.5">Vocal Lyrics + Music</div>
                      </div>
                      <div className="bg-slate-800/80 p-3 rounded-xl">
                        <div className="text-slate-400 font-bold">Resolution:</div>
                        <div className="font-extrabold text-purple-400 mt-0.5">720p HD H.264 MP4</div>
                      </div>
                    </div>

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
                      <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                        <span>🎬</span> Rendered Event Video Preview
                      </h4>
                      <video
                        controls
                        src={activeProject.activeVideoId.videoUrl}
                        className="w-full max-w-2xl mx-auto rounded-xl shadow-lg border border-slate-300"
                      />
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Story Narrative / Event Memories</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Type or paste the story, speech, or summary of this event..."
                  value={newStory}
                  onChange={(e) => setNewTitleStory(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2D59]"
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
