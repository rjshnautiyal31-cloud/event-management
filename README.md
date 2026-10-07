# Event Management, QR Ticket, & AI Story-to-Video Platform

A full-stack, enterprise-grade monorepo for multi-tenant company event management, self-service company registration, unique QR entrance pass generation, physical gate monitoring, high-speed on-site QR validation with duplicate-scan prevention, and an integrated **AI Story-to-Song-to-Video Studio**.

---

## Key Features 🚀

### 1. Multi-Tenant Company Hierarchy & Role-Based Access Control (RBAC)
- **🏢 Self-Service Company Registration**:
  - Direct company onboarding from `/login` with unique company name, owner name, email, phone, and password.
  - Automatically provisions an isolated company workspace and designates the registering user as the Company **Owner**.
- **👥 Rigid Organizational Hierarchy**:
  - `1 Company -> 1 Owner -> Many Co-Owners -> Many Events -> Many Event Admins -> Many Event Staff`
- **🛡️ Role Governance & Access Control Boundaries**:
  - **👑 Owner (`owner`)**:
    - Unrestricted administrative authority over the entire company workspace.
    - Can create, edit, and delete events, physical gates, and AI story projects.
    - Has **exclusive authority** to create, edit, and delete **Co-Owners** (`co_owner`), as well as **Event Admins** (`event_admin`) and **Event Staff** (`event_staff`).
  - **🤝 Co-Owner (`co_owner`)**:
    - Co-manages all company events, attendees, gates, and staff.
    - Can create, edit, and delete events, Event Admins, and Event Staff.
    - **Strict Protection Guard**: Cannot create, edit, update, or delete the Company Owner or any other Co-Owner accounts.
  - **🎫 Event Admin (`event_admin`)**:
    - Scoped strictly to assigned events. Unassigned events are completely invisible.
    - Can manage event metadata, attendees, walk-in registrations, CSV imports, gates, and AI storyboards for their assigned events.
    - Can create, edit, and delete **Event Staff** (`event_staff`) only, and assign them to gates within their assigned events.
    - Cannot create, edit, or delete Owners, Co-Owners, or other Event Admins.
  - **📲 Event Staff (`event_staff`)**:
    - Focused strictly on physical gate operations at `/scan`.
    - Automatically locked to assigned gate on login to eliminate check-in confusion.
    - Zero access to administrative dashboard, event creation, or attendee rosters.
  - **🌐 Super Admin (`super_admin`)**:
    - Global platform maintenance role for cloud infrastructure and Back Office configuration (`/#/settings`).
- **🔄 Automatic Legacy Data Migration**:
  - Existing legacy users, events, and gates with unassigned companies are automatically grouped under a default tenant (`Default Organization`) upon API server startup.

### 2. Core Event Management & Instant QR Passes
- **📲 Downloadable Event Registration QR Code Link**:
  - Every event automatically generates a public registration URL (`/#/register/:slug`) and a high-resolution (360x360) `#0A2D59` branded QR code.
  - 1-tap **"Download Registration QR"** button exports a ready-to-print `.png` image for posters, standees, flyers, digital banners, or social media promotion.
  - Guests scan the QR code with any smartphone camera to open the instant registration form directly.
- **🗑️ Cascading Event Deletion**:
  - Secure event deletion with automatic cascade cleanup of associated gates, attendees, check-in logs, and AI story projects.
- **`#0A2D59` Deep Navy Brand Identity & Universal Top Navigation**:
  - Sticky top header featuring a **Hamburger (`☰`) Slide-Over Drawer Navigation Panel** displaying current tenant company context.
- **High-Volume Event Switcher Command Palette (`⌘K` / `Ctrl+K`)**:
  - Real-time instant search input filtering by **title**, **venue location**, or **date**.
  - Categorized tabs: `⚡ Active & Upcoming`, `🕒 Past Events`, and `⭐ Pinned / Favorites` (pinned events persist in `localStorage`).
- **`🗓️ Managed Events Directory` Workspace**:
  - Full-width table view listing all accessible events with real-time text search, status filters (`🟢 Live Today`, `🗓 Upcoming`, `🏁 Ended`), public registration links, and 1-tap active event switching.
- **High-Volume Attendee Roster (100s / 1000s of Attendees)**:
  - Real-time text search, status filters (`All`, `Checked In`, `Pending`), batch size selector (25 / 50 / 100 / All), and **Virtual Infinite Scroll / Lazy Loading**.
