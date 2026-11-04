import { describe, expect, it } from "vitest";
import {
  FREE_SOURCES,
  ScoreInputError,
  bandOf,
  parseScoreInput,
  ratingOf,
  refreshReminderDue,
  scoreFactors,
  summarise,
  type ScoreRow,
} from "./score";

const row = (
  id: string,
  bureau: ScoreRow["bureau"],
  score: number,
  checked_on: string,
): ScoreRow => ({ id, bureau, score, checked_on, via: null });

describe("bands and ratings", () => {
  it("maps a score onto the finder's bands at the lenders' cut-offs", () => {
    expect(bandOf(812)).toBe("750+");
    expect(bandOf(750)).toBe("750+");
    expect(bandOf(749)).toBe("700-749");
    expect(bandOf(700)).toBe("700-749");
    expect(bandOf(650)).toBe("650-699");
    expect(bandOf(649)).toBe("below-650");
    expect(ratingOf(780).label).toBe("Excellent");
    expect(ratingOf(610).tone).toBe("poor");
  });
});

describe("summarise", () => {
  const rows = [
    row("a", "cibil", 742, "2026-08-01"),
    row("b", "cibil", 761, "2026-10-01"),
    row("c", "experian", 788, "2026-09-15"),
  ];

  it("keeps the newest per bureau with its change", () => {
    const s = summarise(rows, "2026-11-04");
    expect(s.latest.map((l) => l.bureau)).toEqual(["cibil", "experian"]);
    expect(s.current?.score).toBe(761);
    expect(s.current?.change).toBe(19);
    expect(s.latest[1].change).toBeNull();
    expect(s.current?.ageDays).toBe(34);
    expect(s.history.map((h) => h.id)).toEqual(["a", "c", "b"]);
  });

  it("calls a month-old score stale, and an empty list too", () => {
    expect(summarise(rows, "2026-11-04").refreshDue).toBe(true);
    expect(summarise(rows, "2026-10-20").refreshDue).toBe(false);
    expect(summarise([], "2026-10-20").refreshDue).toBe(true);
  });

  it("reminds exactly once: 30 days after the newest score", () => {
    expect(refreshReminderDue(rows, "2026-10-31")).toBe(true);
    expect(refreshReminderDue(rows, "2026-10-30")).toBe(false);
    expect(refreshReminderDue(rows, "2026-11-01")).toBe(false);
    expect(refreshReminderDue([], "2026-11-01")).toBe(false);
  });
});

describe("parseScoreInput", () => {
  const today = "2026-11-04";
  it("accepts a real score", () => {
    expect(
      parseScoreInput({ score: 754, bureau: "cibil", via: "gpay" }, today),
    ).toEqual({ score: 754, bureau: "cibil", via: "gpay", checked_on: today });
  });
  it("rejects what can't be a score", () => {
    for (const score of [299, 901, 750.5, "abc", null])
      expect(() => parseScoreInput({ score, bureau: "cibil" }, today)).toThrow(
        ScoreInputError,
      );
    expect(() =>
      parseScoreInput({ score: 700, bureau: "fico" }, today),
    ).toThrow(/bureau/);
    expect(() =>
      parseScoreInput(
        { score: 700, bureau: "crif", checked_on: "2026-12-01" },
        today,
      ),
    ).toThrow(/future/);
  });
  it("drops an unknown 'via' rather than failing", () => {
    expect(
      parseScoreInput({ score: 700, bureau: "crif", via: "x" }, today).via,
    ).toBeNull();
  });
});

describe("scoreFactors", () => {
  it("flags late payments as the top risk", () => {
    const f = scoreFactors({
      stress: [{ kind: "late_fee", date: "2026-10-02" }],
      cardsHeld: 2,
      newCards6m: 0,
    });
    expect(f[0].key).toBe("payments");
    expect(f[0].status).toBe("risk");
    expect(f[0].text).toMatch(/1 late-payment sign/);
  });
  it("treats minimum-due and interest as 'watch', not late", () => {
    for (const kind of ["min_due_only", "interest"])
      expect(
        scoreFactors({
          stress: [{ kind, date: "2026-10-02" }],
          cardsHeld: 1,
          newCards6m: 0,
        })[0].status,
      ).toBe("watch");
  });
  it("is honest about what it can't see", () => {
    const f = scoreFactors({ stress: [], cardsHeld: 0, newCards6m: 3 });
    expect(f.find((x) => x.key === "utilisation")?.status).toBe("unknown");
    expect(f.find((x) => x.key === "enquiries")?.status).toBe("watch");
    expect(f[0].status).toBe("good");
  });
});

describe("FREE_SOURCES", () => {
  it("only official or the apps' own pages, no tracking", () => {
    for (const s of FREE_SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.url).not.toMatch(/utm_|aff|ref=|paisabazaar|bankbazaar/i);
    }
    // Each bureau's free yearly report is listed.
    for (const b of ["cibil", "experian", "crif", "equifax"])
      expect(
        FREE_SOURCES.some((s) => s.key === b && s.refresh === "yearly"),
      ).toBe(true);
  });
});
