# Event Management, QR Ticket, & AI Story-to-Video Platform

A full-stack, enterprise-grade monorepo for high-volume event registration, unique QR ticket generation, physical gate management, fast on-site QR validation with duplicate-scan prevention, and an integrated **AI Story-to-Song-to-Video Studio**.

---

## Key Features 🚀

### 1. AI Story-to-Song-to-Video Studio (`/#/studio`)
- **Event-Scoped AI Stories & Multi-Video Support**:
  - Associate multiple AI story projects per event. Restrictable via Event ACL (`super_admin` & `event_admin`).
- **Phase 1: Story Narrative Analysis**:
  - Analyzes raw event text/narrative using **Google Gemini 2.5 Flash** via Vertex AI to extract story summary, emotional arc, key themes, mood, and distinct visual scene prompts.
- **Phase 2: AI Lyrics & Vocal Song Generation**:
  - Generates authentic musical song compositions with melodic vocals and acoustic/electronic instruments using **Google DeepMind Lyria 3 Pro / Lyria 2** (`lyria-3-pro-preview`), ElevenLabs Music API, Suno, or local synthetic fallback.
- **Phase 3: Event Photos & Pure AI Motion Video Generation**:
  - Upload event photos and media assets stored locally, in **AWS S3**, **Cloudflare R2**, or **Google Cloud Storage (GCS)**.
  - Generates realistic 5-second 16:9 cinematic motion video clips using **Google Gemini Omni 1.1 Flash** (`gemini-omni-1.1-flash-preview`) or Google Veo.
- **Phase 4: Lyric-Synchronized Scene Storyboard & Timeline**:
  - Automatically calculates scene durations matching the actual generated song length.
  - Aligns individual lyric phrases and narrative beats to scenes, preventing repetitive visuals.
- **Phase 5: Multi-Device Resolution Video Rendering**:
  - Stitches scene clips, vocal audio track, and burned subtitles into high-definition MP4 videos with 5 customizable display presets:
    - 🖥️ **Desktop Full HD (1080p)**: `1920x1080`, 16:9, 6000k bitrate.
    - 💻 **Desktop HD (720p)**: `1280x720`, 16:9, 3500k bitrate.
    - 📱 **Mobile Portrait (9:16)**: `1080x1920`, 9:16 for Reels, TikTok & Shorts.
    - 📟 **Tablet Display (4:3)**: `1440x1080`, 4:3 for iPad and tablets.
    - 🔲 **Social Square (1:1)**: `1080x1080`, 1:1 for Instagram and feed posts.
- **Render Free Tier Optimized & Pluggable Storage**:
  - Automatically limits FFmpeg to single-threaded low-memory streaming (`-threads 1`, `-preset veryfast`, `-bufsize 512k`) on Render Free Tier to stay safely within 512 MB RAM limits.
  - Universal multi-cloud storage adapter supporting **Local disk**, **AWS S3**, **Cloudflare R2** (zero egress fees), and **Google Cloud Storage (GCS)**.

### 2. Core Event & Gate Management
- **`#0A2D59` Deep Navy Brand Identity & Universal Top Navigation**:
  - Sticky top header featuring a **Hamburger (`☰`) Slide-Over Drawer Navigation Panel**.
- **High-Volume Event Switcher Command Palette (`⌘K` / `Ctrl+K`)**:
  - Real-time instant search input filtering by **title**, **venue location**, or **date**.
  - Categorized tabs: `⚡ Active & Upcoming`, `🕒 Past Events`, and `⭐ Pinned / Favorites` (pinned events persist in `localStorage`).
- **`🗓️ Managed Events Directory` Workspace**:
  - Full-width table view listing all managed events with real-time text search, status filters (`🟢 Live Today`, `🗓 Upcoming`, `🏁 Ended`), public registration links (`/#/register/:slug`), and 1-tap active event switching.
- **High-Volume Attendee Roster (100s / 1000s of Attendees)**:
  - Real-time text search, status filters (`All`, `Checked In`, `Pending`), batch size selector (25 / 50 / 100 / All), and **Virtual Infinite Scroll / Lazy Loading**.
- **Inline CID Attachment Ticket Emails (`cid:qrcode`)**:
  - Automatic email tickets sent via Resend API or SMTP using `cid:qrcode` Content-ID inline attachment embedding (eliminating broken images in Gmail, Outlook, and Yahoo).
- **Event Gates & Automated Staff Locking**:
  - Create, delete, and monitor physical gates per event (*Gate A, VIP Gate, Main Entrance*).
  - Staff scanner accounts automatically lock to their assigned gate upon login to prevent mis-scans.
