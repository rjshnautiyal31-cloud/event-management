# Technical Implementation Plan: Short Advertisement & Promo Videos

**Document Version:** 1.0  
**Status:** Planned (Pending Implementation)  
**Scope:** Extend AI Story Studio (`apps/api` & `apps/web`) to create short advertisement and promotional videos (`15s`, `30s`, `45s`, `60s`) with or without songs, including multi-speaker conversations and hybrid conversation + song jingles, supporting **both Event-linked and Standalone (No-Event) Brand Ads**.

---

## 1. Executive Summary & Product Goals

Currently, the AI Studio pipeline is tightly coupled to **Event-bound Story Music Videos** (`Story -> Lyrics -> Full Vocal Song -> Storyboard -> Rendered Video`). Every project requires an `eventId`, a `Song` document with sung verses/choruses, and a single master vocal track.

This plan introduces **Short Advertisement Videos (`ad_promo`)** alongside existing **Story Music Videos (`story_music`)** with 100% backward compatibility:

1. **Dual Workspace Scope (Event-Tied + Standalone Brand Ads)**:
   - **Event-Linked Ads**: Promote a specific event (e.g., ticket launch, registration reminder, speaker teaser, countdown reel) using event context.
   - **Standalone Brand / Product Ads (No Event Required)**: Create company-level product commercials, service promos, or brand announcements without selecting or creating an Event.
2. **Flexible Ad Audio Modes (No Song, Voiceover/Dialogue, or Hybrid Conversation + Song)**:
   - **`dialogue_only` (Conversation / Voiceover Only — No Song)**: Single narrator or 2-person conversational skit + announcer CTA with natural pauses and zero music.
   - **`dialogue_bgm` (Conversation + Ducked Instrumental Bed)**: Spoken conversation or voiceover at 100% foreground clarity over an auto-ducked (`~18%` volume) instrumental background track.
   - **`hybrid_conversation_song` (Mixup of Conversation + Sung Jingle)**: Alternates spoken conversation segments and a high-energy sung AI brand/event jingle (e.g., *0-10s relatable 2-person chat -> 10-22s catchy sung AI jingle chorus -> 22-30s spoken narrator Call-to-Action over ducked outro*).
   - **`visual_only` (Silent / Instrumental Kinetic Ad)**: Zero voiceover; optional instrumental bed or silent AAC stream with punchy on-screen headlines and CTA end-card for muted social feeds and venue displays.
3. **Short Commercial Pacing & Multi-Format Export**:
   - Duration presets: **`15s` (Bumper/Story)**, **`30s` (Standard Commercial)**, **`45s` (Promo Reel)**, and **`60s` (Brand Story)**.
   - Fast commercial cuts (`3s-5s` per scene) exported in `mobile` (`9:16` Reels/Shorts/TikTok), `square` (`1:1` Feed), `1080p`/`720p` (`16:9` YouTube/Displays), and `tablet` (`4:3`).

---

## 2. Current Architecture Gaps vs. Reusable Building Blocks

### 2.1 Current Gaps to Address
- **Mandatory `eventId` & Indirect Tenant Lookup**: `apps/api/src/models/Project.js` enforces `eventId: { required: true }` and `apps/api/src/routes/storyVideo.routes.js` (`requireProjectAccess`) resolves `companyId` only through `Event.findById(project.eventId)`.
- **Song-Required Storyboard**: `apps/api/src/models/Storyboard.js` sets `songId: { required: true }`, blocking `visual_only` or script-first ad storyboards.
- **Music-Only Gemini Prompts**: `apps/api/src/services/providers/gemini.provider.js` only implements `analyzeStoryWithGemini`, `generateLyricsWithGemini`, and `generateStoryboardFromLyrics`.
- **Automatic Melody Injection on Render**: `apps/api/src/workers/index.js` (`processVideoRenderJob`) synthesizes a fallback musical melody (`createMusicalMelodyWavBuffer`) whenever `songDoc.audioUrl` is absent, which would add unwanted music to a `dialogue_only` or silent `visual_only` ad.

