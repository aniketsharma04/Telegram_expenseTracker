import type { ScoreBand } from "./engine";

/**
 * Credit score (v22): see, save and track your score inside Aaj.
 *
 * How GPay, PhonePe, Paytm and CRED do it (research_notes/Credit score):
 * each has a signed agreement with a bureau (TransUnion CIBIL or Experian)
 * and pulls the report with the user's consent. Since the RBI's Credit
 * Information Companies Directions (28 Nov 2025, para 24) an app that isn't a
 * lender may only do that under a bureau contract with due diligence, a yearly
 * CISA-audited IS audit, data kept in India and deleted within six months —
 * and pays ₹5–50 a pull. Aaj has none of that yet, so it does not pull
 * reports. Instead it:
 *   - sends people to the free, official checks (one tap into the app),
 *   - keeps the score they saw, per bureau, and tracks it over time,
 *   - turns it into the score band the card finder's approval chances use,
 *   - and explains what moves it, using what Aaj already sees in their
 *     messages (late fees, minimum-due payments).
 * Nothing is sent to a bureau or a bank.
 */

export type Bureau = "cibil" | "experian" | "equifax" | "crif";
export const BUREAUS: Record<Bureau, string> = {
  cibil: "TransUnion CIBIL",
  experian: "Experian",
  equifax: "Equifax",
  crif: "CRIF High Mark",
};

export type ScoreVia =
  "gpay" | "phonepe" | "paytm" | "cred" | "bureau" | "bank" | "other";

export interface ScoreRow {
  id: string;
  bureau: Bureau;
  score: number;
  checked_on: string; // YYYY-MM-DD
  via: ScoreVia | null;
}

export const MIN_SCORE = 300;
export const MAX_SCORE = 900;
/** Apps refresh monthly; after this a saved score is called stale. */
export const REFRESH_DAYS = 30;

/** The band the card finder's eligibility uses. */
export function bandOf(score: number): ScoreBand {
  if (score >= 750) return "750+";
  if (score >= 700) return "700-749";
  if (score >= 650) return "650-699";
  return "below-650";
}

/** How a score reads, in the words lenders use. */
export function ratingOf(score: number): {
  label: string;
  tone: "great" | "good" | "fair" | "poor";
} {
  if (score >= 750) return { label: "Excellent", tone: "great" };
  if (score >= 700) return { label: "Good", tone: "good" };
  if (score >= 650) return { label: "Fair", tone: "fair" };
  return { label: "Needs work", tone: "poor" };
}

const dayDiff = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000,
  );

export interface ScoreSummary {
  /** Newest score per bureau, newest first. */
  latest: Array<ScoreRow & { change: number | null; ageDays: number }>;
  /** All saved scores, oldest first (for the chart). */
  history: ScoreRow[];
  /** The newest score of all, or null. */
  current: (ScoreRow & { change: number | null; ageDays: number }) | null;
  /** Nothing saved, or the newest is over a month old. */
  refreshDue: boolean;
}

export function summarise(rows: ScoreRow[], today: string): ScoreSummary {
  const history = [...rows].sort(
    (a, b) =>
      a.checked_on.localeCompare(b.checked_on) || a.id.localeCompare(b.id),
  );
  const byBureau = new Map<Bureau, ScoreRow[]>();
  for (const r of history) {
    const list = byBureau.get(r.bureau) ?? [];
    list.push(r);
    byBureau.set(r.bureau, list);
  }
  const latest = [...byBureau.values()]
    .map((list) => {
      const last = list[list.length - 1];
      const prev = list.length > 1 ? list[list.length - 2] : null;
      return {
        ...last,
        change: prev ? last.score - prev.score : null,
        ageDays: Math.max(0, dayDiff(today, last.checked_on)),
      };
    })
    .sort((a, b) => b.checked_on.localeCompare(a.checked_on));
  const current = latest[0] ?? null;
  return {
    latest,
    history,
    current,
    refreshDue: !current || current.ageDays > REFRESH_DAYS,
  };
}

/** Is today the day to remind them? Exactly a month after the newest score. */
export function refreshReminderDue(rows: ScoreRow[], today: string): boolean {
  const s = summarise(rows, today);
  return Boolean(s.current) && s.current!.ageDays === REFRESH_DAYS;
}

// ── Where to check for free ────────────────────────────────────────────────

export interface FreeSource {
  key: ScoreVia | Bureau;
  name: string;
  bureau: Bureau;
  /** How often it's free there. */
  refresh: "monthly" | "yearly";
  /** Android app to open, when it's an app. */
  androidPackage: string | null;
  /** The page to open otherwise (official, no tracking). */
  url: string;
  how: string;
}

/**
 * Checked 2026-11-04. Apps show a monthly-refreshed score through their own
 * bureau deal; each bureau also owes everyone one free full report a year
 * (RBI CIC Directions 2025, para 21(7)). Checking your own score is a soft
 * enquiry and never lowers it.
 */
