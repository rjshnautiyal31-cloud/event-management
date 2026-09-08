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
10. [Multi-Cloud Storage & Render Free Tier Deployment](#10-multi-cloud-storage--render-free-tier-deployment)

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

### Stage 1: Story Narrative & Emotional Arc Analysis
1. Select an existing story project or click **"+ New Story Project"**.
2. Enter your **Event Narrative** (e.g., keynote speech highlights, founder's anniversary story, wedding vows, or conference milestones).
3. Click **"Analyze Story Narrative"**.
4. **Google Gemini 2.5 Flash** (via Vertex AI) analyzes the text and produces:
   - **Executive Summary** & overall emotional sentiment.
   - **Thematic Highlights**: Key themes and narrative mood.
   - **Scene Breakdowns**: Chronological visual scenes with distinct camera directions, emotional beats, and lighting suggestions.

### Stage 2: AI Song Lyrics & Full Vocal Track Generation
1. Switch to **Tab 2: AI Lyrics & Audio**.
2. Select your desired musical genre:
   - 🎸 **Acoustic / Folk**: Intimate guitars, organic percussion, warm vocals.
   - 🎹 **Cinematic Orchestral**: Sweeping strings, brass climaxes, grand choir harmonies.
   - 🎤 **Pop / Uplifting**: Energetic tempo, catchy hooks, modern production.
   - ⚡ **Epic Rock**: Driving drums, soaring electric guitars, powerful vocals.
3. Choose the target song duration (30 seconds up to full 3-minute songs).
4. Click **"Generate AI Song & Vocals"**:
   - The studio triggers **Google DeepMind Lyria 3 Pro / Lyria 2** (`lyria-3-pro-preview`) via Vertex AI.
   - It composes an authentic melody with harmonized vocals, instruments, and structured sections (*Intro, Verse, Chorus, Bridge, Outro*).
   - Listen to the audio preview directly in the built-in media player.

### Stage 3: Event Photos & Pure AI Motion Video Generation
1. Switch to **Tab 3: Media Gallery**.
2. **Uploading Real Event Media**:
   - Drag and drop or browse photos (`.jpg`, `.png`, `.webp`) or video clips (`.mp4`, `.mov`).
   - Assets are uploaded directly to your configured storage provider (Cloudflare R2, Google Cloud Storage, AWS S3, or Local).
3. **Pure AI Cinematic Scene Mode**:
   - If no photos are uploaded (or if you click **"Clear All Media"**), the engine switches to **Pure AI Mode**.
   - It generates realistic 5-second 16:9 motion video clips for every scene using **Google Gemini Omni 1.1 Flash** (`gemini-omni-1.1-flash-preview`) or Google Veo.

### Stage 4: Lyric-Synchronized Scene Storyboard & Timeline
1. Switch to **Tab 4: Timeline & Storyboard**.
2. Click **"Generate Storyboard"**:
   - The engine automatically detects the exact audio duration of your generated song (e.g. 154s or 172s).
   - It distributes storyboard scenes across the song timeline to prevent repetitive clips.
   - Each scene is assigned its precise lyric phrase, start timestamp, end timestamp, and visual media clip.
3. Review the interactive storyboard cards to verify scene sequencing.

### Stage 5: Multi-Device Resolution Video Rendering & Download
1. Switch to **Tab 5: Render & Video**.
2. Choose your target **Display & Resolution Preset**:
   - 🖥️ **Desktop Full HD (1080p)**: `1920x1080` (16:9 widescreen, 6000 kb/s) — Best for big screens, YouTube, and event presentations.
   - 💻 **Desktop HD (720p)**: `1280x720` (16:9 standard HD, 3500 kb/s) — Balanced rendering speed for web streaming.
   - 📱 **Mobile Portrait (9:16)**: `1080x1920` (9:16 vertical, 4500 kb/s) — Optimized for TikTok, Instagram Reels, and YouTube Shorts.
   - 📟 **Tablet Display (4:3)**: `1440x1080` (4:3 ratio, 4500 kb/s) — Tailored for iPads, POS terminals, and tablet kiosks.
   - 🔲 **Social Square (1:1)**: `1080x1080` (1:1 square, 4000 kb/s) — Perfect for Instagram feed posts and LinkedIn carousels.
3. Click **"Start Video Render"**:
   - A background FFmpeg worker stitches the video segments, synchronizes the song audio, burns subtitles, and monitors progress in real time (0% to 100%).
4. **Playback & Download**:
   - Once rendering finishes, play the high-definition video directly in the browser player with resolution and duration badges.
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

### Low-Memory FFmpeg Guard
When running on Render, the video worker automatically applies low-memory encoding flags:
- `-threads 1`: Restricts FFmpeg to a single thread, reducing peak memory usage from 900MB to ~280MB.
- `-preset veryfast`: Minimizes buffer allocations.
- `-bufsize 512k -maxrate <bitrate>`: Enforces a strict streaming buffer window.

### Preventing Inactivity Sleep (Keep-Alive Ping)
Render free services spin down after 15 minutes of no HTTP requests. To prevent this while your event is active:
1. Register for a free account at [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).
2. Set up an HTTP check targeting:
   ```
   GET https://<your-render-app-name>.onrender.com/health
   ```
3. Set the interval to **every 10 minutes**.
4. The endpoint responds with `{"status":"ok","timestamp":"..."}` in under 5ms with zero database overhead, keeping the instance warm.