- **Inline CID Attachment Ticket Emails (`cid:qrcode`)**:
  - Automatic email tickets sent via Resend API or SMTP using `cid:qrcode` Content-ID inline attachment embedding (eliminating broken images in Gmail, Outlook, and Yahoo).
- **Event Gates & Automated Staff Locking**:
  - Create, delete, and monitor physical gates per event (*Gate A, VIP Gate, Main Entrance*).
  - Staff scanner accounts automatically lock to their assigned gate upon login to prevent mis-scans.
- **Decoupled Check-in Logs**:
  - Denormalizes attendee name and email into `entrylogs` at check-in so historical records are preserved even if an attendee profile is subsequently deleted.

### 3. AI Story-to-Song-to-Video Studio (`/#/studio`)
- **Event-Scoped AI Stories & Multi-Video Support**:
  - Associate multiple AI story projects per event. Restrictable via Event ACL (`owner`, `co_owner`, `event_admin`, `super_admin`).
- **Multilingual Narrative & Audio Synthesis (10+ Languages)**:
  - Generate story analysis, poetic song lyrics, singing vocals, visual storyboards, and burned subtitles in **English**, **Hindi (हिन्दी)**, **Spanish (Español)**, **French (Français)**, **German (Deutsch)**, **Japanese (日本語)**, **Chinese (中文)**, **Arabic (العربية)**, **Portuguese (Português)**, and **Bengali (বাংলা)**.
  - Native script rendering (Devanagari, Hanzi, Arabic, etc.) with automatic cross-lingual visual translation for AI video generators.
- **Phase 1: Story Narrative Analysis & Character Cast Bible (Level 1 Control)**:
  - Analyzes raw event text/narrative using **Google Gemini 2.5 Flash** via Vertex AI to extract story summary, emotional arc, key themes, and visual scene prompts.
  - **👥 Cast & Characters Consistency Guide**: Define recurring characters with Name, Role, and Physical Appearance & Attire (e.g. *Rahul • Groom: 30yo man in cream sherwani and red safa*). Gemini weaves these exact visual anchors into every scene prompt featuring them to ensure facial and outfit consistency across AI video renders.
  - **🎬 Director Guidelines & Must-Have Scenes**: Provide specific camera directions, required milestones, or must-have moments (e.g. *garland exchange, champagne toast, lantern release*) that Gemini prioritizes during timeline generation.
- **Phase 2: AI Lyrics, Vocal Voice Selection & Duration Control**:
  - **Vocalist Voice Selection**: Choose between **👩 Female Vocalist**, **👨 Male Vocalist**, **👥 Duet / Harmonized Ensemble**, or **🎙️ Custom Vocal Persona** (e.g., *warm acoustic contralto*, *husky rock baritone*, *Indian classical female vocals*).
  - **Flexible Duration Control**: Select audio target length from **15s, 30s, 45s, 60s, 90s, 120s up to 180s (3 full minutes)**.
  - Generates authentic musical song compositions using **Google DeepMind Lyria 3 Pro / Lyria 2** (`lyria-3-pro-preview`), ElevenLabs Music API, Suno, or local synthetic fallback.
  - Features intelligent prompt conditioning, automatic Lyria retry on rate limits, and transparent fallback indicator badges in the UI.
- **Phase 3: Event Photos & Pure AI Motion Video Generation**:
  - Upload event photos and media assets stored locally, in **AWS S3**, **Cloudflare R2**, or **Google Cloud Storage (GCS)**.
  - Generates realistic 5-second 16:9 cinematic motion video clips using **Google Gemini Omni 1.1 Flash** (`gemini-omni-1.1-flash-preview`) or Google Veo.
- **Phase 4: Lyric-Synchronized Scene Storyboard & Granular Scene Editor (Level 2 Control)**:
  - Automatically calculates scene durations (~5-6s each) matching the exact song audio duration so clips never loop or freeze.
  - **✏️ Interactive Visual Action / Prompt Editor**: Edit visual prompts for any scene inline with quick-insert character buttons (`+Rahul`).
  - **👤 Scene Cast Tagging**: Easily toggle which characters appear in which scene (`✓ Rahul` / `+ Priya`).
  - **🎨 Individual Scene AI Frame Regeneration**: Re-paint AI visual frames for specific scenes without regenerating the whole project.
  - **✨ Per-Scene Gemini Omni Video**: Generate or re-generate 5s motion video clips for individual scenes or batch-render all scenes at once.
  - **Source Media Reassignment**: Assign uploaded event photos/videos or AI frames on a per-scene basis.
