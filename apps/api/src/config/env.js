import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { SystemSetting } from "../models/SystemSetting.js";

// 1. Load standard environment file from working directory (if present)
dotenv.config();

// 2. In monorepo/local dev, also load apps/api/.env if present (dotenv will not override existing env vars)
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(currentDir, "../..");
try {
  const apiEnvPath = path.resolve(apiRootDir, ".env");
  if (fs.existsSync(apiEnvPath)) {
    dotenv.config({ path: apiEnvPath });
  }
} catch {
  // Graceful fallback for non-file environments
}

// In-memory cache for database configured settings
let dbSettingsCache = {};

export async function loadDbSettings() {
  try {
    const settings = await SystemSetting.find({}).lean();
    const map = {};
    for (const item of settings) {
      if (item.value !== undefined && item.value !== null && item.value !== "") {
        map[item.key] = item.value;
      }
    }
    dbSettingsCache = map;
    return dbSettingsCache;
  } catch (error) {
    // If database is not yet connected or collection doesn't exist yet, gracefully fall back to .env
    return dbSettingsCache;
  }
}

export function getDbSettingsCache() {
  return { ...dbSettingsCache };
}

export function setDbSettingsCache(newMap) {
  dbSettingsCache = { ...newMap };
}

// Property definition mapping
const PROPERTY_CONFIG = {
  port: { envKeys: ["PORT"], default: 4000, isNumber: true },
  publicUrl: {
    envKeys: ["PUBLIC_URL", "RENDER_EXTERNAL_URL"],
    resolver: () => {
      // 1. Database configured PUBLIC_URL
      if (dbSettingsCache["PUBLIC_URL"]) return dbSettingsCache["PUBLIC_URL"];
      // 2. Environment variable
      if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
      if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
      // 3. Fallback localhost
      const port = dbSettingsCache["PORT"] || process.env.PORT || 4000;
      return `http://localhost:${port}`;
    }
  },
  mongoUri: { envKeys: ["MONGO_URI"], default: "mongodb://127.0.0.1:27017/event_qr_system" },
  jwtSecret: { envKeys: ["JWT_SECRET"], default: "dev-secret-change-me" },
  adminSetupKey: { envKeys: ["ADMIN_SETUP_KEY"], default: "setup-admin" },
  frontendBaseUrl: { envKeys: ["FRONTEND_BASE_URL"], default: "http://localhost:5173" },
  smtpHost: { envKeys: ["SMTP_HOST"], default: "" },
  smtpPort: { envKeys: ["SMTP_PORT"], default: 587, isNumber: true },
  smtpUser: { envKeys: ["SMTP_USER"], default: "" },
  smtpPass: { envKeys: ["SMTP_PASS", "SMTP_PASSWORD"], default: "" },
  senderEmail: { envKeys: ["SENDER_EMAIL", "SMTP_USER"], default: "onboarding@resend.dev" },
  resendApiKey: { envKeys: ["RESEND_API_KEY"], default: "" },

  // Providers
  storageProvider: { envKeys: ["STORAGE_PROVIDER"], default: "local" },
  queueProvider: { envKeys: ["QUEUE_PROVIDER"], default: "memory" },
  musicProvider: { envKeys: ["MUSIC_PROVIDER"], default: "google_lyria" },
  videoProvider: { envKeys: ["VIDEO_PROVIDER"], default: "google_omni" },
  llmProvider: { envKeys: ["LLM_PROVIDER"], default: "gemini" },

  // API Keys & Cloud Config
  geminiApiKey: { envKeys: ["GEMINI_API_KEY"], default: "" },
  googleCloudProject: { envKeys: ["GOOGLE_CLOUD_PROJECT"], default: "" },
  googleCloudLocation: { envKeys: ["GOOGLE_CLOUD_LOCATION"], default: "us-central1" },
  gcpClientEmail: { envKeys: ["GCP_CLIENT_EMAIL", "GOOGLE_CLIENT_EMAIL"], default: "" },
  gcpPrivateKey: { envKeys: ["GCP_PRIVATE_KEY", "GOOGLE_PRIVATE_KEY"], default: "" },
  redisUrl: { envKeys: ["REDIS_URL"], default: "redis://127.0.0.1:6379" },

  // Configurable AI / Music / Video Models
  geminiModel: { envKeys: ["GEMINI_MODEL", "GEMINI_LLM_MODEL"], default: "gemini-2.5-flash" },
  geminiImageModel: { envKeys: ["GEMINI_IMAGE_MODEL"], default: "gemini-2.5-flash-image" },
  imagenModel: { envKeys: ["IMAGEN_MODEL"], default: "imagen-3.0-generate-002" },
  fallbackImageModel: { envKeys: ["FALLBACK_IMAGE_MODEL"], default: "flux" },
  lyriaModel: { envKeys: ["LYRIA_MODEL"], default: "lyria-3-pro-preview" },
  lyriaFallbackModel: { envKeys: ["LYRIA_FALLBACK_MODEL"], default: "lyria-002" },
  elevenLabsMusicModel: { envKeys: ["ELEVENLABS_MUSIC_MODEL"], default: "music_v1" },
  elevenLabsTtsEnglishModel: { envKeys: ["ELEVENLABS_TTS_ENGLISH_MODEL"], default: "eleven_monolingual_v1" },
  elevenLabsTtsMultilingualModel: { envKeys: ["ELEVENLABS_TTS_MULTILINGUAL_MODEL"], default: "eleven_multilingual_v2" },
  googleVideoModel: { envKeys: ["GOOGLE_VIDEO_MODEL", "GEMINI_VIDEO_MODEL", "VEO_VIDEO_MODEL"], default: "gemini-omni-1.1-flash-preview" },
  replicateVideoModel: { envKeys: ["REPLICATE_VIDEO_MODEL"], default: "3f0457e4619da258370163351d3e8f8101a938634ed1fcfd43a6d97c55531d27" },

  // Storage Configurations
  gcsBucket: { envKeys: ["GCS_BUCKET"], default: "qr-event-story-media" },

  // External Worker & Environment
  workerUrl: { envKeys: ["WORKER_URL"], default: "" },
  nodeEnv: { envKeys: ["NODE_ENV"], default: "development" },

  musicApiKey: { envKeys: ["MUSIC_API_KEY", "SUNO_API_KEY"], default: "" },
  sunoApiKey: { envKeys: ["SUNO_API_KEY", "MUSIC_API_KEY"], default: "" },
  elevenLabsApiKey: { envKeys: ["ELEVENLABS_API_KEY"], default: "" },
  videoApiKey: { envKeys: ["VIDEO_API_KEY", "REPLICATE_API_KEY"], default: "" },
  replicateApiKey: { envKeys: ["REPLICATE_API_KEY", "VIDEO_API_KEY"], default: "" }
};