### 2.2 Existing Modules We Reuse Directly
- **Multilingual Multi-Voice TTS (`en`, `hi`, `hinglish`)**: `apps/api/src/config/languages.js` and `apps/api/src/services/music/index.js` already integrate Google Cloud Neural2 TTS and ElevenLabs Speech TTS with distinct Female and Male voices.
- **Instrumental & Vocal AI Music**: `apps/api/src/services/music/index.js` already supports Google Lyria 3 Pro and ElevenLabs Music (including `force_instrumental` for pure background beds and vocal synthesis for sung jingle hooks).
- **Character Cast Visual Consistency**: `project.characters` already anchors character faces and outfits across generated scene frames and Omni motion clips.
- **Storage & FFmpeg Pipeline**: `buildStoryStorageKey` in `apps/api/src/services/storage/index.js` keys assets by `{projectId, title}` (already independent of `eventId`), and `fluent-ffmpeg` handles multi-preset video rendering and `.srt`/`.vtt` subtitles.

---

## 3. Phase-Wise Implementation Plan

### Phase 1: Database Schema & Multi-Tenant Standalone Support (`apps/api/src/models/`)

#### 1.1 `apps/api/src/models/Project.js`
- **Support Both Event-Linked and Standalone Projects**:
  - Change `eventId` from `required: true` to `{ type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null, index: true }`.
  - Add `companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true }` so standalone company ads maintain strict multi-tenant isolation without needing an `Event` document.
- **Add Project Mode & Ad Brief Configuration**:
  - `projectType`: `{ type: String, enum: ["story_music", "ad_promo"], default: "story_music", index: true }`.
  - `adBrief`:
    ```javascript
    adBrief: {
      brandName: { type: String, default: "" },
      productOrOffer: { type: String, default: "" },
      objective: { type: String, default: "" },       // e.g. Awareness, Registrations, Flash Sale, Launch
      targetAudience: { type: String, default: "" },
      callToAction: { type: String, default: "" },    // e.g. "Register Today at...", "Visit Booth #4"
      ctaSubtext: { type: String, default: "" },      // URL, promo code, date, or venue tag
      burnInCtaOverlay: { type: Boolean, default: true },
      targetDurationSeconds: { type: Number, enum: [15, 30, 45, 60], default: 30 },
      audioMode: {
        type: String,
        enum: ["dialogue_only", "dialogue_bgm", "hybrid_conversation_song", "visual_only"],
        default: "hybrid_conversation_song"
      },
      speakerFormat: {
        type: String,
        enum: ["single_narrator", "two_speaker_chat", "multi_cast"],
        default: "two_speaker_chat"
      },
      bgmStyle: { type: String, default: "Upbeat Commercial" }
    }
    ```
- **Voice Binding on Cast Members (`characters[]`)**:
  - Add `voiceGender: { type: String, enum: ["female", "male", "neutral"], default: "female" }` and `voiceRole: { type: String, enum: ["speaker_a", "speaker_b", "narrator"], default: "speaker_a" }` so conversational lines spoken by a cast member use a consistent voice.

#### 1.2 `apps/api/src/models/Song.js` (Unified Audio & Script Track Document)
Keeping `activeSongId` as the unified audio/script reference preserves all existing `.populate()` calls across routes and workers:
- Add `trackMode`: `{ type: String, enum: ["song", "dialogue_only", "dialogue_bgm", "hybrid_conversation_song", "visual_only"], default: "song" }`.
- Relax `lyrics`, `genre`, and `mood` with safe defaults (`""`, `"Commercial"`, `"Engaging"`) when `trackMode !== "song"`.
- Add `scriptSegments[]` for structured multi-speaker and hybrid jingle timelines:
  ```javascript
  scriptSegments: [
    {
      segmentOrder: { type: Number, required: true },
      segmentType: {
        type: String,
        enum: ["dialogue", "narration", "sung_jingle", "visual_beat"],
        default: "dialogue"
      },
      speakerName: { type: String, default: "Narrator" },
      voiceRole: { type: String, enum: ["speaker_a", "speaker_b", "narrator", "jingle_vocal"], default: "narrator" },
      voiceGender: { type: String, enum: ["female", "male"], default: "female" },
      text: { type: String, required: true },
      targetDurationSeconds: { type: Number, default: 4 },
      startTimeSeconds: { type: Number, default: 0 },
      endTimeSeconds: { type: Number, default: 4 },
      bgmBehavior: { type: String, enum: ["none", "ducked", "full"], default: "ducked" },
      segmentAudioUrl: { type: String, default: "" }
    }
  ]
  ```

