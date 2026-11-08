import assert from "node:assert/strict";
import test from "node:test";
import {
  generateAccessKey,
  generateSetupToken,
  hashAccessKey,
  hashSetupToken,
  normalizeAccessKey,
  verifyAccessKey,
  verifySetupToken,
} from "./access-key.server.ts";

test("generates grouped access keys and normalizes separators and case", () => {
  const key = generateAccessKey();
  assert.match(key, /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){7}$/);
  assert.equal(normalizeAccessKey(key.toLowerCase()), key.replaceAll("-", ""));
});

test("stores access keys as salted hashes and verifies the normalized code", async () => {
  const key = generateAccessKey();
  const stored = await hashAccessKey(key);
  assert.equal(await verifyAccessKey(key.toLowerCase().replaceAll("-", " "), stored.salt, stored.hash), true);
  assert.equal(await verifyAccessKey(generateAccessKey(), stored.salt, stored.hash), false);
});

test("setup tokens are random and only their hash is persisted", () => {
  const token = generateSetupToken();
  const hash = hashSetupToken(token);
  assert.equal(token.length >= 40, true);
  assert.equal(hash.length, 64);
  assert.equal(verifySetupToken(token, hash), true);
  assert.equal(verifySetupToken(generateSetupToken(), hash), false);
});
