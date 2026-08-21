import { useState, useEffect } from "react";
import { api } from "../api.js";

export function ProjectStudioPage({ token }) {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [activeTab, setActiveTab] = useState("story"); // story | lyrics | media | storyboard | render
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      loadMediaItems(activeProject._id);
    }
  }, [activeProject]);

  async function loadProjects() {
    try {
      const data = await api("/api/story-video/projects", { token });
      setProjects(data);
      if (data.length > 0 && !activeProject) {
        setActiveProject(data[0]);
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
    if (!newTitle || !newStory) return;
    setLoading(true);
    setError("");
    try {
      const project = await api("/api/story-video/projects", {
        token,
        method: "POST",
        body: { title: newTitle, storyText: newStory }
      });
      setSuccess("Project created successfully!");
      setNewTitle("");
      setNewTitleStory("");
      setShowCreateModal(false);
      await loadProjects();
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
      setSuccess("Story analyzed by Gemini!");
      await loadProjects();
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
      setSuccess("Lyrics & synth audio track generated!");
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-slate-800">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0A2D59] text-white p-6 rounded-2xl shadow-xl mb-8">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span>🎬</span> AI Story-to-Song-to-Video Studio
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Turn memories and stories into AI lyrics, music tracks, and MP4 videos locally.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-white text-[#0A2D59] hover:bg-slate-100 font-bold px-5 py-2.5 rounded-xl shadow transition text-sm flex items-center gap-1.5 self-start md:self-auto"
        >
          <span>✨</span> New Project
        </button>
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
        {/* Sidebar: Projects Selector */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider">Your Projects ({projects.length})</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {projects.map((proj) => (
              <button
                key={proj._id}
                onClick={() => setActiveProject(proj)}
                className={`w-full text-left p-3.5 rounded-xl transition border text-sm ${
                  activeProject?._id === proj._id
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="font-bold truncate">{proj.title}</div>
                <div className="text-[11px] opacity-75 capitalize mt-0.5">Status: {proj.status}</div>
              </button>
            ))}
            {projects.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">No projects created yet.</div>
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
                  { id: "media", label: "3. Photos & Media", icon: "🖼️" },
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
                    <span>✨</span> {loading ? "Analyzing with Gemini AI..." : "Analyze Narrative with Gemini AI"}
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
                    <label className="text-sm font-bold text-slate-700">Select Music Genre:</label>
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
                      {loading ? "Generating..." : "Generate Lyrics & Music"}
                    </button>
                  </div>

                  {activeProject.activeSongId && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <h4 className="font-black text-sm text-slate-700 mb-2">Generated AI Song Lyrics</h4>
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
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800">Project Photos & Images ({mediaItems.length})</h3>
                    <label className="bg-[#0A2D59] text-white hover:bg-slate-800 font-bold px-4 py-2 rounded-xl text-xs shadow cursor-pointer transition">
                      {uploadingMedia ? "Uploading..." : "Upload Photo"}
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {mediaItems.map((item) => (
                      <div key={item._id} className="aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative group">
                        <img src={item.fileUrl} alt="media" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {mediaItems.length === 0 && (
                      <div className="col-span-full text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                        No photos uploaded yet. Upload photos to include in your video storyboard!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Storyboard */}
              {activeTab === "storyboard" && (
                <div className="space-y-6">
                  <button
                    onClick={handleGenerateStoryboard}
                    disabled={loading}
                    className="bg-[#0A2D59] text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow hover:bg-slate-800 transition"
                  >
                    {loading ? "Generating..." : "Generate Scene Storyboard"}
                  </button>

                  {activeProject.activeStoryboardId && (
                    <div className="space-y-3">
                      <h4 className="font-black text-sm text-slate-700">Timeline Scenes</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {activeProject.activeStoryboardId.scenes?.map((scene, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2">
                            <div className="font-black text-[#0A2D59]">Scene {scene.sceneNumber} ({scene.startTimeSeconds}s - {scene.endTimeSeconds}s)</div>
                            <p className="text-slate-600">{scene.captionText}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Render & Player */}
              {activeTab === "render" && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 rounded-2xl space-y-4">
                    <h3 className="text-lg font-black flex items-center gap-2">🚀 Render Final MP4 Video</h3>
                    <p className="text-xs text-slate-300">
                      Stitches photos, AI audio track, and scene timing into a high-definition 1080p MP4 video using local FFmpeg.
                    </p>

                    <button
                      onClick={handleTriggerRender}
                      disabled={rendering}
                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-6 py-3 rounded-xl shadow text-sm transition"
                    >
                      {rendering ? "Rendering Video..." : "Start FFmpeg Video Render"}
                    </button>

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
                        <span>🎬</span> Rendered Final Video
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
              <div className="font-bold text-sm">Select or create a project to get started</div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Project */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Create AI Story Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My College Memories"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#0A2D59]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Personal Story / Narrative Text</label>
                <textarea
                  required
                  rows={5}
                  placeholder="Type or paste your story, biography, or memories here..."
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
                  {loading ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
