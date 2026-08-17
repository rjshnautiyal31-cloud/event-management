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

function getTicketEmailHtml({ attendeeName, eventTitle, ticketUuid }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your QR Ticket</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 24px 12px; background-color: #f8fafc;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              
              <!-- Brand Header -->
              <tr>
                <td style="background-color: #0A2D59; padding: 28px 24px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.02em;">
                    🎟️ Official Entry Pass
                  </h1>
                  <p style="margin: 6px 0 0 0; color: #cbd5e1; font-size: 13px; font-weight: 500;">
                    ${eventTitle}
                  </p>
                </td>
              </tr>

              <!-- Pass Body -->
              <tr>
                <td style="padding: 32px 28px; text-align: center;">
                  <h2 style="margin: 0 0 6px 0; color: #0A2D59; font-size: 18px; font-weight: 700;">
                    Hello ${attendeeName},
                  </h2>
                  <p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                    Your event registration is confirmed! Present this QR pass at the entrance scanner post for fast check-in.
                  </p>

                  <!-- Inline CID Embedded QR Code -->
                  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 20px;">
                    <img src="cid:qrcode" width="220" height="220" style="display: block; width: 220px; height: 220px; border-radius: 8px;" alt="QR Code Ticket Pass" />
                  </div>

                  <br />

                  <!-- Ticket ID Badge -->
                  <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 16px; font-family: monospace; font-size: 12px; color: #0A2D59; font-weight: 700; display: inline-block; word-break: break-all;">
                    Ticket ID: ${ticketUuid}
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 500;">
                    Automated Event Pass issued by EventQR System.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendTicketEmail({ to, attendeeName, eventTitle, ticketUuid, qrCodeDataUrl }) {
  const base64Clean = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
  const imageBuffer = Buffer.from(base64Clean, "base64");
  const htmlBody = getTicketEmailHtml({ attendeeName, eventTitle, ticketUuid });

  // Scenario 1: Use Resend API (Recommended for Free Render tiers)
  if (env.resendApiKey) {
    console.log(`[Resend] Sending embedded CID QR ticket email to ${to} for "${eventTitle}"`);
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
          subject: `Your QR Entry Pass - ${eventTitle}`,
          html: htmlBody,
          attachments: [
            {
              filename: `ticket-${ticketUuid}.png`,
              content: base64Clean,
              content_id: "qrcode"
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

  // Scenario 2: Fallback to standard SMTP
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[SMTP/Resend] Neither Resend API Key nor SMTP settings are configured. Skipping email send for:", to);
    return { sent: false, reason: "No email service configured" };
  }

  console.log(`[SMTP] Sending embedded CID QR ticket email to ${to} via ${env.smtpHost}:${env.smtpPort}`);
  try {
    await transporter.sendMail({
      from: env.senderEmail,
      to,
      subject: `Your QR Entry Pass - ${eventTitle}`,
      html: htmlBody,
      attachments: [
        {
          filename: `ticket-${ticketUuid}.png`,
          content: imageBuffer,
          cid: "qrcode"
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
