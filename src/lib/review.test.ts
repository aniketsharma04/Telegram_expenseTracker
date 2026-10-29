import { afterEach, describe, expect, it, vi } from "vitest";
import { isReviewEmail, reviewCodeMatches } from "./review";

afterEach(() => vi.unstubAllEnvs());

describe("store-review sign-in", () => {
  it("is off unless both settings are present", () => {
    vi.stubEnv("REVIEW_EMAIL", "");
    vi.stubEnv("REVIEW_CODE", "");
    expect(isReviewEmail("review@example.com")).toBe(false);
  });

  it("refuses a short (guessable) code even when configured", () => {
    vi.stubEnv("REVIEW_EMAIL", "review@example.com");
    vi.stubEnv("REVIEW_CODE", "123456");
    expect(isReviewEmail("review@example.com")).toBe(false);
    expect(reviewCodeMatches("review@example.com", "123456")).toBe(false);
  });

  it("accepts exactly the configured address and code", () => {
    vi.stubEnv("REVIEW_EMAIL", "Review@Example.com");
    vi.stubEnv("REVIEW_CODE", "play-review-2026");
    expect(isReviewEmail(" review@example.com ")).toBe(true);
    expect(reviewCodeMatches("review@example.com", "play-review-2026")).toBe(
      true,
    );
    expect(reviewCodeMatches("review@example.com", "play-review-2027")).toBe(
      false,
    );
    expect(reviewCodeMatches("someone@example.com", "play-review-2026")).toBe(
      false,
    );
  });
});