- **Decoupled Check-in Logs**:
  - Denormalizes attendee name and email into `entrylogs` at check-in so historical records are preserved even if an attendee profile is subsequently deleted.

### 3. Back Office Settings & Dynamic Configuration (`/#/settings`)
- **Dual-Tier Precedence Hierarchy**:
  - **1st Priority (Highest): Database Overrides** configured via the Back Office Settings Dashboard in MongoDB (`SystemSetting` collection).
  - **2nd Priority (Fallback): Local `.env` Variables** loaded into `process.env`.
  - **3rd Priority: Built-in Defaults**.
- **Categorized Configuration Dashboard**:
  - `☁️ Cloud Storage`: Switch between Local, AWS S3, Cloudflare R2, and Google Cloud Storage (GCS) with custom endpoints and CDN public domains.
  - `🤖 AI & Vertex LLM`: Configure Google Gemini API keys, Google Cloud Project ID, Vertex AI regions, and primary LLM engine.
  - `🎵 Music & Audio`: Toggle between Google DeepMind Lyria 3 Pro, ElevenLabs Music API, Suno, and Google TTS synthesizer.
  - `🎬 Motion Video`: Configure Gemini Omni 1.1 Flash, Google Veo, or Replicate video generation keys.
  - `📬 Email & Tickets`: Setup Resend API key (recommended on Render) or custom SMTP credentials.
  - `🌐 Network & Queue`: Configure Public API URL, Frontend URL, Redis BullMQ connection, and Cloud Run external rendering worker URL.
- **Live Diagnostics & Security**:
  - Built-in **"Test Storage"** and **"Test AI Keys"** actions verify live cloud bucket connectivity and API keys.
  - Sensitive secrets are masked with show/hide toggles.
  - 1-tap **"Reset to .env"** button removes DB overrides and seamlessly reverts to environment defaults.

---

## Monorepo Layout

- `apps/api`: Node.js Express backend (ESM), Mongoose/MongoDB, token signers, CSV parser, Resend/Nodemailer email engine, FFmpeg video worker, and AI provider adapters (Google Gemini, Google Cloud TTS, Google Veo).
- `apps/web`: React 18 + Vite + Tailwind CSS frontend, HashRouter navigation, html5-qrcode scanner integration, responsive dashboard, AI Studio UI (`ProjectStudioPage.jsx`), and public registration portal.

---

## Database Schema (MongoDB Collections)

### Core Event Collections
- `users`: User profiles with role-based access (`super_admin` | `event_admin` | `event_staff`) and gate assignments.
- `events`: Event definitions, dates, locations, public slug, createdBy.
- `gates`: Physical entrance gates per event.
- `attendees`: Registered attendees, ticket UUIDs, QR code base64, check-in status.
- `entrylogs`: Historical check-in log records with denormalized names/emails.

### AI Story-to-Video Collections
- `projects`: Story projects linked to `eventId` with references to active analysis, song, storyboard, and video.
- `storyanalyses`: Story analysis output (summary, emotional arc, themes, key moments).
- `songs`: Generated lyrics, audio URL, duration, genre, mood.
- `medias`: Uploaded photo & video clip media items per project (`fileUrl`, `mediaType`).
- `storyboards`: Scene timeline mapping (sceneNumber, start/end timestamps, mediaId, captionText).
- `videos`: Rendered video documents (videoUrl, durationSeconds, resolution).
- `generationjobs`: Async background job status tracking (jobType, progressPercent, currentStepMessage).

---

## API Endpoints

### AI Story-to-Video Studio (`/api/story-video/*`)
- `POST /api/story-video/projects` (admin): Create a new AI story project linked to an event.
- `GET /api/story-video/projects` (auth): List all story projects for an event.
- `GET /api/story-video/projects/:id` (auth): Fetch details for a specific project.
- `POST /api/story-video/projects/:id/analyze` (admin): Analyze story narrative using Gemini 2.5 Flash.
- `POST /api/story-video/projects/:id/lyrics` (admin): Generate AI lyrics and synthesize song audio via Google Lyria 3 Pro / ElevenLabs.
- `POST /api/story-video/projects/:id/media` (admin): Upload photo or video clip assets for video stitching.
- `GET /api/story-video/projects/:id/media` (auth): Get media gallery items for a project.
- `DELETE /api/story-video/projects/:id/media/:mediaId` (admin): Delete a specific uploaded photo or video clip.
- `DELETE /api/story-video/projects/:id/media` (admin): Clear all uploaded media (activates Pure AI Scene Generation Mode).
- `POST /api/story-video/projects/:id/storyboard` (admin): Generate lyric-synchronized scene timeline storyboard.
- `GET /api/story-video/video-presets` (auth): Fetch supported resolution presets (`1080p`, `720p`, `mobile`, `tablet`, `square`).
- `POST /api/story-video/projects/:id/render` (admin): Trigger FFmpeg background video rendering with resolution preset.
- `GET /api/story-video/jobs/:jobId` (auth): Poll video rendering job progress.

