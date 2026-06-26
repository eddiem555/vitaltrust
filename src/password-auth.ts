import crypto from "crypto";
import fs from "fs";
import path from "path";

const SHA256_HEX = /^[a-f0-9]{64}$/i;
const LOCAL_AUTH_CONFIG_FILE = "local_auth_config.json";

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

function localAuthConfigPath(): string {
  return path.join(process.cwd(), LOCAL_AUTH_CONFIG_FILE);
}

function readFileBackedDefaultHash(): string | null {
  try {
    const configPath = localAuthConfigPath();
    if (!fs.existsSync(configPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const value = String(parsed?.defaultPasswordSha256 || "").trim().toLowerCase();
    if (!value || !isSha256PasswordHash(value)) return null;
    return value;
  } catch {
    return null;
  }
}

let fileBackedDefaultHash: string | null = readFileBackedDefaultHash();

export function getDefaultPasswordSha256(): string | null {
  const fromEnv = (process.env.DEFAULT_PASSWORD_SHA256 || "").trim().toLowerCase();
  if (fromEnv && isSha256PasswordHash(fromEnv)) return fromEnv;
  if (fileBackedDefaultHash && isSha256PasswordHash(fileBackedDefaultHash)) return fileBackedDefaultHash;
  return null;
}

export function isDefaultPasswordConfigured(): boolean {
  return getDefaultPasswordSha256() !== null;
}

/** Persist bootstrap default password hash when .env is not used. */
export function persistBootstrapPasswordHash(hash: string): void {
  const normalized = hash.trim().toLowerCase();
  if (!isSha256PasswordHash(normalized)) {
    throw new Error("Invalid SHA-256 password hash");
  }
  const configPath = localAuthConfigPath();
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        defaultPasswordSha256: normalized,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
  fileBackedDefaultHash = normalized;
}

export function countPasswordCharacterClasses(password: string): number {
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^A-Za-z0-9]/.test(password)) classes++;
  return classes;
}

/** Lab default password policy: 8+ chars and at least 3 character classes. */
export function validateDefaultPasswordPolicy(password: string): { ok: true } | { ok: false; message: string } {
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (countPasswordCharacterClasses(password) < 3) {
    return {
      ok: false,
      message: "Password must include at least 3 of: lowercase, uppercase, number, symbol.",
    };
  }
  return { ok: true };
}
