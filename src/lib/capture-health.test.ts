import { describe, expect, it } from "vitest";
import {
  captureQuietNotice,
  cleanCaptureReport,
  judgeCapture,
  quietNoticeDue,
} from "./capture-health";

const now = new Date("2026-11-04T03:30:00Z"); // the daily cron, 09:00 IST
const hoursAgo = (h: number) =>
  new Date(now.getTime() - h * 3_600_000).toISOString();

describe("capture health", () => {
  it("is fine while alerts keep arriving", () => {
    expect(judgeCapture(hoursAgo(5), 20, now).quiet).toBe(false);
    expect(judgeCapture(hoursAgo(47), 20, now).quiet).toBe(false);
  });

  it("goes quiet after two silent days when capture used to work", () => {
    // The real case: last alert 30 Oct 13:45 UTC, checked 4 Nov.
    const h = judgeCapture("2026-10-30T13:45:05Z", 13, now);
    expect(h.quiet).toBe(true);
    expect(h.last_at).toBe("2026-10-30T13:45:05Z");
  });

  it("never calls it quiet without a track record", () => {
    expect(judgeCapture(null, 0, now).quiet).toBe(false); // never set up
    expect(judgeCapture(hoursAgo(100), 2, now).quiet).toBe(false); // too few
  });

  it("pushes once per silence: only on the first daily run that sees it", () => {
    const due = (h: number) =>
      quietNoticeDue(judgeCapture(hoursAgo(h), 10, now), now);
    expect(due(30)).toBe(false); // not quiet yet
    expect(due(50)).toBe(true); // first run past 48h
    expect(due(73)).toBe(false); // next day: the Home card carries it
    expect(due(120)).toBe(false);
  });

  it("the notice names the day and the fix", () => {
    const n = captureQuietNotice("2026-10-30T13:45:05Z");
    expect(n.title).toBe("Bank alerts stopped reaching Aaj");
    expect(n.body).toContain("since 30 Oct");
    expect(n.body).toMatch(/new version/);
    expect(n.html).toContain("<b>");
  });
});

describe("cleanCaptureReport", () => {
  it("keeps status fields and drops anything else, message text included", () => {
    const out = cleanCaptureReport({
      granted: true,
      pending: 3,
      uploadResult: "401",
      body: "Rs 500 debited from A/c 1234",
      messages: ["x"],
      token: "secret",
    });
    expect(out).toEqual({ granted: true, pending: 3, uploadResult: "401" });
  });
  it("rejects wrong types and survives junk", () => {
    expect(cleanCaptureReport({ granted: "yes", pending: "3" })).toEqual({});
    expect(cleanCaptureReport(null)).toEqual({});
    expect(cleanCaptureReport({ model: "x".repeat(200) }).model).toHaveLength(
      60,
    );
  });
});
