"use client";

const BOT_URL = "https://t.me/Aniket_financial_expense_bot";

export default function LoginScreen() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-mark large">₹</div>
        <h1>Expense Tracker</h1>
        <p className="login-tagline">Log in Telegram. Analyze here.</p>

        <ol className="login-steps">
          <li>
            Open our Telegram bot and send <code>/dashboard</code>
          </li>
          <li>Tap the login link it replies with</li>
          <li>You&apos;ll land right back here, signed in</li>
        </ol>

        <a className="btn-primary" href={BOT_URL} target="_blank" rel="noreferrer">
          Open the Telegram bot
        </a>
        <p className="login-note">
          No passwords — your Telegram account is your identity. New here? Send the bot any
          expense like <code>300 zomato</code> to get started.
        </p>
      </div>
    </div>
  );
}
