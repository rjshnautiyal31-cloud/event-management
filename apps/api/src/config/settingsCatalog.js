export const SETTINGS_CATALOG = [
  // --- 1. AI & Core LLM ---
  {
    key: "GEMINI_API_KEY",
    category: "ai",
    label: "Google Gemini API Key",
    description: "API key for Google Gemini 2.5 Flash, story analysis, and Imagen 3 generation.",
    type: "password",
    isSecret: true,
    envKeys: ["GEMINI_API_KEY"],
    defaultValue: ""
  },
  {
    key: "GOOGLE_CLOUD_PROJECT",
    category: "ai",
    label: "Google Cloud Project ID",
    description: "GCP Project ID for Vertex AI and Lyria music generation",
    type: "text",
    isSecret: false,
    envKeys: ["GOOGLE_CLOUD_PROJECT"],
    defaultValue: ""
  },
  {
    key: "GOOGLE_CLOUD_LOCATION",
    category: "ai",
    label: "Vertex AI Location / Region",
    description: "Vertex AI regional endpoint (e.g., us-central1 or global).",
    type: "text",
    isSecret: false,
    envKeys: ["GOOGLE_CLOUD_LOCATION"],
    defaultValue: "us-central1"
  },
  {
    key: "GCP_CLIENT_EMAIL",
    category: "ai",
    label: "GCP Service Account Client Email",
    description: "In-memory Google Cloud IAM Service Account email (e.g. name@project.iam.gserviceaccount.com). Leave blank to automatically use local gcp-service-account.json or Cloud Run ADC.",
    type: "text",
    isSecret: false,
    envKeys: ["GCP_CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL"],
    defaultValue: ""
  },
  {
    key: "GCP_PRIVATE_KEY",
    category: "ai",
    label: "GCP Service Account Private Key",
    description: "In-memory PEM Private Key (-----BEGIN PRIVATE KEY-----...) for Vertex AI, Lyria, TTS, and GCS. Never written to disk. Leave blank to use local gcp-service-account.json or Cloud Run ADC.",
    type: "password",
    isSecret: true,
    envKeys: ["GCP_PRIVATE_KEY", "GOOGLE_PRIVATE_KEY"],
    defaultValue: ""
  },
  {
    key: "LLM_PROVIDER",
    category: "ai",
    label: "Primary LLM Provider",
    description: "Default LLM engine used for narrative analysis and lyric composition.",
    type: "select",
    options: ["gemini", "openai"],
    isSecret: false,
    envKeys: ["LLM_PROVIDER"],
    defaultValue: "gemini"
  },
  {
    key: "GEMINI_MODEL",
    category: "ai",
    label: "Gemini LLM Model",
    description: "Primary Gemini model used for story analysis, scene storyboarding, and lyric generation.",
    type: "text",
    isSecret: false,
    envKeys: ["GEMINI_MODEL", "GEMINI_LLM_MODEL"],
    defaultValue: "gemini-2.5-flash"
  },
  {
    key: "GEMINI_IMAGE_MODEL",
    category: "ai",
    label: "Primary Scene Image Model (Gemini)",
    description: "Primary model for generating AI scene illustrations via Gemini multimodal output.",
    type: "text",
    isSecret: false,
    envKeys: ["GEMINI_IMAGE_MODEL"],
    defaultValue: "gemini-2.5-flash-image"
  },
  {
    key: "IMAGEN_MODEL",
    category: "ai",
    label: "Secondary Scene Image Model (Vertex Imagen)",
    description: "Fallback Vertex AI Imagen model used when the primary Gemini image model is unavailable.",
    type: "text",
    isSecret: false,
    envKeys: ["IMAGEN_MODEL"],
    defaultValue: "imagen-3.0-generate-002"
  },
  {
    key: "FALLBACK_IMAGE_MODEL",
    category: "ai",
    label: "Tertiary Fallback Image Model",
    description: "External fallback image synthesis model (e.g., flux) if Google image models hit quota limits.",
    type: "text",
    isSecret: false,
    envKeys: ["FALLBACK_IMAGE_MODEL"],
    defaultValue: "flux"
  },

  // --- 2. Music & Audio Generation ---
  {
    key: "MUSIC_PROVIDER",
    category: "music",
    label: "Music Generation Provider",
    description: "Engine for synthesizing vocal song tracks and instrumental arrangements.",
    type: "select",
    options: ["google_lyria", "elevenlabs", "suno", "google_tts", "local_synth"],
    isSecret: false,
    envKeys: ["MUSIC_PROVIDER"],
    defaultValue: "google_lyria"
  },
  {
    key: "LYRIA_MODEL",
    category: "music",
    label: "Google Lyria Primary Model",
    description: "Primary Google DeepMind Lyria model for full vocal and instrumental music generation.",
    type: "text",
    isSecret: false,
    envKeys: ["LYRIA_MODEL"],
    defaultValue: "lyria-3-pro-preview"
  },
  {
    key: "LYRIA_FALLBACK_MODEL",
    category: "music",
    label: "Google Lyria Fallback Model",
    description: "Fallback Vertex AI Lyria model used if the primary Lyria model is unavailable in the region.",
    type: "text",
    isSecret: false,
    envKeys: ["LYRIA_FALLBACK_MODEL"],
    defaultValue: "lyria-002"
  },
  {
    key: "ELEVENLABS_API_KEY",
    category: "music",
    label: "ElevenLabs API Key",
    description: "API key for ElevenLabs high-fidelity vocal synthesis and music track generation.",
    type: "password",
    isSecret: true,
    envKeys: ["ELEVENLABS_API_KEY"],
    defaultValue: ""
  },
  {
    key: "ELEVENLABS_MUSIC_MODEL",
    category: "music",
    label: "ElevenLabs Music Model",
    description: "ElevenLabs model ID used for full music track generation (/v1/music).",
    type: "text",
    isSecret: false,
    envKeys: ["ELEVENLABS_MUSIC_MODEL"],
    defaultValue: "music_v1"
  },
  {
    key: "ELEVENLABS_TTS_ENGLISH_MODEL",
    category: "music",
    label: "ElevenLabs English TTS Model",
    description: "ElevenLabs model ID used for English vocal/narration synthesis.",
    type: "text",
    isSecret: false,
    envKeys: ["ELEVENLABS_TTS_ENGLISH_MODEL"],
    defaultValue: "eleven_monolingual_v1"
  },
  {
    key: "ELEVENLABS_TTS_MULTILINGUAL_MODEL",
    category: "music",
    label: "ElevenLabs Multilingual TTS Model",
    description: "ElevenLabs model ID used for Hindi, Punjabi, Spanish, and multilingual vocal synthesis.",
    type: "text",
    isSecret: false,
    envKeys: ["ELEVENLABS_TTS_MULTILINGUAL_MODEL"],
    defaultValue: "eleven_multilingual_v2"
  },
  {
    key: "SUNO_API_KEY",
    category: "music",
    label: "Suno AI API Key",
    description: "API key for Suno AI music creation service.",
    type: "password",
    isSecret: true,
    envKeys: ["SUNO_API_KEY", "MUSIC_API_KEY"],
    defaultValue: ""
  },

  // --- 3. Motion Video Generation ---
  {
    key: "VIDEO_PROVIDER",
    category: "video",
    label: "Video Generation Provider",
    description: "Engine for generating realistic 5-second scene motion video clips.",
    type: "select",
    options: ["google_omni", "google_veo", "replicate", "local_ffmpeg"],
    isSecret: false,
    envKeys: ["VIDEO_PROVIDER"],
    defaultValue: "google_omni"
  },
  {
    key: "GOOGLE_VIDEO_MODEL",
    category: "video",
    label: "Google Omni / Veo Video Model",
    description: "Google Vertex AI model ID used for image-to-video motion generation.",
    type: "text",
    isSecret: false,
    envKeys: ["GOOGLE_VIDEO_MODEL", "GEMINI_VIDEO_MODEL", "VEO_VIDEO_MODEL"],
    defaultValue: "gemini-omni-1.1-flash-preview"
  },
  {
    key: "REPLICATE_API_KEY",
    category: "video",
    label: "Replicate API Key",
    description: "API key for Replicate video generation models.",
    type: "password",
    isSecret: true,
    envKeys: ["REPLICATE_API_KEY", "VIDEO_API_KEY"],
    defaultValue: ""
  },
  {
    key: "REPLICATE_VIDEO_MODEL",
    category: "video",
    label: "Replicate Video Model Version",
    description: "Replicate model version hash used for Stable Video Diffusion / motion generation.",
    type: "text",
    isSecret: false,
    envKeys: ["REPLICATE_VIDEO_MODEL"],
    defaultValue: "3f0457e4619da258370163351d3e8f8101a938634ed1fcfd43a6d97c55531d27"
  },

  // --- 4. Cloud Storage ---
  {
    key: "STORAGE_PROVIDER",
    category: "storage",
    label: "Storage Backend Provider",
    description: "Media storage destination for photos, audio tracks, and rendered MP4 files.",
    type: "select",
    options: ["local", "s3", "r2", "gcs"],
    isSecret: false,
    envKeys: ["STORAGE_PROVIDER"],
    defaultValue: "local"
  },
  {
    key: "S3_BUCKET",
    category: "storage",
    label: "S3 / Cloudflare R2 Bucket Name",
    description: "Bucket name for storing media assets.",
    type: "text",
    isSecret: false,
    envKeys: ["S3_BUCKET"],
    defaultValue: "event-media"
  },
  {
    key: "S3_REGION",
    category: "storage",
    label: "S3 Region",
    description: "S3 bucket region (e.g. us-east-1). Use 'auto' for Cloudflare R2.",
    type: "text",
    isSecret: false,
    envKeys: ["S3_REGION"],
    defaultValue: "auto"
  },
  {
    key: "S3_ENDPOINT",
    category: "storage",
    label: "S3 Custom Endpoint",
    description: "Custom S3 endpoint URL (e.g., https://<account_id>.r2.cloudflarestorage.com for Cloudflare R2).",
    type: "text",
    isSecret: false,
    envKeys: ["S3_ENDPOINT"],
    defaultValue: ""
  },
  {
    key: "S3_PUBLIC_DOMAIN",
    category: "storage",
    label: "S3 / R2 Public Domain",
    description: "Public domain or CDN URL prefix for assets (e.g., https://pub-xxxx.r2.dev).",
    type: "text",
    isSecret: false,
    envKeys: ["S3_PUBLIC_DOMAIN"],
    defaultValue: ""
  },
  {
    key: "AWS_ACCESS_KEY_ID",
    category: "storage",
    label: "AWS / R2 Access Key ID",
    description: "Storage Access Key ID for AWS S3 or Cloudflare R2.",
    type: "text",
    isSecret: false,
    envKeys: ["AWS_ACCESS_KEY_ID"],
    defaultValue: ""
  },
  {
    key: "AWS_SECRET_ACCESS_KEY",
    category: "storage",
    label: "AWS / R2 Secret Access Key",
    description: "Storage Secret Access Key for AWS S3 or Cloudflare R2.",
    type: "password",
    isSecret: true,
    envKeys: ["AWS_SECRET_ACCESS_KEY"],
    defaultValue: ""
  },
  {
    key: "GCS_BUCKET",
    category: "storage",
    label: "Google Cloud Storage Bucket Name",
    description: "GCS Bucket name for storing files in Google Cloud Storage.",
    type: "text",
    isSecret: false,
    envKeys: ["GCS_BUCKET"],
    defaultValue: "qr-event-story-media"
  },

  // --- 5. Email & Ticketing Delivery ---
  {
    key: "RESEND_API_KEY",
    category: "email",
    label: "Resend API Key",
    description: "API key for Resend email delivery (recommended on Render Free Tier to bypass blocked SMTP ports).",
    type: "password",
    isSecret: true,
    envKeys: ["RESEND_API_KEY"],
    defaultValue: ""
  },
  {
    key: "SENDER_EMAIL",
    category: "email",
    label: "Sender Email Address",
    description: "From address for attendee ticket confirmation emails (e.g. onboarding@resend.dev or tickets@yourdomain.com).",
    type: "text",
    isSecret: false,
    envKeys: ["SENDER_EMAIL"],
    defaultValue: "onboarding@resend.dev"
  },
  {
    key: "SMTP_HOST",
    category: "email",
    label: "SMTP Hostname",
    description: "Hostname for custom SMTP delivery (if not using Resend).",
    type: "text",
    isSecret: false,
    envKeys: ["SMTP_HOST"],
    defaultValue: ""
  },
  {
    key: "SMTP_PORT",
    category: "email",
    label: "SMTP Port",
    description: "Port number for SMTP delivery (e.g. 587 or 465).",
    type: "number",
    isSecret: false,
    envKeys: ["SMTP_PORT"],
    defaultValue: "587"
  },
  {
    key: "SMTP_USER",
    category: "email",
    label: "SMTP Username",
    description: "Username for SMTP authentication.",
    type: "text",
    isSecret: false,
    envKeys: ["SMTP_USER"],
    defaultValue: ""
  },
  {
    key: "SMTP_PASS",
    category: "email",
    label: "SMTP Password",
    description: "Password for SMTP authentication.",
    type: "password",
    isSecret: true,
    envKeys: ["SMTP_PASS", "SMTP_PASSWORD"],
    defaultValue: ""
  },

  // --- 6. Network & Infrastructure ---
  {
    key: "PUBLIC_URL",
    category: "network",
    label: "API Server Public URL",
    description: "Publicly accessible URL of the API server (used for asset URLs and webhooks).",
    type: "text",
    isSecret: false,
    envKeys: ["PUBLIC_URL", "RENDER_EXTERNAL_URL"],
    defaultValue: "http://localhost:4000"
  },
  {
    key: "FRONTEND_BASE_URL",
    category: "network",
    label: "Frontend Web URL",
    description: "Public base URL of the web client for links generated in tickets.",
    type: "text",
    isSecret: false,
    envKeys: ["FRONTEND_BASE_URL"],
    defaultValue: "http://localhost:5173"
  },
  {
    key: "QUEUE_PROVIDER",
    category: "network",
    label: "Task Queue Provider",
    description: "Job queue engine for async rendering jobs (Memory or Redis BullMQ).",
    type: "select",
    options: ["memory", "redis"],
    isSecret: false,
    envKeys: ["QUEUE_PROVIDER"],
    defaultValue: "memory"
  },
  {
    key: "REDIS_URL",
    category: "network",
    label: "Redis Connection URL",
    description: "Redis URI for BullMQ (e.g., Upstash rediss://... or redis://127.0.0.1:6379).",
    type: "password",
    isSecret: true,
    envKeys: ["REDIS_URL"],
    defaultValue: "redis://127.0.0.1:6379"
  },
  {
    key: "WORKER_URL",
    category: "network",
    label: "External Video Worker URL",
    description: "Optional Google Cloud Run serverless worker URL for offloading heavy FFmpeg rendering.",
    type: "text",
    isSecret: false,
    envKeys: ["WORKER_URL"],
    defaultValue: ""
  }
];

export const CATEGORIES = [
  { id: "all", label: "All Settings", icon: "⚙️" },
  { id: "storage", label: "Cloud Storage", icon: "☁️" },
  { id: "ai", label: "AI & Vertex LLM", icon: "🤖" },
  { id: "music", label: "Music & Audio", icon: "🎵" },
  { id: "video", label: "Motion Video", icon: "🎬" },
  { id: "email", label: "Email & Tickets", icon: "📬" },
  { id: "network", label: "Network & Queue", icon: "🌐" }
];
