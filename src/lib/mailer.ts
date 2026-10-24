/**
 * Sending the sign-in code (v12).
 *
 * Three providers, chosen by whichever environment variables are present, so
 * the deployment isn't locked to one vendor:
 *
 *   resend   RESEND_API_KEY + MAIL_FROM
 *            3,000/month free, but the From address must be a domain you own
 *            and have authenticated.
 *
 *   emailjs  EMAILJS_SERVICE_ID + EMAILJS_TEMPLATE_ID + EMAILJS_PUBLIC_KEY
 *            + EMAILJS_PRIVATE_KEY
 *            Relays through a mailbox you connect (your Gmail), so it needs
 *            no domain at all — the trade is a small monthly allowance.
 *
 *   smtp     SMTP_HOST + SMTP_USER + SMTP_PASS (+ SMTP_PORT, MAIL_FROM)
 *            Your own mailbox over SMTP — Gmail with an app password gives
 *            ~500 a day. No domain, no middleman; the current default here.
 *
 * Why the choice matters: since Gmail and Yahoo tightened sender rules in
 * 2024, every bulk provider requires an authenticated domain, so "send from
 * my Gmail address via Resend/Brevo" is not possible anywhere. Relaying
 * *through* your mailbox is the only domain-free route, which is exactly what
 * EmailJS and SMTP do.
 */

import nodemailer from "nodemailer";

export type MailProvider = "resend" | "emailjs" | "smtp" | null;

export function mailProvider(): MailProvider {
  const forced = process.env.MAIL_PROVIDER?.toLowerCase();
  if (forced === "resend" || forced === "emailjs" || forced === "smtp")
    return forced;

  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return "resend";
  if (
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY
  )
    return "emailjs";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    return "smtp";
  return null;
}

export function mailerConfigured(): boolean {
  return mailProvider() !== null;
}

export interface MailResult {
  sent: boolean;
  error: string | null;
}

export async function sendSignInCode(
  email: string,
  code: string,
  appName = "Expense Tracker",
): Promise<MailResult> {
  const provider = mailProvider();
  if (!provider) {
    return {
      sent: false,
      error: "Email sign-in isn't configured on this deployment.",
    };
  }

  const subject = `${code} is your ${appName} sign-in code`;
  const text = [
    `Your ${appName} sign-in code is ${code}`,
    "",
    "It works once and expires in 10 minutes.",
    "If you didn't ask for it, you can ignore this email. Nobody can get in without the code.",
  ].join("\n");

  try {
    switch (provider) {
      case "resend":
        return await sendViaResend(email, subject, text, code, appName);
      case "emailjs":
        return await sendViaEmailJs(email, code, appName);
      case "smtp":
        return await sendViaSmtp(email, subject, text, code, appName);
    }
  } catch (err) {
    console.error(`${provider} send failed`, err);
    return { sent: false, error: "Couldn't reach the mail provider." };
  }
}

// ── Resend ──────────────────────────────────────────────────────────────────

async function sendViaResend(
  email: string,
  subject: string,
  text: string,
  code: string,
  appName: string,
): Promise<MailResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [email],
      subject,
      text,
      html: htmlBody(code, appName),
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("resend send failed", res.status, detail.slice(0, 300));
    return { sent: false, error: `Mail provider returned ${res.status}` };
  }
  return { sent: true, error: null };
}

// ── EmailJS ─────────────────────────────────────────────────────────────────

/**
 * EmailJS sends through a template you define in their dashboard, so the
 * template must use these parameters:
 *
 *   {{to_email}}  – recipient
 *   {{code}}      – the six digits
 *   {{app_name}}  – your app's name
 *
 * The private key is required for server-side calls; without it EmailJS
 * rejects requests that don't come from a browser.
 */
async function sendViaEmailJs(
  email: string,
  code: string,
  appName: string,
): Promise<MailResult> {
  if (!process.env.EMAILJS_PRIVATE_KEY) {
    return {
      sent: false,
      error:
        "EmailJS needs EMAILJS_PRIVATE_KEY for server-side sending (its API blocks non-browser calls without it).",
    };
  }

  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: {
        to_email: email,
        code,
        app_name: appName,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("emailjs send failed", res.status, detail.slice(0, 300));
    return {
      sent: false,
      // EmailJS returns the reason as plain text, and it's usually specific
      // enough to act on ("template ID not found", "quota exceeded").
      error: `EmailJS: ${detail.slice(0, 120) || res.status}`,
    };
  }
  return { sent: true, error: null };
}

// ── SMTP (your own mailbox) ─────────────────────────────────────────────────

/**
 * Your own mailbox over SMTP — the route that needs no domain at all, since
 * the mail genuinely comes from the account that authenticated.
 */
async function sendViaSmtp(
  email: string,
  subject: string,
  text: string,
  code: string,
  appName: string,
): Promise<MailResult> {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 is implicit TLS; 587 upgrades with STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({
    // Gmail rewrites From to the authenticated mailbox anyway, so falling
    // back to SMTP_USER keeps the header honest rather than spoofed.
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    text,
    html: htmlBody(code, appName),
  });
  return { sent: true, error: null };
}

/** Deliberately plain: inline styles only, no images, no tracking. */
function htmlBody(code: string, appName: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#111">
  <p style="font-size:15px;margin:0 0 18px">Your ${appName} sign-in code:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:6px;margin:0 0 18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>
  <p style="font-size:13px;color:#555;margin:0 0 8px">It works once and expires in 10 minutes.</p>
  <p style="font-size:13px;color:#555;margin:0">If you didn't ask for it, ignore this email. Nobody can sign in without the code.</p>
</div>`;
}
