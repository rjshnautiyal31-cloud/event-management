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
    description: "GCP Project ID used for Vertex AI (Google DeepMind Lyria and Gemini Omni models).",
    type: "text",
    isSecret: false,
    envKeys: ["GOOGLE_CLOUD_PROJECT"],
    defaultValue: "project-2a1614a0-3389-4a26-8d4"
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
    key: "REPLICATE_API_KEY",
    category: "video",
    label: "Replicate API Key",
    description: "API key for Replicate video generation models.",
    type: "password",
    isSecret: true,
    envKeys: ["REPLICATE_API_KEY", "VIDEO_API_KEY"],
    defaultValue: ""
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
    defaultValue: ""
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