- **Phase 5: Multi-Device Resolution Video Rendering & Synchronized Subtitles**:
  - Stitches scene clips and vocal audio track into high-definition MP4 videos with 5 customizable display presets:
    - 🖥️ **Desktop Full HD (1080p)**: `1920x1080`, 16:9, 6000k bitrate.
    - 💻 **Desktop HD (720p)**: `1280x720`, 16:9, 3500k bitrate.
    - 📱 **Mobile Portrait (9:16)**: `1080x1920`, 9:16 for Reels, TikTok & Shorts.
    - 📟 **Tablet Display (4:3)**: `1440x1080`, 4:3 for iPad and tablets.
    - 🔲 **Social Square (1:1)**: `1080x1080`, 1:1 for Instagram and feed posts.
  - **💬 Dual-Format Subtitles & Embedded Player Closed Captions (CC)**:
    - **Native HTML5 WebVTT Track (`.vtt`)**: Seamless browser `<track>` integration with full W3C WebVTT standard compliance, controlled directly from the video player's embedded CC menu.
    - **Dual Subtitle Downloads**: One-click downloads for both `.srt` (for VLC, Premiere, DaVinci, CapCut) and `.vtt` (for web video & YouTube).
- **Render Free Tier Optimized & Pluggable Storage**:
  - Automatically limits FFmpeg to single-threaded low-memory streaming (`-threads 1`, `-preset veryfast`, `-bufsize 512k`) on Render Free Tier to stay safely within 512 MB RAM limits.
  - Universal multi-cloud storage adapter supporting **Local disk**, **AWS S3**, **Cloudflare R2** (zero egress fees), and **Google Cloud Storage (GCS)**.

### 4. Back Office Settings & Dynamic Configuration (`/#/settings`)
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

- `apps/api`: Node.js Express backend (ESM), Mongoose/MongoDB, JWT signers, CSV parser, Resend/Nodemailer email engine, FFmpeg video worker, and AI provider adapters (Google Gemini, Google Cloud TTS, Google Veo).
- `apps/web`: React 18 + Vite + Tailwind CSS frontend, HashRouter navigation, html5-qrcode scanner integration, responsive dashboard, AI Studio UI (`ProjectStudioPage.jsx`), and public registration portal.

---

## Database Schema (MongoDB Collections)

### Core Tenant & Event Collections
- `companies`: Multi-tenant organization workspace (`name`, `slug`, `ownerId`, `email`, `phone`, `isActive`).
- `users`: User profiles with multi-tenant company association (`companyId`, `phone`, `role`: `owner` | `co_owner` | `event_admin` | `event_staff` | `super_admin`, `assignedGateId`).
- `events`: Event definitions (`companyId`, `title`, `date`, `location`, `description`, `slug`, `createdBy`).
- `eventassignments`: Scoping mapping between team members (`event_admin`, `event_staff`) and specific `events`.
- `gates`: Physical entrance gates per event (`companyId`, `eventId`, `name`).
- `attendees`: Registered attendees (`companyId`, `eventId`, `name`, `email`, `phoneNumber`, `ticketUuid`, `ticketQrDataUrl`, `isCheckedIn`).
- `entrylogs`: Historical check-in log records with denormalized names/emails (`companyId`, `eventId`, `gateId`, `attendeeId`, `scannedAt`).

### AI Story-to-Video Collections
- `projects`: Story projects linked to `companyId` and `eventId` with references to active analysis, song, storyboard, and video, plus `language`, `characters: [{ name, role, visualDescription, referenceMediaId }]`, and `directorGuidelines`.
- `storyanalyses`: Story analysis output (summary, emotional arc, themes, key moments).
- `songs`: Generated lyrics, audio URL, duration, genre, mood, `language`, `voiceType`, and `musicProvider`.
- `medias`: Uploaded photo & video clip media items per project (`fileUrl`, `mediaType`, `caption`).
- `storyboards`: Scene timeline mapping (sceneNumber, start/end timestamps, lyricSnippet, visualPrompt, captionText, mediaId, and `characters: [String]`).
- `videos`: Rendered video documents (videoUrl, durationSeconds, resolution).
- `generationjobs`: Async background job status tracking (jobType, progressPercent, currentStepMessage).

---

