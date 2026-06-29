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
  resendApiKey: process.env.RESEND_API_KEY
};

