import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptionKey,
  isSealed,
  needsSealing,
  open,
  seal,
} from "./secret-box";

const key = randomBytes(32);

describe("secret-box", () => {
  it("round-trips a value", () => {
    const sealed = seal("1//refresh-token", key);
    expect(isSealed(sealed)).toBe(true);
    expect(sealed).not.toContain("refresh-token");
    expect(open(sealed, key)).toBe("1//refresh-token");
  });

  it("uses a fresh IV every time", () => {
    expect(seal("same", key)).not.toBe(seal("same", key));
  });

  it("passes plain legacy values through", () => {
    expect(open("AIzaPlainKey", key)).toBe("AIzaPlainKey");
    expect(needsSealing("AIzaPlainKey", key)).toBe(true);
    expect(needsSealing(seal("x", key), key)).toBe(false);
  });

  it("stores plain text when no key is configured", () => {
    expect(seal("x", null)).toBe("x");
    expect(needsSealing("x", null)).toBe(false);
  });

  it("refuses a wrong key or a tampered value", () => {
    const sealed = seal("secret", key);
    expect(() => open(sealed, randomBytes(32))).toThrow();
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => open(tampered, key)).toThrow();
    expect(() => open(sealed, null)).toThrow(/DATA_ENCRYPTION_KEY/);
  });

  it("reads the key as base64 or hex and checks its length", () => {
    expect(encryptionKey(key.toString("base64"))?.equals(key)).toBe(true);
    expect(encryptionKey(key.toString("hex"))?.equals(key)).toBe(true);
    expect(encryptionKey("")).toBeNull();
    expect(() => encryptionKey("c2hvcnQ=")).toThrow(/32 bytes/);
  });
});