## API Endpoints

### Auth & Multi-Tenant Management (`/api/auth/*`)
- `POST /api/auth/register-company`: Self-service company registration creating company workspace & initial Owner.
- `POST /api/auth/setup-admin`: Bootstrap initial global super admin account.
- `POST /api/auth/login`: Validate credentials, verify company active state, and issue tenant-scoped JWT token.
- `GET /api/auth/staff` (auth): List company team members (scoped by caller's role hierarchy).
- `POST /api/auth/staff` (auth): Create team user (`co_owner`, `event_admin`, `event_staff`) with role validation, event assignments, and gate assignment.
- `PUT /api/auth/staff/:id` (auth): Update team member details, role, gate, or event assignments (enforces hierarchy guardrails).
- `DELETE /api/auth/staff/:id` (auth): Delete team member account (prevents self-deletion and protects Owner/Co-Owner accounts from unauthorized deletion).

### Events, Attendees, & Gates (`/api/events/*`)
- `POST /api/events` (owner, co_owner, super_admin): Create a new event within the caller's company.
- `GET /api/events` (auth): List accessible events (company-wide for Owner/Co-Owner; assignment-scoped for Event Admin/Staff).
- `DELETE /api/events/:eventId` (owner, co_owner, super_admin): Delete event with cascading cleanup of attendees, gates, logs, and storyboards.
- `GET /api/events/:eventId/stats` (auth): Event registration & check-in analytics.
- `GET /api/events/:eventId/attendees` (auth): Paginated attendee list with virtual scrolling support.
- `POST /api/events/:eventId/attendees` (auth): Register walk-in guest attendee.
- `POST /api/events/:eventId/attendees/bulk` (auth): Bulk CSV attendee import.
- `PATCH /api/events/:eventId/attendees/:attendeeId` (auth): Update attendee details.
- `DELETE /api/events/:eventId/attendees/:attendeeId` (auth): Delete attendee record.
- `POST /api/events/:eventId/gates` (auth): Create physical entrance gate.
- `DELETE /api/events/:eventId/gates/:gateId` (auth): Delete entrance gate and unassign attached staff.
- `POST /api/scan/validate` (auth): Validate scanned QR ticket UUID with atomic duplicate prevention and gate logging.

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

## Deployment Architectures: Cloud Run vs Render

This platform supports two production deployment models for the backend API and video rendering engine:

| Architecture Component | Option A: Google Cloud Run (Recommended for AI Video) | Option B: Render Web Service (Free Tier) |
| :--- | :--- | :--- |
| **Backend API & Worker** | **Google Cloud Run** (2 vCPU, 2 GB RAM, Gen2, 600s timeout) | **Render Web Service** (0.5 vCPU, 512 MB RAM) |
| **Frontend UI** | **Render Static Site** (Fast worldwide CDN) | **Render Static Site** |
| **Media Storage** | **Google Cloud Storage (GCS)** (`qr-event-story-media`) | **Cloudflare R2** or **Google Cloud Storage** |
| **Database** | **MongoDB Atlas M0** | **MongoDB Atlas M0** |
| **Cost** | Free tier covers 2 million requests + generous compute | 100% Free Tier |
| **Heavy Video Rendering** | Handles 1080p Full HD multi-scene videos effortlessly in seconds | Throttled to `-threads 1` to stay within 512 MB RAM |

---

## How to Switch API Between Cloud Run and Render

You can switch your backend between Google Cloud Run and Render at any time without changing application code. Only one environment variable in your frontend needs to point to the active backend URL.

### Scenario 1: Switching from Render to Google Cloud Run (Active Setup)

1. **Deploy API on Cloud Run**:
   ```bash
   gcloud run deploy event-qr-api \
     --source . \
     --project YOUR_GCP_PROJECT_ID \
     --region us-central1 \
     --allow-unauthenticated \
     --memory 2Gi \
     --cpu 2 \
     --timeout 600 \
     --execution-environment gen2 \
     --service-account YOUR_SA_NAME@YOUR_GCP_PROJECT_ID.iam.gserviceaccount.com \
     --set-env-vars MONGO_URI="YOUR_MONGODB_URI",JWT_SECRET="YOUR_JWT_SECRET",STORAGE_PROVIDER="gcs",GCS_BUCKET="YOUR_GCS_BUCKET",GOOGLE_CLOUD_PROJECT="YOUR_GCP_PROJECT_ID",GOOGLE_CLOUD_LOCATION="us-central1"
   ```
2. **Copy Cloud Run Service URL**:
   Example: `https://event-qr-api-<hash>-<region>.a.run.app`
3. **Update Frontend on Render**:
   - Go to **Render Dashboard** → click your **Frontend Web Service / Static Site**.
   - Navigate to **Environment** in the left sidebar.
   - Update `VITE_API_BASE` to your Cloud Run URL:
     `VITE_API_BASE=https://event-qr-api-<hash>-<region>.a.run.app`
   - Click **Save Changes** → **Manual Deploy** → **Clear build cache & deploy**.
4. **Suspend Render API Service** (Optional):
   - In Render Dashboard, go to your old `apps/api` Web Service → click **Settings** → **Suspend Web Service** (to save resources).

---

### Scenario 2: Switching from Google Cloud Run back to Render

If you ever want to run the backend completely on Render:

1. **Resume or Create the Render API Web Service**:
   - In Render Dashboard, click **New +** → **Web Service** (or unsuspend your existing API service).
   - Connect your GitHub repository.
   - **Root Directory**: `apps/api` (or empty if using root npm workspaces).
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (0.5 CPU, 512 MB RAM).
2. **Add Environment Variables in Render API Web Service**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default, Render sets `PORT`)
   - `MONGO_URI`: `mongodb+srv://...`
   - `JWT_SECRET`: `your-jwt-secret`
   - `STORAGE_PROVIDER`: `gcs` (or `r2` / `s3`)
   - `GCS_BUCKET`: `your-storage-bucket`
   - `GOOGLE_CLOUD_PROJECT`: `YOUR_GCP_PROJECT_ID`
   - `GOOGLE_CLOUD_LOCATION`: `us-central1`
