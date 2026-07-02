# Event QR Check-In System: Comprehensive User Guide

Welcome to the **Event QR Check-In System**! This application is designed to help you create events, register attendees (either via a public form, walk-in additions, or bulk CSV import), distribute unique QR tickets, and check-in attendees at different gates with double-scan prevention and zero-lag mobile performance.

---

## Table of Contents
1. [First-Time Admin Setup](#1-first-time-admin-setup)
2. [Event Creation & Public Forms](#2-event-creation--public-forms)
3. [User & Staff Management](#3-user--staff-management)
4. [Event Gate Management](#4-event-gate-management)
5. [Attendee Management & Bulk Importing](#5-attendee-management--bulk-importing)
6. [QR Code Check-In Scanning](#6-qr-code-check-in-scanning)
7. [Email Ticket Deliveries (Resend vs SMTP)](#7-email-ticket-deliveries-resend-vs-smtp)
8. [Responsive Viewports & Troubleshooting](#8-responsive-viewports--troubleshooting)

---

## 1. First-Time Admin Setup

When you deploy the application for the first time, you must bootstrap your very first **Administrator** account:

1. **Bootstrap Endpoint**: If you are in development, you can send a `POST` request to `/api/auth/setup-admin` with the body:
   ```json
   {
     "setupKey": "setup-admin", // Configured via ADMIN_SETUP_KEY env var
     "name": "Super Admin",
     "email": "admin@yourdomain.com",
     "password": "your_secure_password"
   }
   ```
2. **Local/Render Config**:
   Ensure `ADMIN_SETUP_KEY` is set inside your backend's environment variables before booting.
3. Once bootstrapped, go to your deployed link (e.g., `https://event-qr-web.onrender.com/login`) and log in using your newly created admin credentials.

---

## 2. Event Creation & Public Forms

Once logged in as an Admin, your primary workspace is the **Event Admin Dashboard**.

### **Creating an Event**
1. Locate the **Create Event** form at the top of the dashboard.
2. Enter the **Title**, **Date/Time**, **Location**, and **Description**.
3. Click **Create Event**.
4. The event will appear instantly inside your **Events List** card on the left side of the screen.

### **Obtaining the Public Registration Link**
1. Click on your newly created event in the **Events List**.
2. Directly below the list, a link label will display:
   `Public form: /register/your-event-slug-abc123`
3. Append this path to your frontend domain to share it with your attendees:
   `https://event-qr-web.onrender.com/register/your-event-slug-abc123`
4. When users visit this link, they can enter their Name, Email, and Phone to register. Upon submission, **their unique QR ticket will instantly render on their screen** (with options to download or print), and a copy will be emailed to them!

---

## 3. User & Staff Management

The Admin Dashboard provides complete control over who can scan tickets and manage data. There are two primary system roles:
* **Admin (Full Access)**: Can create events, create user accounts, manage gates, add/edit/delete attendees, bulk import records, and view metrics.
* **Staff (Scanner Only)**: Can only access the **Scanner Page** (`/scan`) to validate attendee tickets. They are locked out of admin dashboard features.

### **Creating and Assigning Users**
1. Locate the **Create System User Account** card in your dashboard.
2. Enter their **Full name**, **Email address**, and **Password**.
3. Under the **Role** dropdown, select:
   * **Role: Staff** — if they are entry-gate scanning agents.
   * **Role: Admin** — if they are co-managers.
4. If you select **Role: Staff**, an additional dropdown will appear allowing you to assign them to a specific **Gate** (e.g., *Gate 1*, *Main Gate*).
5. Click **Create User**.

### **Inline Gate Reassignment**
You don't need to recreate or edit a staff profile to reassign them to a different entrance gate. 
* In the **System User Accounts** list, locate the staff member's card.
* Under their name, select a new gate from the **Assign Gate** dropdown.
* The system instantly updates their profile on-the-fly and locks their scanner page to the newly assigned gate!

---

## 4. Event Gate Management

If your event has multiple entry points, you can manage them seamlessly through the **Event Gates Management** panel.

1. **Gate Creation**:
   - Select an event from the list.
   - Locate the **Event Gates Management** card on the left panel (directly below the Events list).
   - Enter a name (e.g., `VIP Gate`, `Gate B`, `North Entrance`) and click **Add Gate**.
   - The gate is now registered in your system.
2. **Staff Linking**:
   - Go to your Staff Users list and assign any scanner agent to your newly created gate.
3. **Scanner Locking**:
   - When that staff member logs into `https://event-qr-web.onrender.com/scan`, the app detects their assigned gate and **automatically locks and pre-fills** their scanner's Gate Number input! They can begin scanning immediately with zero setup required.

---

## 5. Attendee Management & Bulk Importing

The **Attendees** table grid is your operational control center.

### **Grid Columns (Adaptive Viewports)**
The attendees grid is fully responsive and adjusts dynamically to prevent overlapping:
- **Mobile (Portrait)**: Displays **Name, Status, Actions** (Optimized for small phone screens).
- **Mobile (Landscape)**: Displays **Name, Email, Status, Actions**.
- **Tablet**: Displays **Name, Email, Phone, Status, Gate, Actions**.
- **Desktop**: Displays all fields, including **Checked-In At (date/time)** and **Gate Name**.

### **Actions Available:**
* **View QR**: Opens a modern modal with the attendee's ticket. You can click **Download QR** to save the ticket as a high-quality `.png` image to send directly to them via WhatsApp, Slack, etc.
* **Edit**: Opens an inline modal to update their Name, Email, or Phone. If you edit their Name or Email, the system **automatically sends them an updated ticket email** in the background!
* **Delete**: Removes their record from the event database securely.

### **Manual Walk-In Addition**
To register someone manually (e.g. at the door):
1. In the **Registration Stats** card, locate the manual add form at the bottom.
2. Enter their name, email, and phone, and click **Add**.
3. They will instantly appear in your attendee list, and their ticket will be emailed to them in the background!

### **Bulk Importing from CSV / Excel**
To import thousands of attendees in seconds:
1. Click the **📥 Download Sample CSV** button on the Bulk Upload card to download the exact required template.
2. **Column Names Expected**:
   * `Name` (or `fullname`): The attendee's full name.
   * `Email`: Their email address (used to send the ticket).
   * `Phone Number` (or `phone`): Their phone number (optional).
3. Save your file as a `.csv` or `.xlsx` format.
4. Choose the file in the **Bulk Upload** selector.
5. The system automatically handles **BOM signatures** (invisible Excel artifacts), trims spaces, normalizes casing, and begins importing.
6. A detailed **Import Report Summary** will display showing:
   - Total rows found.
   - Successfully created accounts.
   - A scrollable **Row Failures** list detailing the exact email address and reason (e.g. `Duplicate email`) of skipped records, so you never have to guess.

---

## 6. QR Code Check-In Scanning

Scanners use the **Scanner Page** (`/scan`) to validate entries.

### **Executing Scans**
1. Access `/scan` on your smartphone, tablet, or laptop.
2. Ensure you have entered your designated **Gate Number** (this is pre-filled if assigned by an admin).
3. Grant camera permissions when prompted.
4. Point the camera at the attendee's digital (on-phone) or printed QR code.
5. The scan evaluates instantly and displays **above-the-fold color-coded feedback**:
   * 🟢 **ACCESS GRANTED** (Success): Attendee is successfully checked in! Shows name and timestamp.
   * 🟡 **ALREADY CHECKED IN** (Warning): This ticket has already been validated. Displays the original check-in time and gate.
   * 🔴 **INVALID TICKET** (Error): Ticket UUID is fake or doesn't belong to this event.

### **Atomic Check-In Lock (Security)**
The check-in execution utilizes an atomic write lock on MongoDB. If two entry doors scan the exact same ticket at the exact same split-second, only the first transaction is authorized, while the second will immediately display **"Already Checked In"**, fully preventing multi-entry fraud.

---

## 7. Email Ticket Deliveries (Resend vs SMTP)

To ensure attendees receive their tickets, you must configure an email driver.

### **Option A: Resend API (HTTP over Port 443 - Highly Recommended & Free)**
**Render blocks standard SMTP ports (25, 465, 587) on their Free Tier.** To send emails on Render Free Tier for free, you must use Resend's HTTP API over standard port `443` (which is never blocked).
1. Go to [Resend.com](https://resend.com) and sign up for a free account.
2. Under **API Keys**, create a new key with full permissions and copy it (starts with `re_`).
3. Add these variables to your Backend Web Service on Render:
   - `RESEND_API_KEY` = `re_your_api_key_here`
   - `SENDER_EMAIL` = `onboarding@resend.dev` *(or your verified custom domain email)*
4. **Note**: If you use `onboarding@resend.dev`, Resend restricts deliveries strictly to your own sign-up email address for safety. To send to *any* attendee email, verify your own domain in Resend's **Domains** tab and change `SENDER_EMAIL` to `tickets@yourdomain.com`.

### **Option B: Gmail SMTP (Requires Render Paid Tier)**
If you are running on a Paid Render tier (Starter or above) or your own VPS, you can use standard SMTP:
1. Go to your Google Account ➔ **Security**.
2. Turn **2-Step Verification** ON.
3. Search for **"App passwords"**, create one for `Event QR Tickets`, and copy the 16-character code.
4. Add these variables to your Backend Service:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = `your-email@gmail.com`
   - `SMTP_PASS` = `your16characterapppass` *(without spaces)*
   - `SENDER_EMAIL` = `your-email@gmail.com`

---

## 8. Responsive Viewports & Troubleshooting

### **My page displays "Not Found" on deep links**
If deep links like `https://your-app.onrender.com/register/slug` return a static 404, ensure you have set up a **Rewrite rule** on your Render Static Site dashboard:
- **Source**: `/*`
- **Destination**: `/index.html`
- **Action**: `Rewrite` (NOT Redirect).
*(I have added a `_redirects` file to automate this, but double check the Render settings if it persists).*

### **Failed to Fetch errors on the signup page**
Ensure that you have set the `VITE_API_BASE` environment variable in your Frontend Static Site settings on Render, and that you have clicked **"Clear Cache and Deploy"** so that Vite compiles the frontend with your live backend API URL instead of `localhost`.

---

Now you are fully prepared to run a seamless, secure, and modern QR check-in event! Enjoy using the system!
