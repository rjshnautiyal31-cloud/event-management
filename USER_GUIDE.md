# Event QR Check-In System: Comprehensive User & Administrator Guide

Welcome to the **Event QR Check-In System**! This application is designed to help organizations and event organizers manage events at scale across isolated company workspaces, register attendees (via a public registration link, walk-in additions, bulk CSV import, or downloadable event QR codes), distribute unique QR tickets with inline image attachments, check-in attendees at designated gates with double-scan prevention, and create cinematic milestone videos using the integrated **AI Story-to-Song-to-Video Studio**.

---

## Table of Contents
1. [Customer Company Registration & Owner Account Setup](#1-customer-company-registration--owner-account-setup)
2. [First-Time Super Admin Setup (Platform Oversight)](#2-first-time-super-admin-setup-platform-oversight)
3. [Navigation & Multi-Tenant Workspace](#3-navigation--multi-tenant-workspace)
4. [Event Creation, Public Links & Downloadable QR Codes](#4-event-creation-public-links--downloadable-qr-codes)
5. [Multi-Tenant Role-Based Access Control (RBAC) & Team Governance](#5-multi-tenant-role-based-access-control-rbac--team-governance)
6. [Event Gate Management](#6-event-gate-management)
7. [Attendee Management & High-Volume Virtual Roster](#7-attendee-management--high-volume-virtual-roster)
8. [QR Code Check-In Scanning](#8-qr-code-check-in-scanning)
9. [Email Ticket Deliveries (Resend vs SMTP)](#9-email-ticket-deliveries-resend-vs-smtp)
10. [AI Story-to-Song-to-Video Studio](#10-ai-story-to-song-to-video-studio)
11. [Multi-Cloud Storage & Render Free Tier Deployment](#11-multi-cloud-storage--render-free-tier-deployment)
12. [Google Cloud Run & Cloud Storage Production Setup](#12-google-cloud-run--cloud-storage-production-setup)
13. [How to Switch API Between Cloud Run and Render](#13-how-to-switch-api-between-cloud-run-and-render)
14. [Back Office Settings & Environment Variables (`/#/settings`)](#14-back-office-settings--environment-variables--settings)

---

## 1. Customer Company Registration & Owner Account Setup

The platform provides a streamlined self-service onboarding flow for new customer companies and event organizers directly from the authentication page:

### How to Register a New Company
1. Open your browser and navigate to the **Login Page** (`/#/login`).
2. Click on the **"Register Company"** tab at the top of the authentication card.
3. Complete the registration form:
   - **Company / Organization Name**: The unique legal or brand name of your business (e.g., *Acme Events Global*). Case-insensitive uniqueness is strictly enforced across the platform.
   - **Your Full Name**: The administrative contact person (e.g., *Sarah Connor*).
   - **Work Email**: Your unique company email address used for signing in (e.g., *sarah@acmeevents.com*).
   - **Phone Number**: (Optional) Contact phone number.
   - **Password**: Secure account password (minimum 6 characters).
4. Click **"Register & Create Workspace"**.
5. **Immediate Onboarding**:
   - The platform creates your dedicated `Company` record and assigns you the **`owner`** role.
   - Your session is automatically authenticated with a tenant-scoped JWT token and redirected to the **Dashboard** (`/#/dashboard`).
   - Your company name is prominently displayed inside the top navigation header and slide-over menu drawer.

---

## 2. First-Time Super Admin Setup (Platform Oversight)

For infrastructure operators or platform super administrators who manage cross-tenant maintenance, system diagnostics, and Back Office credentials:

1. **Bootstrap Endpoint**: Send a `POST` request to `/api/auth/setup-admin` with the bootstrap payload:
   ```json
   {
     "setupKey": "setup-admin", // Configured via ADMIN_SETUP_KEY env var
     "name": "Super Admin",
     "email": "admin@yourdomain.com",
     "password": "your_secure_password"
   }
   ```
2. **Environment Configuration**: Ensure `ADMIN_SETUP_KEY` is set inside your backend's environment variables (`apps/api/.env`).
3. Once bootstrapped, navigate to `/#/login` under the **"Sign In"** tab and log in using your admin credentials. Super Admins have unrestricted access to the **Back Office Settings Dashboard** (`/#/settings`).

---

## 3. Navigation & Multi-Tenant Workspace

### **Universal `#0A2D59` Navigation Bar (`Navbar`)**
- Present across all pages (`/dashboard`, `/generator`, `/scan`, `/studio`, `/settings`).
- **Company Identity Pill**: Displays the currently active tenant company name with an organization badge (`🏢 Company Name`).
- **Hamburger Menu (`☰`)**: Click to reveal the slide-over drawer panel for 1-tap navigation between **Overview Hub**, **Attendee Roster**, **Gates & Posts**, **Events Directory**, **Team Access**, and **AI Studio**.
- **Role-Aware Action Buttons**: High-privilege actions like `+ New Event` and `⚙️ Settings` dynamically adapt based on whether you are logged in as an Owner, Co-Owner, Event Admin, Staff, or Super Admin.

### **Command Switcher Palette (`⌘K` / `Ctrl+K`)**
When managing dozens or hundreds of events within your company:
1. Click the **Event Switcher Pill** in the header or press `⌘K` (`Ctrl+K` on Windows/Linux) to launch the **Command Switcher Palette**.
2. **Search Input**: Type any keyword to instantly filter events by title, venue location, or date.
3. **Category Tabs**: Toggle between `⚡ Active & Upcoming`, `🕒 Past Events`, and `⭐ Pinned / Favorites`.
4. **Pinning Events**: Click the `⭐ Pin` button on any event card to pin it to your favorites for instant access across sessions.

### **Events Directory Workspace Tab**
1. Switch to the **🗓️ Events** tab in your dashboard.
2. View the full-width data table listing all accessible events with real-time text search, status filters (`🟢 Live Today`, `🗓 Upcoming`, `🏁 Ended`), public registration links (`/#/register/:slug`), and 1-tap active event switching.

---

## 4. Event Creation, Public Links & Downloadable QR Codes

### **Creating an Event**
1. Click **+ New Event** in the header or dashboard (available to `owner`, `co_owner`, and `super_admin`).
2. Enter the event **Title**, **Date & Time**, **Venue Location**, and optional **Description**.
3. **Quick Date & Time Pickers**: Use 1-tap preset buttons (`📅 Today`, `🚀 Tomorrow`, `📆 Next Week`) for rapid entry.
4. Click **Create Event**. The event is immediately provisioned within your company workspace.

### **Public Guest Registration Link**
- Every event is assigned a SEO-friendly, unique public slug:
  ```
  https://<your-domain>/#/register/your-event-slug
  ```
- Guests can open this link on any mobile or desktop web browser without requiring a user account.
- Upon registration, guests immediately receive:
  - An on-screen digital entrance pass featuring their unique QR ticket UUID.
  - An automated confirmation email with an embedded inline QR code (`cid:qrcode`) for easy presentation at event gates.

### **📲 Downloadable Event Registration QR Code Link**
- Directly beside the public registration link on the event overview card, the platform renders a **high-resolution 360x360 branded QR code** in `#0A2D59` navy.
- **1-Tap PNG Download**: Click **"📥 Download Registration QR"** to immediately download a high-definition image named:
  ```
  <event-title>-registration-qr.png
  ```
- **How to Use the Downloadable QR Code**:
  - **On-Site Print Signage**: Place the QR code on roll-up standees at venue entrances, registration check-in kiosks, table tents, printed flyers, or badges so walk-in attendees can register on the spot.
  - **Digital Marketing**: Insert the PNG into email marketing newsletters, WhatsApp invitations, event landing pages, LinkedIn posts, or presentation slides.
  - **Attendee Experience**: Guests simply point their smartphone camera at the printed or digital QR code. Their phone natively detects the link and opens the event registration page instantly in their default browser.

### **🗑️ Event Deletion & Cascading Cleanup**
- Owners and Co-Owners can delete events from the Events Directory or the active event card.
- **Cascade Deletion**: When an event is deleted, the system automatically removes all associated attendees, physical gates, check-in entry logs, and AI story projects, ensuring your workspace remains clean and free of orphaned records.

---

## 5. Multi-Tenant Role-Based Access Control (RBAC) & Team Governance

The system enforces a rigid 5-tier organizational hierarchy:
```
1 Company ➔ 1 Owner ➔ Many Co-Owners ➔ Many Events ➔ Many Event Admins ➔ Many Event Staff
```

### **Role Definitions & Boundaries**

1. **👑 Company Owner (`owner`)**:
   - The primary account owner created during company registration.
   - Holds complete authority over company profile, events, gates, and team members.
   - **Exclusive Privilege**: Only the Owner can create, edit, or delete **Co-Owner** (`co_owner`) accounts.
   - Assigns events to Event Admins and gates to Event Staff.

2. **🤝 Company Co-Owner (`co_owner`)**:
   - Executive administrator sharing operational control across all company events, attendees, and gates.
   - Can create, edit, and delete events.
   - Can create, edit, and delete **Event Admin** and **Event Staff** accounts.
   - **Strict Protection Guardrail**: Co-Owners **cannot** create, edit, update, or delete the Company Owner account, nor can they create or modify other Co-Owners.

3. **🎫 Event Admin (`event_admin`)**:
   - Scoped strictly to the specific events assigned to them by an Owner or Co-Owner.
   - Cannot see, access, or modify unassigned company events.
   - Manages attendee registrations, CSV imports, walk-in additions, gate setups, and AI storyboards for their assigned events.
   - Can create, edit, and delete **Event Staff** (`event_staff`) only, and assign them to gates within their assigned events.
   - Cannot create, edit, or delete Owners, Co-Owners, or other Event Admins.

4. **📲 Event Staff (`event_staff`)**:
   - Dedicated gate scanner role restricted exclusively to the **Scanner Interface** (`/#/scan`).
   - Automatically locked to their assigned gate upon login to eliminate gate-crossing mistakes.
   - Zero access to attendee rosters, event settings, or administrative dashboards.

5. **🌐 Super Admin (`super_admin`)**:
   - Global platform oversight role for multi-tenant monitoring, database maintenance, and Back Office configuration (`/#/settings`).

### **RBAC Governance Matrix**

| Operational Capability | 👑 Owner | 🤝 Co-Owner | 🎫 Event Admin | 📲 Event Staff | 🌐 Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Register / Provision Company** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Create & Delete Events** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **View Events** | All Company Events | All Company Events | Assigned Events Only | Assigned Events Only | All Platform Events |
| **Create / Delete Co-Owners** | ✅ (Exclusive) | ❌ | ❌ | ❌ | ✅ |
| **Edit / Delete Owner Account** | ❌ (Protected) | ❌ (Blocked) | ❌ (Blocked) | ❌ (Blocked) | ✅ |
| **Create Event Admins** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Edit / Delete Event Admins** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Assign Events to Admins** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Create / Delete Event Staff** | ✅ | ✅ | ✅ (For assigned events) | ❌ | ✅ |
| **Assign Gates to Staff** | ✅ | ✅ | ✅ (For assigned gates) | ❌ | ✅ |
| **Manage Attendees & CSV Import** | ✅ | ✅ | ✅ (Assigned events) | ❌ | ✅ |
| **Scan QR Tickets (`/scan`)** | ✅ | ✅ | ✅ | ✅ (Locked to gate) | ✅ |
| **AI Story-to-Video Studio** | ✅ | ✅ | ✅ (Assigned events) | ❌ | ✅ |
| **Back Office Settings (`/#/settings`)**| ❌ | ❌ | ❌ | ❌ | ✅ |

### **Managing Team Members & Role Assignments**
1. Navigate to the **Team Access** tab in the dashboard.
2. **Add Team Member**:
   - Enter **Full Name**, **Work Email**, **Phone Number**, and a temporary **Password**.
   - Select the target **Role** (`Co-Owner`, `Event Admin`, or `Event Staff`). Note that Co-Owner is only selectable by the Company Owner or Super Admin.
   - For **Event Admin**: Use the multi-select event picker to assign one or multiple events they are authorized to manage.
   - For **Event Staff**: Select their assigned physical gate.
3. **Editing & Updating Users**:
   - Click the **Edit (`✏️`)** button on any team user card to update their name, phone, role, assigned events, or gate assignment.
   - Role escalation rules are strictly validated on the backend.
4. **Deleting Users**:
   - Click the **Delete (`🗑️`)** button.
   - You cannot delete your own logged-in account.
   - Co-Owners cannot delete Owners or other Co-Owners. Event Admins cannot delete other Admins or Owners.

---

## 6. Event Gate Management

1. Go to the **Gates & Posts** tab.
2. Enter a gate name (e.g., `Gate A - Main Entrance`, `VIP Gate`) and click **Add Gate**.
3. Assign staff members to specific gates from the user list. Staff scanners update instantly.

---

## 7. Attendee Management & High-Volume Virtual Roster

The **Attendee Roster** is engineered for high-volume crowds (100s to 1,000s of attendees):
- **Real-Time Search**: Search by attendee name, email, or phone number.
- **Status Filters**: Filter by `All`, `Checked In`, or `Pending`.
- **Batching & Infinite Scroll**: Select page size (25 / 50 / 100 / All) or scroll smoothly with virtualized batch rendering.
- **Inline QR Thumbnails**: Click any QR thumbnail to open a high-resolution modal for printing or re-sending tickets.
- **Bulk CSV Import**: Import large guest lists with automatic BOM stripping, duplicate filtering, and instant batch ticket generation.

---

## 8. QR Code Check-In Scanning

1. Staff members open the **Scanner Page** (`/scan`).
2. The scanner uses the device camera to scan tickets in real-time.
3. **Atomic Single-Scan Validation**:
   - `🟢 VALID TICKET`: Displays attendee details and records check-in timestamp and gate location.
   - `🔴 DUPLICATE SCAN`: Alerts staff immediately if a ticket has already been checked in, showing original check-in time and gate.

---

## 9. Email Ticket Deliveries (Resend vs SMTP)

- **Resend API Integration** (`RESEND_API_KEY`): Recommended for cloud platforms like Render's Free Tier (bypasses blocked outbound SMTP ports 25, 465, and 587).
- **Inline CID Attachments** (`cid:qrcode`): QR ticket images are embedded inline as Content-ID attachments, guaranteeing crisp image rendering across Gmail, Outlook, Yahoo, and mobile mail apps.

---

## 10. AI Story-to-Song-to-Video Studio

The integrated **AI Story Studio** transforms event stories, testimonials, and milestone narratives into full musical songs with synchronized lyrics, realistic motion video clips, and high-definition rendered MP4 videos.

Navigate to **`/#/studio`** (accessible from the top navigation bar or drawer menu for authorized event roles).

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             5-STAGE STUDIO PIPELINE                              │
│                                                                                  │
│ [1. Story Narrative] ➔ [2. AI Song & Lyrics] ➔ [3. Photos & Clips] ➔             │
│                       ➔ [4. Lyric-Sync Storyboard] ➔ [5. Multi-Device Render]    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 10.1 Multilingual Story-to-Song-to-Video Engine
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

### 10.2 Production Modes: Standard Cinematic Mode vs. Ultra Motion Mode
The studio supports two distinct rendering and visual paradigms:

| Feature | Standard Cinematic Mode | Ultra Motion Mode |
| :--- | :--- | :--- |
| **Visual Source** | High-definition **Google Imagen 3** keyframes | Generative video clips (**Google Gemini Omni 1.1 Flash / Veo 2 / Replicate SVD**) |
| **Scene Motion** | Camera pan & zoom (Ken Burns), crossfades, rhythmic cuts | Generative physical motion (e.g. dancing crowds, flowing fabrics, fireworks) |
| **Character Consistency** | **High & Stable**: Faces, attire, and lighting remain sharp and cohesive | **Variable**: Faces and hands can morph or warp between diffusion frames |
| **Cost per 3-Min Video** | **<$1.00** (highly economical, 95%+ margin) | **~$3.50 – $7.50+** (GPU-intensive) |
| **Render Time** | **30 to 90 seconds** on standard CPU | **5 to 15 minutes** (cloud GPU prediction queues) |
| **Commercial Reliability** | **99.9%** (never crashes, no GPU timeouts) | Can timeout on third-party GPU clusters |
| **When to Use** | Commercial event promos, wedding photo montages, high-volume SaaS | Ultra-cinematic, futuristic, or fantasy video clips |

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

### Stage 3: Media Gallery — Pure AI Mode vs. Personal Event Media
Switch to **Tab 3: Photos & Media**:

The studio handles two distinct source media paths:

#### Path A: 100% Pure AI Mode (Zero Uploads)
- **No Uploads Required**: If you do not upload any photos or videos, the system automatically activates **Pure AI Scene Generation Mode**.
- In this mode, Google Gemini AI and Google Imagen 3 generate 16:9 photorealistic visual scenes for every moment based purely on your narrative, Cast Bible, and song lyrics.
- **Next Step**: Click the quick shortcut button **"Proceed to Tab 4 (Sync Storyboard)"** or navigate directly to Tab 4.

#### Path B: Personal Event Montage Mode (User-Uploaded Media)
- **Supported Formats**:
  - **Photos**: `.jpg`, `.jpeg`, `.png`, `.webp` (wedding photography, candid event photos, portraits).
  - **Videos**: `.mp4`, `.mov`, `.webm` (mobile video snippets, stage recordings, drone footage).
- **Asset Management**:
  - Uploaded files are displayed in a responsive gallery with preview thumbnails, filenames, and format badges (`📷 Photo` or `🎬 Video`).
  - Delete individual files with the trash can icon (`🗑️`), or click **"Clear All Media"** to immediately switch back to Pure AI Mode.
  - Assets are stored securely in your active cloud storage backend (Cloudflare R2, Google Cloud Storage, or AWS S3).

---

### Stage 4: Lyric-Synchronized Storyboard & Dual Modes in Action (Level 2 Control)
Switch to **Tab 4: Timeline & Storyboard**:

1. **Triggering Scene Synchronization**:
   - Click **`🎵 Sync Storyboard with Song Lyrics`** (the dark navy button at the top right).
   - *(Note: This is the button referenced in Tab 3's Pure AI helper banner).*
   - **How Scene Calculation Works**:
     - The engine inspects your generated audio track's actual duration (e.g. 30s = ~5 scenes of 6s each; 60s = ~10 scenes; 180s = ~30 scenes).
     - It creates non-overlapping, chronological 5–6s scene cuts matching AI video clip lengths so visual clips never need to freeze or loop.
     - Gemini maps specific sung lyric lines (`lyricSnippet`) to each scene timecode.

2. **Automatic Round-Robin Media Distribution (When Media is Uploaded)**:
   - If you uploaded photos or video clips in Tab 3, the engine automatically distributes them sequentially across all scenes in a round-robin pattern (`mediaItems[index % mediaItems.length]`).
   - For example, if you upload 6 photos for a 10-scene song, scenes 1–6 receive photos 1–6, and scenes 7–10 loop smoothly.

3. **Granular Scene-by-Scene Customization**:
   - **Source Visual Media Dropdown**: If uploaded media exists, each scene card displays a **Source Visual Media** dropdown. You can reassign any specific uploaded photo or video clip to that scene, or select `"AI Frame / Default Media"` to use an AI-generated image instead.
   - **👥 Scene Cast Tagging**: View characters assigned to each scene. Click cast pills (e.g. `✓ Rahul` / `+ Priya`) to toggle characters into or out of any scene.
   - **✏️ Interactive Visual Action / Prompt Editor**: Click **"✏️ Edit Prompt"** to edit the scene's visual action, camera angle, and environment. Use the **`+Name` Quick-Insert** buttons to instantly append that character's detailed physical traits to your prompt. Click **"Save Prompt"** to save changes immediately.
   - **🎨 Regenerate AI Image Frame (Standard Cinematic Mode)**: Click **"🎨 Regen Image"** to render a fresh high-resolution AI image frame using Google Imagen 3.
   - **✨ Image-to-Video Animation on User Photos (Gemini Omni / Veo)**:
     - When an uploaded photo is assigned to a scene, clicking **"✨ Omni Video"** feeds the **user's real photo** directly into Google Gemini Omni 1.1 Flash / Veo!
     - The AI animates the real photo into a fluid 5-second motion video clip, preserving the real people and setting.
   - **✨ Batch Ultra Motion Generation**: Click **"Generate Gemini Omni Video Clips (All Scenes)"** in the top action bar to batch-generate generative video clips across all scenes at once.

---

### Stage 5: Multi-Device Resolution Video Rendering & Subtitle Synchronization
Switch to **Tab 5: Render & Video Player**:

1. **Choose Your Target Display Preset**:
   - 🖥️ **Desktop Full HD (1080p)**: `1920x1080` (16:9 widescreen, 6000 kb/s) — Projectors, TVs, YouTube, and corporate galas.
   - 💻 **Desktop HD (720p)**: `1280x720` (16:9 standard HD, 3500 kb/s) — Quick web previews and bandwidth-friendly exports.
   - 📱 **Mobile Portrait (9:16)**: `1080x1920` (9:16 vertical, 4500 kb/s) — Instagram Reels, TikTok, and YouTube Shorts.
   - 📟 **Tablet Display (4:3)**: `1440x1080` (4:3 ratio, 4500 kb/s) — iPads, POS terminals, and digital welcome kiosks.
   - 🔲 **Social Square (1:1)**: `1080x1080` (1:1 square, 4000 kb/s) — Instagram feeds and LinkedIn carousels.

2. **FFmpeg Multi-Media Rendering Engine**:
   When you click **"Start Video Render"**, the background worker intelligently handles every scene based on its media type:
   - **For Still Images (Standard Cinematic Mode)**:
     - Loops the image for the exact scene duration.
     - Scales and letterboxes/pads the image to the target aspect ratio (`scale=...:force_original_aspect_ratio=decrease,pad=...`).
     - Uses ultrafast stream assembly to stay strictly within low-memory cloud limits (Render free tier / Cloud Run).
   - **For Uploaded Real Video Clips**:
     - Automatically loops or trims the video clip to match the scene's exact duration window.
     - Strips or ducks original noisy microphone audio so only the studio-mixed song and vocals play.
   - **Audio Master & Subtitle Alignment**:
     - Mixes the complete master song audio track.
     - Generates both SubRip (`.srt`) and WebVTT (`.vtt`) time-coded subtitle files.

3. **Playback, Subtitles & Download**:
   - **Embedded Player Closed Captions (CC)**: Subtitles are natively embedded inside the HTML5 video player via compliant WebVTT (`.vtt`). Users can toggle subtitles on/off and configure captions directly using the player's embedded CC menu without external overlay clutter.
   - **Download Options**:
     - Click **`⬇️ Download Video`** to download the finished MP4 video file.
     - Click **`💬 Subtitles (.srt)`** to download the standard SRT subtitle file for video players like VLC, QuickTime, Premiere, and CapCut.
     - Click **`📝 Subtitles (.vtt)`** to download the WebVTT subtitle file for web platforms and YouTube.

---

### 10.3 End-to-End Walkthrough Example (Standard Cinematic Mode)

Here is a practical reference example you can follow step-by-step in the Studio:

#### 1. Tab 1: Story Narrative
- **Project Title**: `Aarav & Maya: The Royal Udaipur Wedding`
- **Language**: English (or Hindi, Spanish, etc.)
- **Target Duration**: 60 Seconds
- **Story Narrative**:
  > *"Maya and Aarav celebrated their destination wedding at the Lake Palace in Udaipur. Surrounded by marble arches and glowing lanterns at sunset, family and lifelong friends gathered from across the world. The festivities featured a joyful Sangeet dance night, an emotional pheras ceremony with flower petal showers, and an unforgettable starlit celebration with sparklers by the palace fountain."*
- Click **"Analyze Story Narrative"**.

#### 2. Tab 2: Song Lyrics & Audio
- **Music Genre**: Acoustic Pop (or Cinematic)
- **Vocal Style**: Duet (or Female / Male)
- Click **"Generate Structured Lyrics"** to inspect verses and chorus.
- Click **"Generate AI Song & Vocals"** to produce the 60-second synchronized musical track.

#### 3. Tab 3: Cast Bible & Director Guidelines
- **Character 1**: `Maya (Bride)` — *South Asian woman in late 20s, radiant smile, crimson red silk lehenga with gold embroidery, jasmine flowers in hair.*
- **Character 2**: `Aarav (Groom)` — *South Asian man in late 20s, cream ivory sherwani with mandarin collar.*
- **Director Directives**: *Maintain warm golden-hour lighting; progression from venue arrival -> sunset vows -> joyful dancing -> night sparkler send-off.*

#### 4. Tab 4: Storyboard & Scenes (Activating Standard Cinematic Mode)
- Click **`🎵 Sync Storyboard with Song Lyrics`**.
- The engine creates ~10 sequential 6-second scenes matching the lyrics.
- If in **Pure AI Mode**, click **`🎨 Regen Image`** on scene cards to render high-resolution Google Imagen 3 frames.
- If in **User Media Mode**, select your uploaded photos from the **`Source Visual Media:`** dropdown on each scene card.
- **Staying in Standard Cinematic Mode**: Do not click *"Generate Gemini Omni Video Clips"*. Leaving scenes as high-resolution photo frames activates Standard Cinematic Mode.

#### 5. Tab 5: Render & Video Player
- Select **Desktop Full HD (1080p)** or **Mobile Portrait (9:16)**.
- Click **"Start Video Render"**.
- FFmpeg animates the frames, stitches scenes, mixes the 60s duet song, and embeds WebVTT Closed Captions into the HTML5 video player.

---

## 11. Multi-Cloud Storage & Render Free Tier Deployment

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

## 12. Google Cloud Run & Cloud Storage Production Setup

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

## 13. How to Switch API Between Cloud Run and Render

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

## 14. Back Office Settings & Environment Variables (`/#/settings`)

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



