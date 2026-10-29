import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy · Aaj",
  description:
    "What Aaj collects, why, who processes it, and how to delete it.",
};

const UPDATED = "24 October 2026";
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/**
 * Public privacy policy — Google Play requires one for an app that reads
 * notifications and handles financial data. Every claim here must stay true
 * of the code: update it when data flows change.
 */
export default function PrivacyPage() {
  return (
    <main className="legal">
      <h1>Privacy policy</h1>
      <p className="legal-meta">Aaj · last updated {UPDATED}</p>

      <p>
        Aaj turns your income into a daily spending number and tracks payments
        automatically. To do that it handles financial information about you.
        This page says exactly what, why, and how to remove it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account:</b> your email address (or Telegram id and name if you
          signed in with Telegram).
        </li>
        <li>
          <b>
            Payment notifications (Android, only after you allow notification
            access):
          </b>{" "}
          the app reads notifications from your SMS app, bank apps and UPI apps,
          and only those that mention money being debited or credited. The text
          of those notifications (up to 2,000 characters), the amount, merchant,
          account digits and the balance the bank reports are sent to your
          account. Messages containing an OTP or other code are discarded on
          your phone and never sent. Notifications from every other app (chats,
          email, social) are ignored.
        </li>
        <li>
          <b>What you add:</b> expenses, income, budgets, your plan (income,
          salary day, savings goal, fixed costs), goals, accounts, bills.
        </li>
        <li>
          <b>Email bills (only if you connect Gmail):</b> read-only access used
          to find bill and payment emails.
        </li>
        <li>
          <b>Receipt photos and voice notes (only when you send one):</b>{" "}
          processed to read the amount and items; the photo or audio itself is
          not stored.
        </li>
        <li>
          <b>Device:</b> a push-notification token for each phone you sign in
          on, so we can send your daily messages.
        </li>
      </ul>
      <p>
        We do not collect your contacts, location, call logs, SMS inbox, or card
        numbers and passwords.
      </p>

      <h2>Why</h2>
      <p>
        Only to run the app for you: log payments, compute your daily budget,
        send your morning, spend and night notifications, show your dashboard,
        and remind you about bills. We do not sell your data, show ads, or use
        it to build profiles for anyone else.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>Supabase: database (Singapore region).</li>
        <li>Vercel: runs the app's server.</li>
        <li>
          Google (Gemini API): reads receipt photos and messages the app
          couldn't parse itself.
        </li>
        <li>Groq: turns voice notes into text.</li>
        <li>Expo and Google Firebase / Apple: deliver push notifications.</li>
        <li>Our email provider: sends sign-in codes.</li>
        <li>Google (Gmail API): only if you connect Gmail.</li>
        <li>Telegram: only if you use the Telegram bot.</li>
      </ul>
      <p>
        Each receives only what its job needs. All traffic is encrypted in
        transit.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Until you delete it. Deleting your account removes your expenses,
        income, plan, goals, notifications, captured messages, accounts, bills
        and device tokens immediately.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>
          Turn off notification access at any time in Android settings, and
          capture stops at once.
        </li>
        <li>
          Turn off any notification type in the app or in Android's notification
          settings.
        </li>
        <li>Download all your data: app → Settings → Export.</li>
        <li>
          Delete your account: app → Settings → Delete account, or on the web at{" "}
          <a href="/delete-account">/delete-account</a>.
        </li>
      </ul>
      <p>
        These rights apply to everyone, including under India's Digital Personal
        Data Protection Act, 2023.
      </p>

      <h2>Children</h2>
      <p>
        The app is meant for adults managing their own money and is not directed
        at children under 18.
      </p>

      {SUPPORT && (
        <>
          <h2>Contact</h2>
          <p>
            Questions or requests: <a href={`mailto:${SUPPORT}`}>{SUPPORT}</a>
          </p>
        </>
      )}
    </main>
  );
}