function resolveConfigValue(propName) {
  // Direct match in PROPERTY_CONFIG
  const spec = PROPERTY_CONFIG[propName];
  if (spec) {
    if (spec.resolver) return spec.resolver();

    // 1. Check DB settings cache (First priority)
    for (const k of spec.envKeys) {
      if (dbSettingsCache[k] !== undefined && dbSettingsCache[k] !== null && String(dbSettingsCache[k]).trim() !== "") {
        return spec.isNumber ? Number(dbSettingsCache[k]) : dbSettingsCache[k];
      }
    }

    // 2. Check process.env (Second priority)
    for (const k of spec.envKeys) {
      if (process.env[k] !== undefined && process.env[k] !== null && String(process.env[k]).trim() !== "") {
        return spec.isNumber ? Number(process.env[k]) : process.env[k];
      }
    }

    // 3. Fallback default
    return spec.default;
  }

  // If accessed by exact uppercase env key, e.g. env["STORAGE_PROVIDER"] or env.STORAGE_PROVIDER
  if (typeof propName === "string") {
    // 1. Check DB first
    if (dbSettingsCache[propName] !== undefined && dbSettingsCache[propName] !== null && String(dbSettingsCache[propName]).trim() !== "") {
      return dbSettingsCache[propName];
    }
    // 2. Check process.env
    if (process.env[propName] !== undefined && process.env[propName] !== null && String(process.env[propName]).trim() !== "") {
      return process.env[propName];
    }
  }

  return undefined;
}

// Proxy wrapper around env object so any property read is dynamic and prioritizes DB
export const env = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "toJSON") {
        return () => {
          const res = {};
          for (const key of Object.keys(PROPERTY_CONFIG)) {
            res[key] = resolveConfigValue(key);
          }
          return res;
        };
      }
      return resolveConfigValue(prop);
    },
    has(_target, prop) {
      return prop in PROPERTY_CONFIG || (typeof prop === "string" && (prop in dbSettingsCache || prop in process.env));
    },
    ownKeys() {
      return Object.keys(PROPERTY_CONFIG);
    },
    getOwnPropertyDescriptor(_target, prop) {
      return {
        enumerable: true,
        configurable: true,
        value: resolveConfigValue(prop)
      };
    }
  }
);

/**
 * Resolves Google Cloud Service Account credentials in-memory without writing JSON files to disk.
 * Priority:
 *  1. In-memory GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY from Settings DB or .env
 *  2. Local gcp-service-account.json file (if present on disk, loaded into memory)
 *  3. Google Cloud Application Default Credentials (ADC) when running on Cloud Run / GKE
 */
export function getGoogleCloudCredentials() {
  // Check local gcp-service-account.json on disk as default baseline if present
  let localCreds = null;
  const candidatePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS) : null,
    path.resolve(process.cwd(), "gcp-service-account.json"),
    path.resolve(apiRootDir, "gcp-service-account.json")
  ].filter(Boolean);

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.client_email && parsed.private_key) {
          localCreds = parsed;
          break;
        }
      }
    } catch {
      // Ignore invalid or unreadable candidate file and continue fallback chain
    }
  }

  const configuredEmail = String(env.gcpClientEmail || "").trim();
  const configuredKey = String(env.gcpPrivateKey || "").trim();

  const clientEmail = configuredEmail || (localCreds?.client_email ? String(localCreds.client_email).trim() : "");
  const rawPrivateKey = configuredKey || (localCreds?.private_key ? String(localCreds.private_key).trim() : "");

  if (clientEmail && rawPrivateKey) {
    const normalizedKey = rawPrivateKey
      .replace(/^["']|["']$/g, "")
      .replace(/\\n/g, "\n");
    return {
      credentials: {
        client_email: clientEmail,
        private_key: normalizedKey
      },
      projectId: env.googleCloudProject || localCreds?.project_id || undefined,
      source: (configuredEmail && configuredKey) ? "settings_in_memory" : "local_file"
    };
  }

  // Fallback to Google Cloud ADC (Application Default Credentials)
  return {
    credentials: null,
    projectId: env.googleCloudProject || localCreds?.project_id || undefined,
    source: "adc"
  };
}
