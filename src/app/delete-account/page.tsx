"use client";

import { useState } from "react";

type Step = "email" | "code" | "confirm" | "done";

/**
 * Delete your account without the app — Google Play requires a web path for
 * this. Signs in with an email code, then calls the same deletion the app
 * uses (DELETE /api/account), so both remove exactly the same data.
 */
export default function DeleteAccountPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (body: Record<string, string>) => {
    const res = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
    if (!res.ok) throw new Error(json.error ?? "Something went wrong — try again.");
    return json;
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    }
    setBusy(false);
  };

  const sendCode = () =>
    run(async () => {
      await call({ email: email.trim() });
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      const json = await call({ email: email.trim(), code: code.trim() });
      if (!json.token) throw new Error("That code didn't work — check it and try again.");
      setToken(json.token);
      setStep("confirm");
    });

  const remove = () =>
    run(async () => {
      const res = await fetch("/api/account?confirm=delete-my-account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Couldn't delete the account — try again.");
      setStep("done");
    });

  return (
    <main className="legal">
      <h1>Delete your account</h1>

      {step === "done" ? (
        <p className="legal-ok">
          Your account and all its data have been deleted. If the app is still on your phone, you can uninstall it.
        </p>
      ) : (
        <>
          <p>
            This permanently deletes your Expense Tracker account and everything in it: expenses, income, your plan and
            goals, notifications, captured payment messages, accounts, bills and device tokens. It can&apos;t be undone.
            Want a copy first? Use Settings → Export in the app.
          </p>

          {step === "email" && (
            <form
              className="legal-form"
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
            >
              <label htmlFor="email">The email you sign in with</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn-primary" disabled={busy}>
                {busy ? "Sending…" : "Send me a code"}
              </button>
            </form>
          )}

          {step === "code" && (
            <form
              className="legal-form"
              onSubmit={(e) => {
                e.preventDefault();
                verify();
              }}
            >
              <label htmlFor="code">Code sent to {email}</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button className="btn-primary" disabled={busy}>
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          )}

          {step === "confirm" && (
            <div className="legal-form">
              <p>
                <b>Last step.</b> Delete the account for {email} and all of its data?
              </p>
              <button className="btn-danger" onClick={remove} disabled={busy}>
                {busy ? "Deleting…" : "Delete everything"}
              </button>
            </div>
          )}

          {error && <p className="legal-error">{error}</p>}

          <p className="legal-meta">
            Signed up with Telegram only? Open the app → Settings → Delete account, or send <code>/app</code> to the bot
            to sign in to the app first.
          </p>
        </>
      )}
    </main>
  );
}