#### 1.3 `apps/api/src/models/Storyboard.js`
- Change `songId` to `required: false, default: null` so `visual_only` ads or pre-audio drafts can create and edit storyboards cleanly.
- Add per-scene commercial metadata on `scenes[]`:
  - `segmentType`: `"song" | "dialogue" | "narration" | "sung_jingle" | "cta_endcard"`
  - `speakerName`: `{ type: String, default: "" }`
  - `onScreenHeadline`: `{ type: String, default: "" }` (bold ad copy / CTA text distinct from spoken subtitle)

---

### Phase 2: Gemini AI Commercial Strategist, Scriptwriter & Ad Director (`apps/api/src/services/providers/gemini.provider.js`)

Add three dedicated AI generation methods alongside the existing story functions:

1. **`analyzeAdBriefWithGemini(briefText, adBrief, eventContext, language)`**:
   - Works with or without `eventContext` (uses Event title/date/location if tied to an Event, or `adBrief.brandName` + `productOrOffer` if standalone).
   - Produces structured commercial strategy stored in `StoryAnalysis`:
     - Attention Hook (first 3 seconds)
     - Relatable Pain Point / Desire
     - Core Value Proposition
     - Recommended Visual Aesthetic & Pacing
     - Catchy Jingle Hook Concept (when `hybrid_conversation_song` is active)
     - Punchy Call-to-Action Line
2. **`generateAdScriptWithGemini(project, analysis, options)`**:
   - Generates timed JSON `scriptSegments[]` strictly budgeted to `15s`, `30s`, `45s`, or `60s` (~2.2–2.5 spoken words/second in English, Hindi, or Hinglish):
     - **`dialogue_only` / `dialogue_bgm`**: Natural conversational banter (`Speaker A` <-> `Speaker B`) or crisp narrator copy + closing `[narration]` CTA.
     - **`hybrid_conversation_song`**: Alternates `[dialogue]` hook -> catchy rhythmic `[sung_jingle]` chorus (8–15s) -> `[narration]` closing CTA.
     - **`visual_only`**: Generates `[visual_beat]` kinetic headline cards + scene visual prompts with `0` spoken lines.
3. **`generateAdStoryboard(project, scriptSegments, mediaItems, options)`**:
   - Maps each `scriptSegment` chronologically to commercial camera cuts (`3s-5s` per shot):
     - Dialogue lines map to speaker / two-shot frames anchored to `project.characters`.
     - Product / venue / highlight uploads from `mediaItems` are prioritized for reveal shots.
     - Jingle segments map to upbeat montage cuts.
     - Final segment maps to a dedicated `cta_endcard` hero scene with `onScreenHeadline` populated from `adBrief.callToAction`.

---

### Phase 3: Multi-Speaker & Hybrid Jingle Audio Composer (`apps/api/src/services/music/`)

Create `apps/api/src/services/music/adAudioComposer.js` and expand voice presets in `apps/api/src/config/languages.js`:

1. **Three Distinct Voices per Language (`en`, `hi`, `hinglish`)**:
   - Expand `languages.js` voice table so `speaker_a` (Female), `speaker_b` (Male), and `narrator` (Announcer) use distinct Google Cloud Neural2 and ElevenLabs voices—preventing two characters in a dialogue from sounding identical.
