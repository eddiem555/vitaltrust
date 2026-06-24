import crypto from "crypto";

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/** SHA-256 hex digest of UTF-8 password (no salt). */
export function hashPassword(plainText: string): string {
  return crypto.createHash("sha256").update(plainText, "utf8").digest("hex");
}

export function isSha256PasswordHash(value: string): boolean {
  return SHA256_HEX.test(value);
}

/** Compare entered password to stored SHA-256 hash (supports legacy plaintext rows). */
export function verifyPassword(plainText: string, stored: string): boolean {
  if (!stored) return false;
  const hashed = hashPassword(plainText);
  if (stored === hashed) return true;
  if (!isSha256PasswordHash(stored) && stored === plainText) return true;
  return false;
}

export function getDefaultPasswordSha256(): string | null {
  const value = (process.env.DEFAULT_PASSWORD_SHA256 || "").trim().toLowerCase();
  if (!value || !isSha256PasswordHash(value)) return null;
  return value;
}

export function isDefaultPasswordConfigured(): boolean {
  return getDefaultPasswordSha256() !== null;
}
