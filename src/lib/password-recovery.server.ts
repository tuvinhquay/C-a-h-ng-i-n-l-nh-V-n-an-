import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { normalizeRecoveryAnswer, type RecoveryEntry } from "./password-recovery.ts";

const KEY_LENGTH = 32;

export type HashedRecoveryEntry = {
  questionId: string;
  salt: string;
  hash: string;
};

function deriveKey(answer: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(answer, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashRecoveryAnswer(answer: string): Promise<{
  salt: string;
  hash: string;
}> {
  const salt = randomBytes(16);
  const hash = await deriveKey(normalizeRecoveryAnswer(answer), salt);
  return { salt: salt.toString("hex"), hash: hash.toString("hex") };
}

export async function hashRecoveryEntries(
  entries: RecoveryEntry[],
): Promise<HashedRecoveryEntry[]> {
  return Promise.all(
    entries.map(async (entry) => ({
      questionId: entry.questionId,
      ...(await hashRecoveryAnswer(entry.answer)),
    })),
  );
}

export async function verifyRecoveryAnswer(
  answer: string,
  saltHex: string,
  hashHex: string,
): Promise<boolean> {
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
  const actual = await deriveKey(normalizeRecoveryAnswer(answer), salt);
  return timingSafeEqual(actual, expected);
}
