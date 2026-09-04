import { describe, it, expect } from "vitest";
import {
  isQuotaError,
  looksLikeGeminiKey,
  pickKey,
  restKey,
  type KeyState,
} from "./ai-keys";

const ready = (key: string): KeyState => ({ key, restingUntil: 0 });

describe("pickKey", () => {
  it("prefers the first healthy key, so the primary stays primary", () => {
    expect(pickKey([ready("a"), ready("b")])).toBe("a");
  });

  it("skips a resting key", () => {
    const now = 1_000_000;
    const states = [{ key: "a", restingUntil: now + 5000 }, ready("b")];
    expect(pickKey(states, now)).toBe("b");
  });

  it("uses a key again once its rest is over", () => {
    const now = 1_000_000;
    const states = [{ key: "a", restingUntil: now - 1 }];
    expect(pickKey(states, now)).toBe("a");
  });

  it("returns nothing when every key is resting", () => {
    const now = 1_000_000;
    const states = [
      { key: "a", restingUntil: now + 1000 },
      { key: "b", restingUntil: now + 1000 },
    ];
    expect(pickKey(states, now)).toBeNull();
  });

  it("returns nothing when there are no keys at all", () => {
    expect(pickKey([])).toBeNull();
  });
});

describe("restKey", () => {
  it("rests only the named key", () => {
    const now = 500;
    const after = restKey([ready("a"), ready("b")], "a", now, 1000);
    expect(after[0].restingUntil).toBe(1500);
    expect(after[1].restingUntil).toBe(0);
  });

  it("leaves the list alone when the key isn't in it", () => {
    const before = [ready("a")];
    expect(restKey(before, "zzz", 500, 1000)).toEqual(before);
  });

  it("does not mutate the input", () => {
    const before = [ready("a")];
    restKey(before, "a", 500, 1000);
    expect(before[0].restingUntil).toBe(0);
  });
});

describe("isQuotaError", () => {
  it("treats 429 as exhaustion", () => {
    expect(isQuotaError(429, "")).toBe(true);
  });

  it("reads Google's quota wording on 403 and 400", () => {
    expect(isQuotaError(403, "Quota exceeded for quota metric")).toBe(true);
    expect(isQuotaError(400, "RESOURCE_EXHAUSTED")).toBe(true);
    expect(isQuotaError(403, "billing account not configured")).toBe(true);
  });

  it("does not blame the key for a bad request", () => {
    // Trying another key would just waste a second call.
    expect(isQuotaError(400, "Invalid JSON payload")).toBe(false);
    expect(isQuotaError(404, "model not found")).toBe(false);
    expect(isQuotaError(500, "internal error")).toBe(false);
  });
});

describe("looksLikeGeminiKey", () => {
  it("accepts a realistic key", () => {
    expect(looksLikeGeminiKey("AIzaSyB1234567890abcdefghijklmnopqrstu")).toBe(
      true,
    );
  });

  it("rejects obvious mistakes before they cost a round trip", () => {
    expect(looksLikeGeminiKey("")).toBe(false);
    expect(looksLikeGeminiKey("sk-proj-abc123")).toBe(false); // wrong provider
    expect(looksLikeGeminiKey("AIza-too-short")).toBe(false);
  });

  it("tolerates surrounding whitespace from a paste", () => {
    expect(
      looksLikeGeminiKey("  AIzaSyB1234567890abcdefghijklmnopqrstu  "),
    ).toBe(true);
  });
});
