# Event Management and QR Check-in System

A full-stack monorepo for event registration, unique QR ticket generation, and on-site QR validation with duplicate-scan prevention.

## Stack

- Frontend: React + Vite + Tailwind CSS + `html5-qrcode`
- Backend: Node.js + Express + MongoDB (Mongoose)
- Utilities: `qrcode`, `nodemailer`, CSV/Excel bulk parsing (`csv-parse`, `xlsx`)
- Auth: JWT (`Authorization: Bearer <token>`)

## Project Layout

- `apps/api`: Express API, auth, event and attendee management, scan validation
- `apps/web`: Admin dashboard, public registration page, protected scanner page

## Database Schema (MongoDB Collections)

### `users`
- `_id`
- `name` (string)
- `email` (unique)
- `passwordHash`
- `role` (`admin` | `staff`)
- timestamps

### `events`
- `_id`
- `title`
- `date`
- `location`
- `description`
- `publicSlug` (unique; used for public registration URL)
- `createdBy` -> `users._id`
- timestamps

### `attendees`
- `_id`
- `eventId` -> `events._id`
- `name`
- `email`
- `phoneNumber`
- `ticketUuid` (unique UUID, encoded in QR)
- `qrCodeDataUrl`
- `isCheckedIn` (default `false`)
- `checkedInAt` (nullable)
- timestamps
- index: `(eventId, email)` unique

### `entrylogs`
- `_id`
- `attendeeId` -> `attendees._id` (unique to prevent duplicate logs)
- `eventId` -> `events._id`
- `timestamp`
- `gateNumber` (optional)
- timestamps

## API Endpoints

### Auth
- `POST /api/auth/setup-admin`
  - Initializes first admin (`setupKey`, `name`, `email`, `password`)
- `POST /api/auth/login`
  - Returns JWT and user payload
- `GET /api/auth/staff` (admin)
  - Lists staff users
- `POST /api/auth/staff` (admin)
  - Creates a staff account (`name`, `email`, `password`)

### Admin Events
- `POST /api/events` (admin)
  - Create event
- `GET /api/events` (auth)
  - List events
- `GET /api/events/:eventId/stats` (auth)
  - Registration/check-in summary + recent logs
- `GET /api/events/:eventId/attendees` (auth)
  - Attendee list
- `POST /api/events/:eventId/attendees` (admin)
  - Add single attendee
- `POST /api/events/:eventId/attendees/bulk` (admin)
  - Bulk upload attendees via `.csv`, `.xlsx`, `.xls`
  - multipart field name: `file`

### Public Registration
- `GET /api/public/events/:slug`
  - Event details for public form
- `POST /api/public/events/:slug/register`
  - Creates attendee + QR ticket

### Scanner Validation
- `POST /api/scan/validate` (admin/staff)
  - Body: `{ ticketUuid, gateNumber? }`
  - `ticketUuid` can be a raw UUID or a URL containing UUID in `ticketUuid` query param/path tail.
  - Returns one of:
    - `invalid` -> "Invalid Ticket"
    - `already_checked_in` -> includes prior timestamp
    - `granted` -> marks attendee checked-in and logs entry

## Race-Condition Prevention

Check-in uses an atomic conditional write:

1. `findOneAndUpdate({ ticketUuid, isCheckedIn: false }, { isCheckedIn: true, checkedInAt: now })`
2. If update succeeds -> access granted + write `entrylogs` row
3. If update fails:
   - attendee missing -> invalid
   - attendee exists and checked in -> already checked in

This prevents two simultaneous scans from both being accepted.

## Environment Variables

Create these files:

- `apps/api/.env`
- `apps/web/.env`

See examples in:

- `apps/api/.env.example`
- `apps/web/.env.example`

## Quick Start

```bash
cd /var/www/html/ai-projects
npm install
```

Run API:

```bash
cd /var/www/html/ai-projects
npm run dev:api
```

Run Web:

```bash
cd /var/www/html/ai-projects
npm run dev:web
```

## Docker Workflow

The repo includes containerized services for MongoDB, API, and static-served Web:

- `mongo` (`mongo:7`) with persistent volume `mongo_data`
- `api` built from `apps/api/Dockerfile`
- `web` built from `apps/web/Dockerfile` and served by Nginx

All three services are wired with health checks in `docker-compose.yml`.

Start everything:

```bash
cd /var/www/html/ai-projects
docker compose up --build -d
```

Check status/health:

```bash
cd /var/www/html/ai-projects
docker compose ps
docker compose logs -f api
```

Stop services:

```bash
cd /var/www/html/ai-projects
docker compose down
```

Stop and remove Mongo data volume:

```bash
cd /var/www/html/ai-projects
docker compose down -v
```

Default URLs when running with Docker Compose:

- Web: `http://localhost:8080`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`
- MongoDB: `mongodb://localhost:27017`

Notes:

- `web` is built with `VITE_API_BASE=http://localhost:4000` in compose.
- `api` uses `MONGO_URI=mongodb://mongo:27017/event_qr_system` in compose.
- Override secrets (like `JWT_SECRET`) in `docker-compose.yml` or via environment substitution before production use.

## Notes

- Email sending is optional in local development; when SMTP is not configured, the API skips sending and continues registration.
- Scanner route in web UI is protected behind login (`/scan`).
- Dashboard now includes admin-only sections for staff creation and walk-in attendee registration.

