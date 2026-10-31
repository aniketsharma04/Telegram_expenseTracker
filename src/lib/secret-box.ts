import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption at rest for credentials we hold on a user's behalf (Gmail
 * refresh tokens, a user's own Gemini key). RLS already keeps them away from
 * clients; this keeps them unreadable in a leaked backup or service-role dump.
 *
 * AES-256-GCM with a random 96-bit IV. Stored as `enc:v1:<iv>.<tag>.<data>`
 * (base64url). Key: DATA_ENCRYPTION_KEY, 32 bytes as base64 or hex.
 *
 * Rows written before the key existed stay plain text and still read fine;
 * callers re-save them encrypted the next time they're read.
 */

const PREFIX = "enc:v1:";

export function encryptionKey(
  raw: string | undefined = process.env.DATA_ENCRYPTION_KEY,
): Buffer | null {
  const value = raw?.trim();
  if (!value) return null;
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  return key;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** Encrypt, or return the value unchanged when no key is configured. */
export function seal(
  plain: string,
  key: Buffer | null = encryptionKey(),
): string {
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const parts = [iv, cipher.getAuthTag(), data].map((b) =>
    b.toString("base64url"),
  );
  return PREFIX + parts.join(".");
}

/** Decrypt a sealed value; plain (legacy) values pass through. */
export function open(
  stored: string,
  key: Buffer | null = encryptionKey(),
): string {
  if (!isSealed(stored)) return stored;
  if (!key)
    throw new Error(
      "DATA_ENCRYPTION_KEY is not set, so a sealed value can't be read",
    );
  const [iv, tag, data] = stored
    .slice(PREFIX.length)
    .split(".")
    .map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("sealed value is malformed");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

/** A plain value that should be re-saved sealed, now that a key exists. */
export function needsSealing(
  stored: string,
  key: Buffer | null = encryptionKey(),
): boolean {
  return Boolean(key) && !isSealed(stored);
}