2. **Per-Segment Synthesis & Exact `ffprobe` Timing**:
   - Synthesize each `dialogue` and `narration` block individually via Cloud TTS / ElevenLabs Speech TTS and measure its exact duration with `ffprobe`.
   - Synthesize `sung_jingle` blocks via **Google Lyria 3 Pro** or **ElevenLabs Music** (vocal jingle prompt).
   - When `dialogue_bgm` or `hybrid_conversation_song` needs an underscore, synthesize or trim a matching **instrumental** bed (`force_instrumental: true` or Lyria instrumental prompt).
3. **FFmpeg Timeline Mastering**:
   - **`dialogue_only`**: Concatenate spoken clips with natural `250ms` room-tone breath gaps (`anullsrc`), zero background music.
   - **`dialogue_bgm`**: Mix concatenated dialogue at `100%` gain with instrumental bed ducked to `18%` gain (`0.18`), `0.5s` intro lead-in, and `1.0s` smooth fade-out.
   - **`hybrid_conversation_song`**: Stitch `[Spoken Dialogue Intro (clean or ducked bed)]` -> `300ms crossfade` -> `[Full-Volume Sung Jingle Hook]` -> `ducked transition` -> `[Spoken Narrator CTA Outro]` into a single mastered `.mp3`, updating exact `startTimeSeconds` and `endTimeSeconds` on every `scriptSegment` (and synced Storyboard scenes).
   - **`visual_only`**: Generate either an instrumental-only BGM track (if BGM enabled) or mark track as silent so the video worker attaches clean silent AAC audio.

---

### Phase 4: API Access Control, Routes & Video Render Worker (`apps/api/src/routes/` & `workers/`)

#### 4.1 Standalone + Event Access Control (`apps/api/src/routes/storyVideo.routes.js`)
- **`GET /api/story-video/projects`**:
  - Support query modes:
    - `?eventId=<objectId>`: Projects tied to that specific event (existing behavior).
    - `?eventId=standalone` (or `?scope=standalone`): Standalone brand/company projects (`{ eventId: null, companyId: req.user.companyId }`) for `super_admin`, `owner`, `co_owner`, and `admin`.
    - `?projectType=ad_promo` (optional filter).
- **`POST /api/story-video/projects`**:
  - If `eventId` is provided: validate access with `requireEventAccess(["event_admin"])`, look up `event.companyId`, and store both `eventId` and `companyId`.
  - If `eventId` is omitted / `null`: verify user has company-level admin role (`super_admin`, `owner`, `co_owner`, `admin`), set `eventId: null` and `companyId: req.user.companyId`, and allow creation using `adBrief` + `storyText` (ad concept/notes).
- **`requireProjectAccess` Middleware**:
  - Branch cleanly: when `project.eventId` is non-null, run existing Event + `EventAssignment` checks; when `project.eventId` is `null`, enforce `project.companyId.toString() === req.user.companyId.toString()` for company admins (and allow `super_admin`).
- **New / Extended Ad Endpoints**:
  - `POST /api/story-video/projects/:id/analyze` — branches on `project.projectType === "ad_promo"` to call `analyzeAdBriefWithGemini`.
  - `POST /api/story-video/projects/:id/ad-script` — generates or regenerates structured `scriptSegments[]` via Gemini.
  - `PATCH /api/story-video/projects/:id/ad-script` — saves user edits to speaker lines, segment types (`dialogue` / `sung_jingle` / `narration`), voice roles, or ordering.
  - `POST /api/story-video/projects/:id/ad-audio` — runs `adAudioComposer` to synthesize and master the final audio timeline and synchronize timestamps.

#### 4.2 Video Render Worker (`apps/api/src/workers/index.js`)
- **Respect Non-Song Audio Modes**:
  - In `processVideoRenderJob`, never invoke `createMusicalMelodyWavBuffer` when `trackMode` is `dialogue_only` or `visual_only`. For silent `visual_only` ads, mux a clean silent AAC stream (`anullsrc`) so exported MP4s play reliably across Instagram, WhatsApp, YouTube Shorts, and browser players.
- **Speaker-Aware Subtitles (`.srt` & `.vtt`)**:
  - Prefix multi-speaker dialogue lines (`Speaker: ...`), wrap sung jingles (`[Jingle] ...`), and omit empty captions during `visual_only` beats.
