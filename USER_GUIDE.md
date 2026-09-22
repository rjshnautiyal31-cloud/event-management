# Event QR Check-In System: Comprehensive User Guide

Welcome to the **Event QR Check-In System**! This application is designed to help you create and manage events at scale, register attendees (via a public form, walk-in additions, or bulk CSV import), distribute unique QR tickets with inline image attachments, and check-in attendees at different gates with double-scan prevention and zero-lag performance.

---

## Table of Contents
1. [First-Time Admin Setup](#1-first-time-admin-setup)
2. [Navigation & High-Volume Event Management](#2-navigation--high-volume-event-management)
3. [Event Creation & Quick Pickers](#3-event-creation--quick-pickers)
4. [User, Staff & Role Management](#4-user-staff--role-management)
5. [Event Gate Management](#5-event-gate-management)
6. [Attendee Management & High-Volume Virtual Roster](#6-attendee-management--high-volume-virtual-roster)
7. [QR Code Check-In Scanning](#7-qr-code-check-in-scanning)
8. [Email Ticket Deliveries (Resend vs SMTP)](#8-email-ticket-deliveries-resend-vs-smtp)
9. [AI Story-to-Song-to-Video Studio](#9-ai-story-to-song-to-video-studio)
10. [Google Cloud Run & Cloud Storage Production Setup](#10-google-cloud-run--cloud-storage-production-setup)
11. [How to Switch API Between Cloud Run and Render](#11-how-to-switch-api-between-cloud-run-and-render)
12. [Back Office Settings & Environment Variables (`/#/settings`)](#12-back-office-settings--environment-variables--settings)

---

## 1. First-Time Admin Setup

When you deploy the application for the first time, bootstrap your initial **Super Administrator** account:

1. **Bootstrap Endpoint**: Send a `POST` request to `/api/auth/setup-admin` with the body:
   ```json
   {
     "setupKey": "setup-admin", // Configured via ADMIN_SETUP_KEY env var
     "name": "Super Admin",
     "email": "admin@yourdomain.com",
     "password": "your_secure_password"
   }
   ```
2. **Environment Configuration**: Ensure `ADMIN_SETUP_KEY` is set inside your backend's environment variables (`apps/api/.env`).
3. Once bootstrapped, navigate to `/login` and log in using your newly created admin credentials.

---

## 2. Navigation & High-Volume Event Management

### **Universal `#0A2D59` Navigation Bar (`Navbar`)**
- Present across all pages (`/dashboard`, `/generator`, `/scan`).
- Click the **Hamburger Menu (`☰`)** button in the top left to reveal the slide-over drawer panel for 1-tap navigation between **Overview Hub**, **Attendee Roster**, **Gates & Posts**, **Events Directory**, and **Team Access**.

### **Command Switcher Palette (`⌘K` / `Ctrl+K`)**
When managing dozens, hundreds, or thousands of events:
1. Click the **Event Switcher Pill** in the header or press `⌘K` (`Ctrl+K` on Windows/Linux) to launch the **Command Switcher Palette**.
2. **Search Input**: Type any keyword to instantly filter events by title, venue location, or date.
3. **Category Tabs**: Toggle between `⚡ Active & Upcoming`, `🕒 Past Events`, and `⭐ Pinned / Favorites`.
4. **Pinning Events**: Click the `⭐ Pin` button on any event card to pin it to your favorites for instant access across sessions.

### **Events Directory Workspace Tab**
1. Switch to the **🗓️ Events** tab in your dashboard.
2. View the full-width data table listing all managed events with real-time text search, status filters (`🟢 Live Today`, `🗓 Upcoming`, `🏁 Ended`), public pass links (`/#/register/:slug`), and 1-tap active event switching.

---

## 3. Event Creation & Quick Pickers

1. Click **+ New Event** in the header or dashboard.
2. **Quick Date & Time Pickers**:
   - Use 1-tap preset buttons: `📅 Today`, `🚀 Tomorrow`, `📆 Next Week`.
   - Native calendar and time popups open automatically on tap/click.
3. Click **Create Event**. Your new event becomes active immediately.

### **Public Registration Pass Links**
- Share the public pass link (`/#/register/your-event-slug`) or print the **Event Registration QR Code**.
- When attendees submit the form, their unique QR entrance ticket renders instantly on-screen and is automatically emailed to them with an inline QR image (`cid:qrcode`).

---

## 4. User, Staff & Role Management

The system features granular role-based access control:
- **`super_admin`**: Full system control across all events, user accounts, and global settings.
- **`event_admin`**: Full management access to assigned events, attendees, and gates.
- **`event_staff`**: Restricted to the **Scanner Page** (`/scan`) to validate tickets at assigned gates.

### **Creating and Assigning Users**
1. Go to the **Team & Staff Access** section in the dashboard.
2. Enter the staff member's **Name**, **Email**, and **Password**.
3. Select their **Role** and optional **Assigned Gate**.
4. Scanner accounts are **automatically locked to their assigned gate upon login**, eliminating mis-scan errors.

---

## 5. Event Gate Management

1. Go to the **Gates & Posts** tab.
2. Enter a gate name (e.g., `Gate A - Main Entrance`, `VIP Gate`) and click **Add Gate**.
3. Assign staff members to specific gates from the user list. Staff scanners update instantly.

---

## 6. Attendee Management & High-Volume Virtual Roster

The **Attendee Roster** is engineered for high-volume crowds (100s to 1,000s of attendees):
- **Real-Time Search**: Search by attendee name, email, or phone number.
- **Status Filters**: Filter by `All`, `Checked In`, or `Pending`.
- **Batching & Infinite Scroll**: Select page size (25 / 50 / 100 / All) or scroll smoothly with virtualized batch rendering.
- **Inline QR Thumbnails**: Click any QR thumbnail to open a high-resolution modal for printing or re-sending tickets.
- **Bulk CSV Import**: Import large guest lists with automatic BOM stripping, duplicate filtering, and instant batch ticket generation.

---

## 7. QR Code Check-In Scanning

1. Staff members open the **Scanner Page** (`/scan`).
2. The scanner uses the device camera to scan tickets in real-time.
3. **Atomic Single-Scan Validation**:
   - `🟢 VALID TICKET`: Displays attendee details and records check-in timestamp and gate location.
   - `🔴 DUPLICATE SCAN`: Alerts staff immediately if a ticket has already been checked in, showing original check-in time and gate.

---

## 8. Email Ticket Deliveries (Resend vs SMTP)

- **Resend API Integration** (`RESEND_API_KEY`): Recommended for cloud platforms like Render's Free Tier (bypasses blocked outbound SMTP ports 25, 465, and 587).
- **Inline CID Attachments** (`cid:qrcode`): QR ticket images are embedded inline as Content-ID attachments, guaranteeing crisp image rendering across Gmail, Outlook, Yahoo, and mobile mail apps.

---

## 9. AI Story-to-Song-to-Video Studio

The integrated **AI Story Studio** transforms event stories, testimonials, and milestone narratives into full musical songs with synchronized lyrics, realistic motion video clips, and high-definition rendered MP4 videos.

Navigate to **`/#/studio`** (accessible from the top navigation bar or drawer menu).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             5-STAGE STUDIO PIPELINE                              │
│                                                                                  │
│ [1. Story Narrative] ➔ [2. AI Song & Lyrics] ➔ [3. Photos & Clips] ➔             │
│                       ➔ [4. Lyric-Sync Storyboard] ➔ [5. Multi-Device Render]    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.1 Multilingual Story-to-Song-to-Video Engine
The studio natively supports **10 major global languages**:
- 🇺🇸 **English** (en)
- 🇮🇳 **Hindi (हिन्दी)** (hi)
- 🇪🇸 **Spanish (Español)** (es)
- 🇫🇷 **French (Français)** (fr)
- 🇩🇪 **German (Deutsch)** (de)
- 🇯🇵 **Japanese (日本語)** (ja)
- 🇨🇳 **Chinese (中文)** (zh)
- 🇸🇦 **Arabic (العربية)** (ar)
- 🇧🇷 **Portuguese (Português)** (pt)
- 🇧🇩 **Bengali (বাংলা)** (bn)

**How Multilingual Generation Works**:
1. Select your target language during project creation or in the top-right language picker in **Tab 1**.
2. **Native Lyrics & Script**: Gemini Flash 2.5 crafts rhythmic, rhyming lyrics in the chosen language and native script (e.g., Devanagari for Hindi, Pinyin/Hanzi for Chinese).
3. **Vocal Singing & Synthesis**: The vocal synthesis models adapt to the language's phonetics and accent patterns.
4. **Synchronized Subtitles**: Captions burned into the final video preserve the native typography and lyrics.
5. **Cross-Lingual Visual Prompts**: Storyboard visual directions for AI video and image engines are generated in English to maximize fidelity with models like Google Gemini Omni 1.1 Flash and Google Imagen 3.

---

### Stage 1: Story Narrative, Cast Bible & Director Directives (Level 1 Control)
1. Select an existing story project or click **"+ New Story Project"**.
2. **Story Narrative**: Enter raw event memories, speeches, or summaries.
3. **👥 Cast & Characters Consistency Guide (Visual Bible)**:
   - Define the key individuals in your story (*Rahul, Priya, Keynote Speaker, Birthday Star*).
   - Provide their **Role in Event** and specific **Visual Appearance & Attire** (e.g. *30yo Indian man with short black hair, wearing a cream silk sherwani with red turban*).
   - **Why This Matters**: Generative AI models often change character faces and clothes between clips. By defining your cast here, Gemini systematically injects these visual descriptors into every scene featuring that character, preserving visual identity throughout the entire video.
4. **🎬 Director Guidelines & Must-Have Scenes**:
   - Provide directives for specific moments you want featured (e.g. *1. Grand welcome. 2. Stage garland exchange. 3. Family champagne toast. 4. Lantern lighting at dusk.*).
   - Gemini prioritizes these moments when laying out the chronological timeline.
5. Click **"Analyze Story Narrative"** to generate an executive summary, emotional arc, and thematic tags.

---

### Stage 2: AI Song Lyrics, Vocal Voice Selection & Duration Control
Switch to **Tab 2: AI Lyrics & Audio**:
1. **Music Engine**:
   - 🌟 **Google DeepMind Lyria 3 Pro** (`lyria-3-pro-preview`): State-of-the-art vocal composition and acoustic production.
   - 🎵 **ElevenLabs Music Synthesis**: Polished studio pop, acoustic, and electronic production.
   - 🎸 **Suno AI**: Melodic song synthesis.
   - 🔊 **Google Cloud Neural2 TTS**: High-fidelity speech synthesis over rhythmically synchronized backing beats.
2. **Vocal Voice Selection**:
   - 👩 **Female Vocalist**: Emotive soprano / alto lead vocals.
   - 👨 **Male Vocalist**: Warm tenor / baritone lead vocals.
   - 👥 **Duet / Harmonized Ensemble**: Harmonious dual vocal arrangement.
   - 🎙️ **Custom Vocal Persona**: Freely type any vocal style (e.g., *husky delta blues singer*, *ethereal operatic choir*, *energetic K-pop vocalist*).
3. **Musical Style / Genre**:
   - 🎸 Acoustic / Folk • 🎹 Cinematic Orchestral • 🎤 Pop / Uplifting • ⚡ Epic Rock • 🥁 Lo-Fi Chill • 🎷 Jazz / Soul • 🪕 Traditional / Cultural.
4. **Audio Song Duration Control**:
   - Choose between **15s, 30s, 45s, 60s, 90s, 120s, up to 180s (3 full minutes)**.
   - The AI writes structured lyrics (*Verses, Chorus, Bridge, Outro*) tailored to fill the target time window.
5. Click **"Generate AI Song & Vocals"**:
   - Includes automatic retry if a model is temporarily rate-limited.
   - **Transparent Fallback Badges**: The player clearly displays which engine produced the audio track (e.g. `🌟 DeepMind Lyria 3 Pro` or `🔊 Neural2 TTS + Rhythm Synth`) so you are always aware of the active provider.

---

### Stage 3: Event Photos & Pure AI Motion Video Generation
Switch to **Tab 3: Media Gallery**:
1. **Uploading Real Event Media**:
   - Upload real event photos (`.jpg`, `.png`, `.webp`) or video clips (`.mp4`, `.mov`).
   - Assets are securely stored in your chosen storage backend (Cloudflare R2, Google Cloud Storage, AWS S3, or Local).
2. **Pure AI Cinematic Scene Mode**:
   - If no photos are uploaded (or if you click **"Clear All Media"**), the engine switches to **Pure AI Mode**.
   - It generates 16:9 photorealistic visual scenes for every moment without requiring any manual uploads.

---

### Stage 4: Lyric-Synchronized Storyboard & Granular Scene Editor (Level 2 Control)
Switch to **Tab 4: Timeline & Storyboard**:
1. Click **"🎵 Sync Storyboard with Song Lyrics"**:
   - The engine analyzes the actual generated audio duration (e.g. 30s = 5 scenes of ~6s each; 180s = 30 scenes of ~6s each).
   - Natural 5–6s scene cuts are created to match AI video clip lengths, ensuring video clips never need to freeze or loop.
   - Gemini maps specific lyric lines and tags featured characters in each scene.
2. **Granular Scene-by-Scene Controls**:
   - **👥 Scene Cast Tagging**: View characters assigned to each scene. Click cast pills (e.g. `✓ Rahul` / `+ Priya`) to toggle characters into or out of any scene.
   - **✏️ Interactive Visual Action / Prompt Editor**: Click **"✏️ Edit Prompt"** to edit the scene's visual action, camera angle, and environment. Use the **`+Name` Quick-Insert** buttons to instantly append that character's detailed physical traits to your prompt. Click **"Save Prompt"** to save changes immediately.
   - **🎨 Regenerate AI Image Frame**: Click **"🎨 Regen Image"** to generate a fresh high-resolution AI image frame for that specific scene using the updated prompt.
   - **✨ Convert to Gemini Omni Video / Regenerate Video**: Click **"✨ Convert to Gemini Omni Video"** to render a realistic 5-second 16:9 motion video clip using **Google Gemini Omni 1.1 Flash** (`gemini-omni-1.1-flash-preview`).
   - **✨ Batch Generation**: Click **"Generate Gemini Omni Video Clips (All Scenes)"** in the top action bar to batch-render motion clips for the entire storyboard.
   - **Source Media Reassignment**: If you have uploaded media in your gallery, use the **Source Visual Media** dropdown on any scene card to assign a specific uploaded photo or video clip instead of the AI frame.

---

### Stage 5: Multi-Device Resolution Video Rendering & Download
Switch to **Tab 5: Render & Video**:
1. Choose your target **Display & Resolution Preset**:
   - 🖥️ **Desktop Full HD (1080p)**: `1920x1080` (16:9 widescreen, 6000 kb/s) — Big screens, YouTube, and event presentations.
   - 💻 **Desktop HD (720p)**: `1280x720` (16:9 standard HD, 3500 kb/s) — Balanced rendering speed for web streaming.
   - 📱 **Mobile Portrait (9:16)**: `1080x1920` (9:16 vertical, 4500 kb/s) — Optimized for TikTok, Instagram Reels, and YouTube Shorts.
   - 📟 **Tablet Display (4:3)**: `1440x1080` (4:3 ratio, 4500 kb/s) — iPads, POS terminals, and tablet kiosks.
   - 🔲 **Social Square (1:1)**: `1080x1080` (1:1 square, 4000 kb/s) — Instagram feed posts and LinkedIn carousels.
2. Click **"Start Video Render"**:
   - A background FFmpeg worker stitches the video segments, synchronizes the song audio, burns multilingual subtitles, and monitors progress in real time (0% to 100%).
3. **Playback & Download**:
   - Play the finished high-definition video directly in the browser player.
   - Click **"Download Video (MP4)"** to save the finished MP4 file locally.

---

## 10. Multi-Cloud Storage & Render Free Tier Deployment

### Understanding Free Tier Constraints
When deploying to cloud platforms like **Render's Free Web Service**:
- **Ephemeral Storage**: Free instances wipe `/uploads` on every restart or redeploy. Persistent cloud storage is required for images, audio tracks, and rendered videos.
- **512 MB RAM Ceiling**: Standard FFmpeg video rendering can consume >800 MB RAM for 1080p video, causing the platform to kill the process (`SIGKILL - Out of Memory`).
- **15-Minute Inactivity Sleep**: Free instances spin down after 15 minutes of inactivity, terminating any long-running in-memory jobs.

### Multi-Cloud Storage Configuration
The system features a universal storage adapter supporting four storage backends configured via environment variables:

#### Option A: Cloudflare R2 (Recommended — 100% Free with 0 Egress Fees)
Cloudflare R2 provides 10 GB free monthly storage with zero egress fees:
```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<your_cloudflare_account_id>.r2.cloudflarestorage.com
S3_BUCKET=event-media
S3_REGION=auto
AWS_ACCESS_KEY_ID=<your_r2_access_key>
AWS_SECRET_ACCESS_KEY=<your_r2_secret_key>
S3_PUBLIC_DOMAIN=https://pub-<hash>.r2.dev
```

#### Option B: Google Cloud Storage (GCS)
Uses native Google Cloud Storage (5 GB free tier):
```env
STORAGE_PROVIDER=gcs
GCS_BUCKET=event-media-gcs
GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

#### Option C: AWS S3
Standard Amazon S3 storage:
```env
STORAGE_PROVIDER=s3
S3_BUCKET=your-aws-bucket
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

#### Option D: Local Disk (Local Development)
```env
STORAGE_PROVIDER=local
PUBLIC_URL=http://localhost:4000
```

### Low-Memory FFmpeg Guard & Ultrafast Stream Copy
The built-in video worker employs two optimization strategies:
- **Ultrafast Stream Copy (`-c:v copy`)**: When stitching normalized scene clips together, FFmpeg performs direct stream copying without re-encoding video frames. This reduces render times from minutes to seconds and drastically lowers CPU and memory consumption.
- **Render Free Tier Low-Memory Mode**: When running on Render (`NODE_ENV=production`), it caps FFmpeg to `-threads 1` and `-bufsize 512k` to stay safely within Render's 512 MB RAM limit.

---

## 10. Google Cloud Run & Cloud Storage Production Setup

For high-volume video rendering, Google Cloud Run is the recommended production backend target:
- **Dedicated Compute**: 2 vCPU and 2 GB RAM (Gen2 execution environment, 600s timeout).
- **Application Default Credentials (ADC)**: When running in Cloud Run, Google Cloud natively authenticates storage and Vertex AI through the container's service account without requiring a local `gcp-service-account.json` file.
- **Direct Public Media CDN**: Media stored in Google Cloud Storage (`qr-event-story-media`) is served directly to users via Google's global CDN.

### Cloud Run Deployment Command
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

---

## 11. How to Switch API Between Cloud Run and Render

Because the frontend and backend are completely decoupled, you can switch the backend between Google Cloud Run and Render at any time by changing a single environment variable in the frontend on Render.

### Scenario A: Switching from Render to Google Cloud Run (Active Setup)
1. **Deploy API on Cloud Run**: Run the `gcloud run deploy` command in Cloud Shell.
2. **Note your Cloud Run URL**: (e.g., `https://event-qr-api-<hash>-<region>.a.run.app`).
3. **Point Frontend to Cloud Run**:
   - Go to your Render Dashboard → Frontend Static Site / Web Service → **Environment**.
   - Set `VITE_API_BASE` to:
     ```
     VITE_API_BASE=https://event-qr-api-<hash>-<region>.a.run.app
     ```
   - Click **Save Changes** → **Manual Deploy** → **Clear build cache & deploy**.
4. **Suspend Render API Service** (Optional):
   - In Render Dashboard, go to your old `apps/api` Web Service → click **Settings** → **Suspend Web Service** (saves memory and avoids sleep issues).

### Scenario B: Switching from Google Cloud Run back to Render
1. **Unsuspend or Create the API Service on Render**:
   - In Render Dashboard, go to your API Web Service and click **Resume**.
   - If setting up fresh:
     - **Root Directory**: `apps/api`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free (512 MB RAM)
2. **Set Environment Variables on Render API Service**:
   - `MONGO_URI`: `mongodb+srv://...`
   - `JWT_SECRET`: `your_jwt_secret`
   - `STORAGE_PROVIDER`: `gcs` (or `r2`)
   - `GCS_BUCKET`: `your-storage-bucket`
   - `GOOGLE_CLOUD_PROJECT`: `YOUR_GCP_PROJECT_ID`
   - `GOOGLE_APPLICATION_CREDENTIALS`: `/etc/secrets/gcp-service-account.json`
3. **Upload GCP Key to Render (Secret Files)**:
   - On Render, open your API Web Service → **Secret Files**.
   - Add a file `/etc/secrets/gcp-service-account.json` and paste your service account key JSON.
4. **Point Frontend to Render**:
   - In Render Dashboard, open your Frontend Static Site → **Environment**.
   - Change `VITE_API_BASE` to:
     ```
     VITE_API_BASE=https://your-api.onrender.com
     ```
   - Click **Save Changes** → **Manual Deploy** → **Clear build cache & deploy**.
5. **Scale Cloud Run to 0** (Optional):
   - Prevent any unwanted charges on Cloud Run:
     ```bash
     gcloud run services update event-qr-api --max-instances=0 --region=us-central1
     ```

### Automated Continuous Deployment on `git push main`
- **Via Cloud Run Console**: Open Cloud Run → `event-qr-api` → **Set Up Continuous Deployment** → connect GitHub repo `rjshnautiyal31-cloud/event-management` and branch `main`.
- **Via GitHub Actions**: Add secret `GCP_SA_KEY` to GitHub repo settings; the workflow at [`.github/workflows/deploy-cloud-run.yml`](.github/workflows/deploy-cloud-run.yml) will deploy automatically on every push to `main`.

---

## 12. Back Office Settings & Environment Variables (`/#/settings`)

The platform includes a dedicated **Back Office Settings Dashboard** accessible directly from the top navigation bar or drawer menu (`⚙️ Settings`).

> [!IMPORTANT]
> **Strict Super Admin Access Only**: The Settings page and its underlying API routes (`/api/settings/*`) are strictly guarded. Only users with the **`super_admin`** role can view or modify settings. Event Admins and Staff are blocked with `403 Forbidden`.

### Dual-Tier Precedence Hierarchy
All system parameters and cloud credentials operate on a strict 2-tier resolution order:
1. **Tier 1 (Highest Priority): Back Office Database Settings**
   - Values saved through the Settings UI are stored directly in MongoDB in the `systemsettings` collection.
   - Any value defined here overrides `.env` variables immediately without requiring a server reboot or restart.
   - Indicated in the UI by a 🟢 **`Database (BO)`** badge.
2. **Tier 2 (Fallback Priority): Environment Variables (`.env`)**
   - If a setting has no override saved in the Database, the application automatically reads the value from `process.env` (loaded from `.env` or Render/Cloud Run environment settings).
   - Indicated in the UI by a 🟡 **`.env Fallback`** badge.
3. **Tier 3: Built-in Defaults**
   - If neither the Database nor `.env` specifies a value, a safe default is applied (e.g., `local` for storage, `memory` for queue, `google_lyria` for music).

### Configurable Categories
- **☁️ Cloud Storage**: Switch between `local`, `s3`, `r2`, and `gcs`. Set custom S3 endpoints, public CDN domains, bucket names (`GCS_BUCKET`), and credentials.
- **🤖 AI & Vertex LLM**: Set `GEMINI_API_KEY`, Google Cloud Project ID (`GOOGLE_CLOUD_PROJECT`), Vertex AI region, and default LLM provider.
- **🎵 Music & Audio**: Set `MUSIC_PROVIDER` (`google_lyria`, `elevenlabs`, `suno`, `google_tts`, `local_synth`) and respective API keys.
- **🎬 Motion Video**: Set `VIDEO_PROVIDER` (`google_omni`, `google_veo`, `replicate`, `local_ffmpeg`) and Replicate API keys.
- **📬 Email & Tickets**: Set `RESEND_API_KEY` (recommended for Render free tier), `SENDER_EMAIL`, and custom SMTP host, port, user, and password.
- **🌐 Network & Queue**: Set `PUBLIC_URL`, `FRONTEND_BASE_URL`, `QUEUE_PROVIDER` (`memory` or `redis`), `REDIS_URL`, and optional external video `WORKER_URL`.

### Live Diagnostics & Testing
- **Test Cloud Storage**: Click **"Test Storage"** in the top action bar. The server uploads a test buffer using the active storage configuration and validates the generated public URL.
- **Test AI Keys**: Click **"Test AI Keys"** to verify that Gemini API or GCP Vertex AI project credentials are valid.
- **Reset to .env**: For any setting currently stored in the Database, click **"Reset to .env"** to delete the DB override and immediately revert back to the environment variable.



