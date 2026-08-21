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