- **Optional Burned-In CTA Banner**:
  - When `adBrief.burnInCtaOverlay` is enabled on an `ad_promo` project, render a clean lower-third / end-card headline banner (`onScreenHeadline` / `callToAction` + `ctaSubtext`) on the final CTA scene during FFmpeg composition.

---

### Phase 5: Dedicated AI Ad Studio Page (`apps/web/src/pages/AdStudioPage.jsx` at `/#/ads`)

Designed strictly with the `#34206F` deep indigo + `#EDE8FA` lavender SaaS design system while keeping **`/#/studio` (`ProjectStudioPage.jsx` — AI Story Studio)** **100% identical to the original Story-to-Music Video page**:

1. **Separated Routes & Navigation (`App.jsx` & `Navbar.jsx`)**:
   - **`/#/studio` (`AI Story Studio`)**: Unchanged Story-to-Music Video experience; queries `?eventId=<id>&projectType=story_music` (`{ projectType: { $ne: "ad_promo" } }`) so legacy and new Story projects appear cleanly without ad clutter.
   - **`/#/ads` (`AI Ad Studio`)**: Dedicated sidebar link & page exclusively for **15s, 30s, 45s, and 60s Short Advertisement Videos (`ad_promo`)**.
2. **Two-Pill Ad Scope Segmented Control (Event Promo Ads vs. Standalone Brand Ads)**:
   - Prominent top segmented buttons let company admins switch in 1 click between **Event Promo Ads** (with Event selector + `Cmd+K` switcher) and **Standalone Brand & Product Ads** (`scope=standalone&projectType=ad_promo`, no event required).
3. **Dedicated Create Short Advertisement Modal & 5-Step Commercial Pipeline**:
   - Dedicated **Create Short Advertisement Video** modal with Scope pills, Ad Duration (`15s`, `30s`, `45s`, `60s`), Audio Mode (`hybrid_conversation_song`, `dialogue_bgm`, `dialogue_only`, `visual_only`), Speaker Style (`two_speaker_chat`, `single_narrator`), Brand/Offer/CTA fields, Speakers & Cast (`voiceGender`), and Director Guidelines.
   - **5-Step Ad Pipeline**:
     1. **1. Ad Brief & Cast** (edit brief, CTA, speaker voice gender/slot, and Gemini Commercial Strategy blueprint cards)
     2. **2. Script, Voices & Jingle** (interactive block editor to add/edit/reorder **Spoken Dialogue**, **Narrator CTA**, **Sung Jingle**, and **Visual Beat** blocks, choose speaker voices, toggle BGM style, and preview the stitched master audio)
     3. **3. Product & Brand Media** (upload product photos, brand visuals, or promo clips, or use Pure AI Commercial Visuals)
     4. **4. Ad Storyboard** (cut cards showing exact segment timings, speaker tags, `onScreenHeadline` editor, AI frame generation, and Omni motion clips)
     5. **5. Render Ad** (defaults to `9:16 Mobile Reels`, Burn-In CTA banner toggle, accurate audio mode summary, and MP4 + `.srt`/`.vtt` preview/downloads)

---

## 4. Verification & Backward-Compatibility Checklist

- [ ] Existing Event-linked `story_music` projects load, analyze, generate lyrics/songs, storyboard, and render identically with zero schema migration breakage.
- [ ] Standalone `ad_promo` projects (`eventId: null`) can be created, listed, edited, and rendered by company admins (`owner`, `co_owner`, `admin`, `super_admin`) with strict `companyId` tenant isolation.
- [ ] Event-linked `ad_promo` projects (`eventId: <id>`) inherit event context and respect `event_admin` assignment permissions.
- [ ] All 4 ad audio modes (`dialogue_only`, `dialogue_bgm`, `hybrid_conversation_song`, `visual_only`) produce frame-accurate scene timings and never inject unintended fallback melodies when "No Song" is selected.
- [ ] Update `README.md` and `USER_GUIDE.md` once implementation is finalized.