3. **Configure Google Cloud Credentials on Render**:
   - Render does not have GCP IAM Application Default Credentials.
   - In Render Dashboard → API Service → **Secret Files**:
     - File Name: `/etc/secrets/gcp-service-account.json`
     - Contents: Paste the JSON contents of your GCP service account key.
   - In Environment Variables, add:
     - `GOOGLE_APPLICATION_CREDENTIALS`: `/etc/secrets/gcp-service-account.json`
4. **Update Frontend on Render**:
   - Go to your Frontend Static Site → **Environment**.
   - Change `VITE_API_BASE` back to your Render API address:
     `VITE_API_BASE=https://your-api.onrender.com`
   - Click **Manual Deploy** → **Clear build cache & deploy**.
5. **Scale Down Cloud Run** (Optional):
   - To ensure you don't incur charges on Cloud Run, scale its minimum and maximum instances to 0:
     ```bash
     gcloud run services update event-qr-api --max-instances=0 --region=us-central1
     ```

---

## Continuous Deployment to Cloud Run on `git push main`

### Option 1: Native Cloud Run Continuous Deployment (Recommended)
1. Open Google Cloud Console → **Cloud Run** → Click `event-qr-api`.
2. Click **"SET UP CONTINUOUS DEPLOYMENT"**.
3. Select **GitHub** and authorize repo: `rjshnautiyal31-cloud/event-management`.
4. Branch: `^main$`.
5. Build Type: **Dockerfile** (path: `/Dockerfile`).
6. Click **Save**. Cloud Build automatically rebuilds and rolls out updates whenever commits hit `main`.

### Option 2: GitHub Actions Workflow
The repo includes [`.github/workflows/deploy-cloud-run.yml`](.github/workflows/deploy-cloud-run.yml).
Add your service account key JSON as a repository secret named `GCP_SA_KEY` under **GitHub Settings → Secrets and variables → Actions**.

---

## Quick Start (Local Development)

1. **Install dependencies at root**:
   ```bash
   npm install
   ```

2. **Start Backend API and Web App**:
   ```bash
   npm run dev:api  # Backend API on http://localhost:4000
   npm run dev:web  # Web App on http://localhost:5173
   ```

3. **Access AI Story-to-Video Studio & Settings**:
   - **Studio**: `http://localhost:5173/#/studio`
   - **Settings Dashboard**: `http://localhost:5173/#/settings` (Strictly accessible by `super_admin` only).

---

## Documentation & References

- User Guide: [`USER_GUIDE.md`](./USER_GUIDE.md)
- Technical Implementation Plan: [`ai_story_to_video_implementation_plan.md`](./ai_story_to_video_implementation_plan.md)

