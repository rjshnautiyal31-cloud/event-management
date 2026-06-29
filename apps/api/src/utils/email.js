import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function createTransporter() {
  if (!env.smtpHost || !env.smtpPort || !env.smtpUser || !env.smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false
    }
  });
}

export async function sendTicketEmail({ to, attendeeName, eventTitle, ticketUuid, qrCodeDataUrl }) {
  const base64 = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");

  // Scenario 1: Use Resend API (Recommended for Free Render tiers to bypass SMTP blocking)
  if (env.resendApiKey) {
    console.log(`[Resend] Attempting to send QR ticket email to ${to} for event "${eventTitle}"`);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: env.senderEmail,
          to: [to],
          subject: `Your QR Ticket for ${eventTitle}`,
          html: `
            <p>Hello ${attendeeName},</p>
            <p>Your registration is complete. Present this QR code at the event check-in desk.</p>
            <p>Ticket ID: <strong>${ticketUuid}</strong></p>
            <img alt="QR Code" src="${qrCodeDataUrl}" />
          `,
          attachments: [
            {
              filename: `ticket-${ticketUuid}.png`,
              content: base64
            }
          ]
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[Resend] Failed to send email to ${to}:`, data);
        return { sent: false, reason: data.message || "Resend API error" };
      }

      console.log(`[Resend] Email successfully sent. ID: ${data.id}`);
      return { sent: true, id: data.id };
    } catch (error) {
      console.error(`[Resend] Exception occurred while sending email to ${to}:`, error);
      return { sent: false, reason: error.message };
    }
  }

  // Scenario 2: Fallback to standard SMTP (Requires Paid Render tier)
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[SMTP/Resend] Neither Resend API Key nor SMTP settings are configured. Skipping email send for:", to);
    return { sent: false, reason: "No email service configured" };
  }

  console.log(`[SMTP] Attempting to send email to ${to} via ${env.smtpHost}:${env.smtpPort}`);
  try {
    await transporter.sendMail({
      from: env.senderEmail,
      to,
      subject: `Your QR Ticket for ${eventTitle}`,
      html: `
        <p>Hello ${attendeeName},</p>
        <p>Your registration is complete. Present this QR code at the event check-in desk.</p>
        <p>Ticket ID: <strong>${ticketUuid}</strong></p>
        <img alt="QR Code" src="${qrCodeDataUrl}" />
      `,
      attachments: [
        {
          filename: `ticket-${ticketUuid}.png`,
          content: base64,
          encoding: "base64"
        }
      ]
    });
    console.log(`[SMTP] Email successfully sent to ${to}`);
    return { sent: true };
  } catch (err) {
    console.error(`[SMTP] Failed to send email to ${to}:`, err);
    return { sent: false, reason: err.message };
  }
}

