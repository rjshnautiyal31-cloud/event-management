import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_qr_system",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  adminSetupKey: process.env.ADMIN_SETUP_KEY || "setup-admin",
  frontendBaseUrl: process.env.FRONTEND_BASE_URL || "http://localhost:5173",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
  senderEmail: process.env.SENDER_EMAIL || process.env.SMTP_USER || "onboarding@resend.dev",
  resendApiKey: process.env.RESEND_API_KEY,

  // AI Story-to-Video Configurable Providers
  storageProvider: process.env.STORAGE_PROVIDER || "local", // "local" | "s3"
  queueProvider: process.env.QUEUE_PROVIDER || "memory",    // "memory" | "redis"
  musicProvider: process.env.MUSIC_PROVIDER || "local_synth",// "local_synth" | "suno" | "elevenlabs"
  llmProvider: process.env.LLM_PROVIDER || "gemini",        // "gemini" | "openai"

  // Service API Keys & Config
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  s3Bucket: process.env.S3_BUCKET || "ai-story-media",
  s3Region: process.env.S3_REGION || "us-east-1",
  s3Endpoint: process.env.S3_ENDPOINT || "",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  musicApiKey: process.env.MUSIC_API_KEY || ""
};


