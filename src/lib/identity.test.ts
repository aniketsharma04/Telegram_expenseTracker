import { describe, it, expect } from "vitest";
import {
  displayNameOf,
  generateLinkCode,
  isEmailShaped,
  isLinkCodeShaped,
  normaliseEmail,
} from "./identity";
import {
  CODE_LENGTH,
  checkCode,
  generateCode,
  hashCode,
  isRateLimited,
  MAX_ATTEMPTS,
  type StoredCode,
} from "./otp";
import { evaluate, limitFor } from "./quota";

describe("email identity", () => {
  it("treats addresses case- and space-insensitively", () => {
    expect(normaliseEmail("  Aniket@Example.COM ")).toBe("aniket@example.com");
  });

  it("accepts real addresses and rejects nonsense", () => {
    for (const good of [
      "a@b.co",
      "aniket.sharma@gmail.com",
      "x+tag@mail.co.in",
    ])
      expect(isEmailShaped(good)).toBe(true);
    for (const bad of ["", "no-at-sign", "a@b", "a b@c.com", "@nope.com"])
      expect(isEmailShaped(bad)).toBe(false);
  });

  it("rejects an absurdly long address", () => {
    expect(isEmailShaped(`${"a".repeat(250)}@example.com`)).toBe(false);
  });
});

describe("displayNameOf", () => {
  const blank = {
    display_name: null,
    first_name: null,
    username: null,
    email: null,
  };

  it("prefers the chosen display name", () => {
    expect(
      displayNameOf({ ...blank, display_name: "Aniket", first_name: "A" }),
    ).toBe("Aniket");
  });

  it("falls back through Telegram's names, then the email handle", () => {
    expect(displayNameOf({ ...blank, first_name: "Aniket" })).toBe("Aniket");
    expect(displayNameOf({ ...blank, username: "aniket054" })).toBe(
      "aniket054",
    );
    expect(displayNameOf({ ...blank, email: "aniket@example.com" })).toBe(
      "aniket",
    );
  });

  it("always has something to call someone", () => {
    expect(displayNameOf(blank)).toBe("You");
  });
});

describe("link codes", () => {
  it("are six readable characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateLinkCode();
      expect(code).toHaveLength(6);
      // No 0/O/1/I/L — these get read off one screen and typed into another.
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("recognise their own shape, case-insensitively", () => {
    const code = generateLinkCode();
    expect(isLinkCodeShaped(code)).toBe(true);
    expect(isLinkCodeShaped(code.toLowerCase())).toBe(true);
    expect(isLinkCodeShaped("ABC12")).toBe(false);
    expect(isLinkCodeShaped("ABCI23")).toBe(false); // I isn't in the alphabet
  });
});

describe("sign-in codes", () => {
  const secret = "test-secret";
  const future = () => new Date(Date.now() + 60_000).toISOString();
  const record = (over: Partial<StoredCode> = {}): StoredCode => ({
    id: "r1",
    code_hash: hashCode("a@b.co", "123456", secret),
    expires_at: future(),
    attempts: 0,
    consumed_at: null,
    ...over,
  });

  it("generates a padded numeric code", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(code).toMatch(/^\d+$/);
    }
  });

  it("binds the hash to the address, so a code can't be reused elsewhere", () => {
    expect(hashCode("a@b.co", "123456", secret)).not.toBe(
      hashCode("other@b.co", "123456", secret),
    );
  });

  it("binds the hash to the app secret", () => {
    expect(hashCode("a@b.co", "123456", secret)).not.toBe(
      hashCode("a@b.co", "123456", "different-secret"),
    );
  });

  it("accepts the right code", () => {
    expect(checkCode(record(), hashCode("a@b.co", "123456", secret))).toEqual({
      ok: true,
    });
  });

  it("rejects the wrong code", () => {
    const verdict = checkCode(record(), hashCode("a@b.co", "999999", secret));
    expect(verdict).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects an expired code", () => {
    const stale = record({
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(checkCode(stale, stale.code_hash)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a code that was already used", () => {
    const used = record({ consumed_at: new Date().toISOString() });
    expect(checkCode(used, used.code_hash)).toEqual({
      ok: false,
      reason: "used",
    });
  });

  it("stops after too many wrong guesses, even if the code is then right", () => {
    const burned = record({ attempts: MAX_ATTEMPTS });
    expect(checkCode(burned, burned.code_hash)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
  });

  it("rejects when there is no code on file at all", () => {
    expect(checkCode(null, "whatever")).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  it("rate-limits repeated requests for one address", () => {
    expect(isRateLimited(4)).toBe(false);
    expect(isRateLimited(5)).toBe(true);
  });
});

describe("quotas", () => {
  it("allows usage below the limit and blocks at it", () => {
    expect(evaluate(0, 40, "llm_vision").allowed).toBe(true);
    expect(evaluate(39, 40, "llm_vision").allowed).toBe(true);
    expect(evaluate(40, 40, "llm_vision").allowed).toBe(false);
  });

  it("explains itself when it blocks, and suggests what still works", () => {
    const blocked = evaluate(40, 40, "llm_vision");
    expect(blocked.message).toContain("type the amount");
    expect(evaluate(0, 40, "llm_vision").message).toBeNull();
  });

  it("reports what's left", () => {
    expect(evaluate(12, 40, "llm_vision").remaining).toBe(28);
    expect(evaluate(99, 40, "llm_vision").remaining).toBe(0);
  });

  it("has a default for every kind", () => {
    for (const kind of ["llm_text", "llm_vision", "voice", "ingest"] as const) {
      expect(limitFor(kind)).toBeGreaterThan(0);
    }
  });
});
