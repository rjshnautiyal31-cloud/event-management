# Event Management, QR Ticket, & AI Story-to-Video Platform

A full-stack, enterprise-grade monorepo for high-volume event registration, unique QR ticket generation, physical gate management, fast on-site QR validation with duplicate-scan prevention, and an integrated **AI Story-to-Song-to-Video Studio**.

---

## Key Features 🚀

### 1. AI Story-to-Song-to-Video Studio (`/#/studio`)
- **Event-Scoped AI Stories & Multi-Video Support**:
  - Associate multiple AI story projects per event. Restrictable via Event ACL (`super_admin` & `event_admin`).
- **Phase 1: Story Narrative Analysis**:
  - Analyzes raw event text/narrative using **Google Gemini 2.5 Flash** to extract summary, emotional arc, key themes, mood, and key visual moments.
- **Phase 2: AI Lyrics & Vocal Song Generation**:
  - Generates structured song lyrics in target genres (*Pop, Acoustic, Cinematic, Rock*).
  - Synthesizes vocal singing/narration and layers it over a multi-chord musical backing track.
- **Phase 3: Event Photos & Media Gallery**:
  - Upload event photos and media assets stored locally or in S3 buckets.
- **Phase 4: Scene Storyboard & Timeline Mapping**:
  - Automatically maps key moments and uploaded event photos into timed scenes with text captions.
- **Phase 5: High-Definition Video Rendering**:
  - Stitches photos, vocal audio track, and **burned SRT lower-third scene subtitles** into a 720p/1080p HD MP4 video.
- **Pluggable Provider Architecture**:
  - Zero-cost 100% local development mode (*Local Storage, In-Memory Queue, Local Synth, Local FFmpeg*) with seamless cloud toggles (*AWS S3, BullMQ Redis, Suno AI, Replicate/Runway AI Video*) via `.env` flags.

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
- `POST /api/story-video/projects/:id/analyze` (admin): Analyze story narrative using Gemini 3.6 Flash.
- `POST /api/story-video/projects/:id/lyrics` (admin): Generate AI lyrics and synthesize vocal audio track via Google Cloud TTS.
- `POST /api/story-video/projects/:id/media` (admin): Upload photo or video clip assets for video stitching.
- `GET /api/story-video/projects/:id/media` (auth): Get media gallery items for a project.
- `DELETE /api/story-video/projects/:id/media/:mediaId` (admin): Delete a specific uploaded photo or video clip.
- `DELETE /api/story-video/projects/:id/media` (admin): Clear all uploaded media (activates Pure AI Scene Generation Mode).
- `POST /api/story-video/projects/:id/storyboard` (admin): Generate scene timeline storyboard.
- `POST /api/story-video/projects/:id/render` (admin): Trigger FFmpeg background video rendering task.
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
MONGO_URI=mongodb://127.0.0.1:27017/event_qr_system
JWT_SECRET=dev-secret-change-me
ADMIN_SETUP_KEY=setup-admin

# Configurable AI & Cloud Provider Flags
STORAGE_PROVIDER=local        # "local" | "s3"
QUEUE_PROVIDER=memory          # "memory" | "redis"
MUSIC_PROVIDER=local_synth     # "local_synth" | "suno" | "elevenlabs"
VIDEO_PROVIDER=local_ffmpeg    # "local_ffmpeg" | "replicate" | "runway"
LLM_PROVIDER=gemini            # "gemini" | "openai"

# API Keys & Cloud Config
GEMINI_API_KEY=your_gemini_api_key_here
REPLICATE_API_KEY=r8_your_replicate_key
MUSIC_API_KEY=suno_your_music_key
REDIS_URL=redis://127.0.0.1:6379
S3_BUCKET=ai-story-media
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret

# Resend / Email Config
RESEND_API_KEY=re_your_api_key
SENDER_EMAIL=onboarding@resend.dev
```

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