export const FREE_SOURCES: FreeSource[] = [
  {
    key: "gpay",
    name: "Google Pay",
    bureau: "cibil",
    refresh: "monthly",
    androidPackage: "com.google.android.apps.nbu.paisa.user",
    url: "https://support.google.com/pay/india/answer/13017211",
    how: "Home → scroll to “Manage your money” → Check your CIBIL score for free.",
  },
  {
    key: "paytm",
    name: "Paytm",
    bureau: "cibil",
    refresh: "monthly",
    androidPackage: "net.one97.paytm",
    url: "https://paytm.com/faqs/credit-score/how-to-check-cibil-score-on-paytm",
    how: "Loans and Credit Cards → Free Credit Score.",
  },
  {
    key: "phonepe",
    name: "PhonePe",
    bureau: "experian",
    refresh: "monthly",
    androidPackage: "com.phonepe.app",
    url: "https://www.phonepe.com/",
    how: "Loans / Credit → Check credit score. Some accounts see CIBIL or Equifax instead of Experian.",
  },
  {
    key: "cred",
    name: "CRED",
    bureau: "experian",
    refresh: "monthly",
    androidPackage: "com.dreamplug.androidapp",
    url: "https://cred.club/check-your-credit-score/experian-credit-score-report",
    how: "Home → Credit score. CRED shows Experian; CRIF for club members.",
  },
  {
    key: "cibil",
    name: "CIBIL (official, free yearly report)",
    bureau: "cibil",
    refresh: "yearly",
    androidPackage: null,
    url: "https://www.cibil.com/freecibilscore",
    how: "Name, PAN, date of birth and an OTP. One full report free each calendar year.",
  },
  {
    key: "experian",
    name: "Experian (official)",
    bureau: "experian",
    refresh: "yearly",
    androidPackage: null,
    url: "https://www.experian.in/",
    how: "One free full report a year, required by RBI.",
  },
  {
    key: "crif",
    name: "CRIF High Mark (official)",
    bureau: "crif",
    refresh: "yearly",
    androidPackage: null,
    url: "https://www.crifhighmark.com/",
    how: "One free full report a year, required by RBI.",
  },
  {
    key: "equifax",
    name: "Equifax (official)",
    bureau: "equifax",
    refresh: "yearly",
    androidPackage: null,
    url: "https://www.equifax.co.in/",
    how: "One free full report a year, required by RBI.",
  },
];

// ── What moves it ──────────────────────────────────────────────────────────

export interface ScoreFactor {
  key: "payments" | "utilisation" | "age" | "mix" | "enquiries";
  title: string;
  weight: "high" | "medium" | "low";
  /** What Aaj sees in this person's own data, if anything. */
  status: "good" | "watch" | "risk" | "unknown";
  text: string;
}

export interface ScoreSignals {
  /** Late fees / minimum-due payments spotted in messages (the stress list). */
  stress: Array<{ kind: string; date: string }>;
  /** Credit cards Aaj knows they hold. */
  cardsHeld: number;
  /** Cards added (detected or by hand) in the last 6 months. */
  newCards6m: number;
}

/**
 * The bureaus' common factors, ordered by weight, each with what Aaj can
 * actually see. Aaj never sees the report, so it only claims what the
 * messages show and says "unknown" otherwise.
 */
export function scoreFactors(sig: ScoreSignals): ScoreFactor[] {
  const late = sig.stress.filter((s) =>
    /late|overdue|bounce|penal/i.test(s.kind),
  );
  const minDue = sig.stress.filter((s) => /min_due|interest/i.test(s.kind));
  return [
    {
      key: "payments",
      title: "Paying on time",
      weight: "high",
      status: late.length ? "risk" : minDue.length ? "watch" : "good",
      text: late.length
        ? `Aaj saw ${late.length} late-payment sign${late.length > 1 ? "s" : ""} in your messages. One missed due date can cost 50–100 points and stays on the report for years. Set autopay for at least the minimum.`
        : minDue.length
          ? "You paid only the minimum due or were charged interest recently. It isn't late, but the balance carried over costs 36–45% a year and keeps your card use high."
          : "No late fees in your messages. Keep it that way: payment history weighs the most.",
    },
    {
      key: "utilisation",
      title: "How much of your limit you use",
      weight: "high",
      status: "unknown",
      text: "Keep each card's statement balance under 30% of its limit (under 10% is best). Paying before the statement date lowers what's reported.",
    },
    {
      key: "age",
      title: "Age of your credit",
      weight: "medium",
      status: "unknown",
      text: "Older accounts help. Don't close your oldest card just because it's unused; keep a small spend on it.",
    },
    {
      key: "mix",
      title: "Mix of credit",
      weight: "low",
      status: "unknown",
      text: "A mix of cards and loans (secured and unsecured) helps a little. Never take a loan just for this.",
    },
    {
      key: "enquiries",
      title: "New applications",
      weight: "medium",
      status: sig.newCards6m >= 2 ? "watch" : "good",
      text:
        sig.newCards6m >= 2
          ? `${sig.newCards6m} new cards in 6 months. Each application is a hard enquiry; space them at least 6 months apart.`
          : "Each loan or card application is a hard enquiry. Checking your own score is not, and never lowers it.",
    },
  ];
}

// ── Input checks ───────────────────────────────────────────────────────────

export class ScoreInputError extends Error {}

export function parseScoreInput(
  v: Record<string, unknown>,
  today: string,
): Omit<ScoreRow, "id"> {
  const score = Number(v.score);
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE)
    throw new ScoreInputError(
      `score must be a whole number from ${MIN_SCORE} to ${MAX_SCORE}`,
    );
  if (typeof v.bureau !== "string" || !(v.bureau in BUREAUS))
    throw new ScoreInputError(
      "bureau must be cibil, experian, equifax or crif",
    );
  const checked =
    typeof v.checked_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.checked_on)
      ? v.checked_on
      : today;
  if (checked > today)
    throw new ScoreInputError("checked_on can't be in the future");
  if (dayDiff(today, checked) > 3 * 365)
    throw new ScoreInputError("checked_on is too far back");
  const vias: ScoreVia[] = [
    "gpay",
    "phonepe",
    "paytm",
    "cred",
    "bureau",
    "bank",
    "other",
  ];
  const via =
    typeof v.via === "string" && vias.includes(v.via as ScoreVia)
      ? (v.via as ScoreVia)
      : null;
  return { bureau: v.bureau as Bureau, score, checked_on: checked, via };
}
