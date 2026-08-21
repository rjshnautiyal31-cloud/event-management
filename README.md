# Event Management and QR Check-in System

A full-stack, enterprise-grade monorepo for high-volume event registration, unique QR ticket generation, physical gate management, and fast on-site QR validation with duplicate-scan prevention.

---

## Key Features 🚀

- **`#0A2D59` Deep Navy Brand Identity & Universal Top Navigation**:
  - Unified `#0A2D59` branding across all application pages (`LoginPage`, `DashboardPage`, `QRGeneratorPage`, `ScannerPage`).
  - Sticky top header featuring a **Hamburger (`☰`) Slide-Over Drawer Navigation Panel**.

- **High-Volume Event Switcher Command Palette (`⌘K` / `Ctrl+K`)**:
  - Real-time instant search input filtering by **title**, **venue location**, or **date**.
  - Categorized tabs: `⚡ Active & Upcoming`, `🕒 Past Events`, and `⭐ Pinned / Favorites` (pinned events persist in `localStorage`).
  - Batch pagination (10 / 25 / 50 per page) designed for scaling to 1,000+ events.

- **`🗓️ Managed Events Directory` Workspace**:
  - Dedicated full-width table view listing all managed events with real-time text search, status filters (`🟢 Live Today`, `🗓 Upcoming`, `🏁 Ended`), public registration links (`/#/register/:slug`), and 1-tap active event switching.

- **High-Volume Attendee Roster (100s / 1000s of Attendees)**:
  - Real-time text search, status filters (`All`, `Checked In`, `Pending`), batch size selector (25 / 50 / 100 / All), and **Virtual Infinite Scroll / Lazy Loading**.
  - Inline QR Code thumbnail preview & high-resolution expand modal.

- **Inline CID Attachment Ticket Emails (`cid:qrcode`)**:
  - Automatic email tickets sent via Resend API or SMTP using `cid:qrcode` Content-ID inline attachment embedding (eliminating broken images in Gmail, Outlook, and Yahoo).

- **Enhanced Create Event & Date/Time Presets**:
  - Native date & time pickers with 1-tap quick presets (`📅 Today`, `🚀 Tomorrow`, `📆 Next Week`), native `showPicker()` popups, and full manual entry support.

- **Event Gates & Automated Staff Locking**:
  - Create, delete, and monitor physical gates per event (*Gate A, VIP Gate, Main Entrance*).
  - Staff scanner accounts automatically lock to their assigned gate upon login to prevent mis-scans.

- **Decoupled Check-in Logs**:
  - Denormalizes attendee name and email into `entrylogs` at check-in so historical records are preserved even if an attendee profile is subsequently deleted.

---

## Monorepo Layout

- `apps/api`: Node.js Express backend, Mongoose/MongoDB, token signers, CSV parser, Resend/Nodemailer email engine, and check-in validators.
- `apps/web`: React + Vite + Tailwind CSS frontend, HashRouter navigation, html5-qrcode scanner integration, responsive dashboard, and public registration portal.

---

## Database Schema (MongoDB Collections)

### `users`
- `_id`
- `name` (string)
- `email` (unique)
- `passwordHash` (bcrypt)
- `role` (`super_admin` | `event_admin` | `event_staff`)
- `assignedGateId` -> Reference to `gates._id` (null if none)
- timestamps

### `events`
- `_id`
- `title` (string)
- `date` (date/iso string)
- `location` (string)
- `description` (string)
- `publicSlug` (unique string)
- `createdBy` -> Reference to `users._id`
- timestamps

### `gates`
- `_id`
- `eventId` -> Reference to `events._id`
- `name` (string)
- `description` (string)
- timestamps
- index: `(eventId, name)` unique

### `attendees`
- `_id`
- `eventId` -> Reference to `events._id`
- `name` (string)
- `email` (string)
- `phoneNumber` (string)
- `ticketUuid` (unique UUID encoded in QR)
- `qrCodeDataUrl` (base64 PNG)
- `isCheckedIn` (boolean, default `false`)
- `checkedInAt` (nullable date)
- `checkedInGate` (string)
- timestamps
- index: `(eventId, email)` unique

### `entrylogs`
- `_id`
- `attendeeId` -> Reference to `attendees._id` (nullable)
- `eventId` -> Reference to `events._id`
- `timestamp` (date)
- `gateNumber` (string)
- `attendeeName` (string - denormalized for persistence)
- `attendeeEmail` (string - denormalized for persistence)
- timestamps

---

## API Endpoints

### Auth & User Accounts
- `POST /api/auth/setup-admin`: Bootstraps the first super admin (`setupKey`, `name`, `email`, `password`)
- `POST /api/auth/login`: Validates credentials and returns JWT + user profile + gate assignments
- `GET /api/auth/staff` (admin): Lists system users with populated gate assignments
- `POST /api/auth/staff` (admin): Creates a new user with chosen role (`super_admin` | `event_admin` | `event_staff`) and optional `assignedGateId`
- `PUT /api/auth/staff/:userId` (admin): Updates name, email, role, or gate assignment dynamically
- `DELETE /api/auth/staff/:userId` (admin): Removes user account

### Events, Attendees, & Gates
- `POST /api/events` (admin): Create a new event
- `GET /api/events` (auth): List all accessible events
- `GET /api/events/:eventId/stats` (auth): Registration/check-in summary, stats, and recent check-in logs
- `GET /api/events/:eventId/attendees` (auth): List attendees with pagination & search
- `POST /api/events/:eventId/attendees` (admin): Create single walk-in attendee
- `PUT /api/events/:eventId/attendees/:attendeeId` (admin): Edit attendee details & trigger updated email ticket
- `DELETE /api/events/:eventId/attendees/:attendeeId` (admin): Safe deletion of attendee
- `POST /api/events/:eventId/attendees/bulk` (admin): CSV import with BOM stripping & email validation
- `GET /api/events/:eventId/gates` (auth): List gates for an event
- `POST /api/events/:eventId/gates` (admin): Create a physical entrance gate
- `DELETE /api/events/:eventId/gates/:gateId` (admin): Delete gate and unassign staff

### Public Guest Pass Registration
- `GET /api/public/events/:slug`: Event details for public signup
- `POST /api/public/events/:slug/register`: Registers guest, returns ticket UUID & sends email ticket

### Scanner Validation
- `POST /api/scan/validate` (auth): Validates scanned QR ticket UUID with atomic duplicate-scan prevention

---

## Environment Variables

### `apps/api/.env`
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/event_qr_system
JWT_SECRET=your_jwt_secret_key
ADMIN_SETUP_KEY=setup-admin

# Resend API Key (Recommended for Cloud Hosting / Render)
RESEND_API_KEY=re_your_api_key
SENDER_EMAIL=onboarding@resend.dev # Or your verified custom domain

# Standard SMTP Fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

### `apps/web/.env`
```env
VITE_API_BASE=http://localhost:4000
```

---

## Quick Start

1. **Install dependencies at root**:
   ```bash
   npm install
   ```

2. **Start Dev Database, API, and Web App**:
   ```bash
   npm run dev:api  # Starts backend on 4000
   npm run dev:web  # Starts frontend on 5173
   ```

3. **Production Docker Deployment**:
   ```bash
   docker compose up --build -d
   ```

---

## Documentation & Guides

For complete step-by-step instructions, CSV importing formats, and troubleshooting tips, see **[USER_GUIDE.md](./USER_GUIDE.md)**!
