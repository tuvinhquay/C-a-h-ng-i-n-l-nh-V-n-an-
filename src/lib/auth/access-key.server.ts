import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 32;
const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_FAILED_ATTEMPTS = 5;

function deriveKey(value: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(value, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export function generateAccessKey(): string {
  const key = Array.from(randomBytes(32), (byte) => KEY_ALPHABET[byte & 31]).join("");
  return key.match(/.{4}/g)?.join("-") ?? key;
}

export function normalizeAccessKey(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function generateSetupToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSetupToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifySetupToken(token: string, storedHash: string): boolean {
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashSetupToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function hashAccessKey(value: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16);
  const hash = await deriveKey(normalizeAccessKey(value), salt);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function verifyAccessKey(
  value: string,
  saltHex: string,
  hashHex: string,
): Promise<boolean> {
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(normalizeAccessKey(value), salt);
  return timingSafeEqual(actual, expected);
}

export function newInternalEmail(): string {
  return `access-${randomUUID()}@login.vanan.invalid`;
}

export const accessKeyLimits = {
  failedAttempts: MAX_FAILED_ATTEMPTS,
  windowMinutes: 15,
} as const;