### Auth & User Accounts
- `POST /api/auth/setup-admin`: Bootstrap initial super admin account.
- `POST /api/auth/login`: Validate credentials and issue JWT.
- `GET /api/auth/staff` (admin): List staff users.
- `POST /api/auth/staff` (admin): Create staff user with role & gate assignment.

### Events, Attendees, & Gates
- `POST /api/events` (admin): Create event.
- `GET /api/events` (auth): List accessible events.
- `GET /api/events/:eventId/stats` (auth): Event registration & check-in analytics.
- `GET /api/events/:eventId/attendees` (auth): Paginated attendee list.
- `POST /api/scan/validate` (auth): Validate scanned QR ticket UUID.

---

## Environment Variables Configuration

### `apps/api/.env`
```env
PORT=4000
NODE_ENV=development
PUBLIC_URL=http://localhost:4000
MONGO_URI=mongodb://127.0.0.1:27017/event_qr_system
JWT_SECRET=dev-secret-change-me
ADMIN_SETUP_KEY=setup-admin

# Pluggable Providers
STORAGE_PROVIDER=local        # "local" | "s3" | "r2" | "gcs"
QUEUE_PROVIDER=memory          # "memory" | "redis"
MUSIC_PROVIDER=google_lyria    # "google_lyria" | "elevenlabs" | "suno" | "local_synth"
VIDEO_PROVIDER=google_omni     # "google_omni" | "google_veo" | "local_ffmpeg"
LLM_PROVIDER=gemini            # "gemini" | "openai"

# Google Cloud / Vertex AI (Lyria 3 Pro, Gemini Omni, Gemini 2.5 Flash)
GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GEMINI_API_KEY=your_gemini_api_key_here

# S3-Compatible Cloud Storage (AWS S3 or Cloudflare R2)
S3_BUCKET=event-media
S3_REGION=auto                 # "auto" for Cloudflare R2, or "us-east-1" for AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
# For Cloudflare R2 (Zero egress fees):
# S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
# S3_PUBLIC_DOMAIN=https://pub-<hash>.r2.dev

# Google Cloud Storage (GCS)
GCS_BUCKET=event-media-gcs

# Resend / Email Config
RESEND_API_KEY=re_your_api_key
SENDER_EMAIL=onboarding@resend.dev
```

---

## Render Free Tier Deployment Guide

### Why Render Free Tier Requires Cloud Storage
1. **Ephemeral Disk**: Render Free Tier discards local disk files on redeploy or when the instance spins down. Uploaded media and rendered videos must be saved in **Cloudflare R2**, **Google Cloud Storage**, or **AWS S3** for persistent access.
2. **512 MB Memory Limit**: The built-in video worker automatically detects Render (`process.env.RENDER || NODE_ENV=production`) and runs FFmpeg with:
   - `-threads 1` (limits memory to ~280 MB RAM, preventing OOM SIGKILL).
   - `-preset veryfast -bufsize 512k -maxrate <bitrate>`.
3. **15-Minute Cold Sleep**: Set up a free monitoring check (e.g. [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)) to ping `GET https://your-api.onrender.com/health` every 10 minutes to prevent the instance from sleeping while users are active.

### Recommended Free Tier Cloud Stack:
- **Hosting**: Render Free Web Service (Node.js API + Static React SPA).
- **Database**: MongoDB Atlas M0 Free Tier (512 MB storage).
- **Media Storage**: **Cloudflare R2** (10 GB free storage, **0 egress fees**) or **Google Cloud Storage** (5 GB always free).
- **AI Models**: Google Vertex AI Service Account (Gemini 2.5 Flash + Lyria + Gemini Omni).

---

## Quick Start

1. **Install dependencies at root**:
   ```bash
   npm install
   ```

2. **Start Backend API and Web App**:
   ```bash
   npm run dev:api  # Backend API on http://localhost:4000
   npm run dev:web  # Web App on http://localhost:5173
   ```

3. **Access AI Story-to-Video Studio**:
   - Open browser to **`http://localhost:5173/#/studio`**.
   - Log in as Event Admin / Super Admin to analyze stories, generate lyrics, upload photos, and render event music videos!

---

## Documentation & References

- Technical Implementation Plan: [`ai_story_to_video_implementation_plan.md`](./ai_story_to_video_implementation_plan.md)
- User Guide: [`USER_GUIDE.md`](./USER_GUIDE.md)
