import { describe, expect, it } from "vitest";
import { GmailAccount, needsReauth, reauthNotice } from "./detected";

const account = (lastError: string | null): GmailAccount => ({
  user_id: 1,
  email: "a@example.com",
  refresh_token: "r",
  last_sync_at: "2026-09-01T00:00:00Z",
  last_error: lastError,
});

describe("needsReauth", () => {
  it("is false for a healthy or never-synced account", () => {
    expect(needsReauth(account(null))).toBe(false);
  });

  it("is false when nothing is connected", () => {
    expect(needsReauth(null)).toBe(false);
  });

  it("flags the errors Google returns for a dead refresh token", () => {
    // The 7-day expiry while the OAuth app is unpublished, and an explicit revoke.
    expect(
      needsReauth(account("Google OAuth: Token has been expired or revoked.")),
    ).toBe(true);
    expect(needsReauth(account("Google OAuth: invalid_grant"))).toBe(true);
  });

  it("leaves transient failures alone so the user isn't nagged to reconnect", () => {
    for (const err of [
      "Gmail API: HTTP 500",
      "Gmail API: HTTP 429 rate limit exceeded",
      "fetch failed",
      "Gmail sync failed",
    ]) {
      expect(needsReauth(account(err))).toBe(false);
    }
  });
});

describe("reauthNotice", () => {
  it("links to the app when APP_URL is set, without doubling the slash", () => {
    expect(reauthNotice("https://example.com/")).toContain(
      '<a href="https://example.com">Open the app</a>',
    );
  });

  it("still reads sensibly with no APP_URL", () => {
    const text = reauthNotice(undefined);
    expect(text).toContain("Open the app");
    expect(text).not.toContain("<a href");
  });
});
