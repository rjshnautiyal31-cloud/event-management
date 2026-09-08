import dotenv from "dotenv";
import { SystemSetting } from "../models/SystemSetting.js";

dotenv.config();

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
  googleCloudProject: { envKeys: ["GOOGLE_CLOUD_PROJECT"], default: "project-2a1614a0-3389-4a26-8d4" },
  googleCloudLocation: { envKeys: ["GOOGLE_CLOUD_LOCATION"], default: "us-central1" },
  redisUrl: { envKeys: ["REDIS_URL"], default: "redis://127.0.0.1:6379" },

  // Storage Configurations
  s3Bucket: { envKeys: ["S3_BUCKET"], default: "ai-story-media" },
  s3Region: { envKeys: ["S3_REGION"], default: "auto" },
  s3Endpoint: { envKeys: ["S3_ENDPOINT"], default: "" },
  s3PublicDomain: { envKeys: ["S3_PUBLIC_DOMAIN"], default: "" },
  awsAccessKeyId: { envKeys: ["AWS_ACCESS_KEY_ID"], default: "" },
  awsSecretAccessKey: { envKeys: ["AWS_SECRET_ACCESS_KEY"], default: "" },
  gcsBucket: { envKeys: ["GCS_BUCKET"], default: "" },

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
