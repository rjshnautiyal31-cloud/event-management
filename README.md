# Event Management and QR Check-in System

A full-stack, enterprise-grade monorepo for event registration, unique QR ticket generation, physical gate management, and on-site QR validation with duplicate-scan prevention.

## Modern Features Added (July 2026) 🚀

- **Resend Email API Integration**: Standard HTTPS integration allowing direct email ticket deliveries on Render's Free Tier (completely bypassing blocked SMTP ports 25, 465, and 587).
- **Event Gates Management**: Create, delete, and monitor physical gates (e.g. *Gate A, VIP Gate, Main Entrance*) per event.
- **Dynamic Staff-Gate Assignment**: Assign scanner staff to specific gates from the dashboard with instant inline reassignments.
- **Automatic Scanner Gate Locking**: Staff scanners are automatically locked to their assigned gate upon login to eliminate gate-typing mistakes.
- **Decoupled Check-in Logs**: Entry logs denormalize name and email at check-in so that history is preserved even if an attendee is later deleted.
- **Fully Responsive Mobile Table Grid**: Progressive disclosure table hiding secondary columns on small screens, preventing horizontal overflow on smartphones.
- **Attendees Edit & Delete**: Modals to edit attendee details with background-triggered email ticket updates, plus secure cascading deletions.
- **Centralized Session Expiration Redirect**: Expired JWT tokens automatically trigger local logouts and gracefully redirect to `/login` inline.
- **Inline Contextual Error Reporting**: Success/error alerts are placed directly within each form component (in-frame) instead of at the bottom of the page.

## Monorepo Layout

- `apps/api`: Node.js Express backend, Mongoose/MongoDB, token signers, CSV parser, and check-in validators.
- `apps/web`: React + Vite + Tailwind CSS frontend, html5-qrcode scanner integration, responsive dashboard, and public registration.

---

## Database Schema (MongoDB Collections)

### `users`
- `_id`
- `name` (string)
- `email` (unique)
- `passwordHash` (bcrypt)
- `role` (`admin` | `staff`)
- `assignedGateId` -> Reference to `gates._id` (null if none)
- timestamps

### `events`
- `_id`
- `title`
- `date`
- `location`
- `description`
- `publicSlug` (unique)
- `createdBy` -> `users._id`
- timestamps

### `gates`
- `_id`
- `eventId` -> `events._id`
- `name` (string)
- `description` (string)
- timestamps
- index: `(eventId, name)` unique

### `attendees`
- `_id`
- `eventId` -> `events._id`
- `name`
- `email`
- `phoneNumber`
- `ticketUuid` (unique UUID encoded in QR)
- `qrCodeDataUrl` (base64 PNG)
- `isCheckedIn` (default `false`)
- `checkedInAt` (nullable)
- `checkedInGate` (string)
- timestamps
- index: `(eventId, email)` unique

### `entrylogs`
- `_id`
- `attendeeId` -> `attendees._id` (nullable)
- `eventId` -> `events._id`
- `timestamp`
- `gateNumber` (string)
- `attendeeName` (string - denormalized for persistence)
- `attendeeEmail` (string - denormalized for persistence)
- timestamps

---

## API Endpoints

### Auth & User Accounts
- `POST /api/auth/setup-admin`
  - Bootstraps the first admin (`setupKey`, `name`, `email`, `password`)
- `POST /api/auth/login`
  - Validates credentials and returns JWT + user profile + populated gate assignments
- `GET /api/auth/staff` (admin)
  - Lists all system users (both admin and staff) with populated gate assignments
- `POST /api/auth/staff` (admin)
  - Creates a new user with chosen role (`admin` | `staff`) and optional `assignedGateId`
- `PUT /api/auth/staff/:userId` (admin)
  - Updates name, email, role, or gate assignment dynamically for an existing user

### Admin Events, Attendees, & Gates
- `POST /api/events` (admin): Create a new event
- `GET /api/events` (auth): List all events
- `GET /api/events/:eventId/stats` (auth): Registration/check-in summary, stats, and recent check-in logs
- `GET /api/events/:eventId/attendees` (auth): List attendees
- `POST /api/events/:eventId/attendees` (admin): Create single walkthrough attendee
- `PUT /api/events/:eventId/attendees/:attendeeId` (admin): Edit name, email, phone. Auto-sends updated ticket if details change
- `DELETE /api/events/:eventId/attendees/:attendeeId` (admin): Deletes attendee record safely
- `POST /api/events/:eventId/attendees/bulk` (admin): Robust CSV/Excel import with auto-BOM stripping and case normalization
- `GET /api/events/:eventId/gates` (auth): List all gates for an event
- `POST /api/events/:eventId/gates` (admin): Create a physical gate
- `DELETE /api/events/:eventId/gates/:gateId` (admin): Delete a gate and clear its assignment from staff

### Public Registration
- `GET /api/public/events/:slug`: Event details for the public signup form
- `POST /api/public/events/:slug/register`: Creates attendee and returns live QR ticket

### Scanner Validation
- `POST /api/scan/validate` (auth): Validates scanned UUID. Implements atomic single-scan validation

---

## Environment Variables

Create these files in your local setup:

### `apps/api/.env`
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/event_qr_system
JWT_SECRET=your_jwt_secret_key
ADMIN_SETUP_KEY=setup-admin

# EITHER: Set Resend API Key (Recommended for Render Free Tier)
RESEND_API_KEY=re_your_copied_api_key
SENDER_EMAIL=onboarding@resend.dev # Or verified custom domain

# OR: Set standard SMTP variables (Requires Render Paid Tier)
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

1. Install dependencies at root:
   ```bash
   npm install
   ```
2. Start Dev Database, API, and Frontend concurrently:
   ```bash
   # Run API and Web locally
   npm run dev:api  # Starts backend on 4000
   npm run dev:web  # Starts frontend on 5173
   ```

## Production Docker Deployment
Compile and run with health-checked orchestration:
```bash
docker compose up --build -d
```

---

## Docs & User Guide

For detailed guidelines, CSV importing tips, SMTP setup, and step-by-step feature execution, please check out our dedicated **[USER_GUIDE.md](./USER_GUIDE.md)**!
