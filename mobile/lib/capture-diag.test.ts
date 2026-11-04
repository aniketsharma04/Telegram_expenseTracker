import { describe, expect, it } from "vitest";
import { explainCapture, type Diagnostics } from "./capture-diag";

const now = Date.parse("2026-11-04T10:00:00Z");
const h = (n: number) => now - n * 3_600_000;
const healthy: Diagnostics = {
  lastSeen: h(2),
  lastCaptured: h(3),
  connectedAt: h(100),
  disconnectedAt: 0,
  uploadAt: h(3),
  uploadResult: "200",
  pending: 0,
  signedIn: true,
};

describe("explainCapture", () => {
  it("reports a working reader with the last payment", () => {
    const v = explainCapture(healthy, true, now)!;
    expect(v.state).toBe("ok");
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("3 h ago");
  });

  it("access off wins over everything", () => {
    expect(explainCapture(healthy, false, now)!.state).toBe("no-access");
    expect(explainCapture(null, false, now)!.state).toBe("no-access");
  });

  it("says nothing on builds without diagnostics", () => {
    expect(explainCapture(null, true, now)).toBeNull();
  });

  it("spots a listener Android unbound", () => {
    const v = explainCapture(
      { ...healthy, disconnectedAt: h(30), connectedAt: h(100) },
      true,
      now,
    )!;
    expect(v.state).toBe("not-running");
    expect(v.detail).toMatch(/off and on/);
  });

  it("spots uploads failing with alerts piling up", () => {
    expect(
      explainCapture(
        { ...healthy, pending: 4, uploadResult: "500" },
        true,
        now,
      )!.state,
    ).toBe("upload-failing");
    expect(
      explainCapture(
        { ...healthy, pending: 1, uploadResult: "401" },
        true,
        now,
      )!.detail,
    ).toMatch(/Sign out and in/);
    // Pending but the last upload worked: just in flight, fine.
    expect(
      explainCapture(
        { ...healthy, pending: 2, uploadResult: "200" },
        true,
        now,
      )!.state,
    ).toBe("ok");
  });

  it("calls two days of silence a fault, the 30 Oct case", () => {
    const v = explainCapture(
      { ...healthy, lastSeen: h(5 * 24), lastCaptured: h(5 * 24) },
      true,
      now,
    )!;
    expect(v.state).toBe("silent");
    expect(v.detail).toContain("5 days ago");
  });

  it("a fresh install is waiting, not broken", () => {
    const v = explainCapture(
      { ...healthy, lastSeen: 0, lastCaptured: 0, connectedAt: h(1) },
      true,
      now,
    )!;
    expect(v.state).toBe("waiting");
    expect(v.ok).toBe(true);
  });

  it("signed-out phones can't upload", () => {
    expect(
      explainCapture({ ...healthy, signedIn: false }, true, now)!.state,
    ).toBe("signed-out");
  });
});
