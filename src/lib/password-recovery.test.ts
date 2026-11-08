import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRecoveryAnswer, parseRecoveryEntries } from "./password-recovery.ts";
import { hashRecoveryAnswer, verifyRecoveryAnswer } from "./password-recovery.server.ts";

test("normalizes Vietnamese answers consistently", () => {
  assert.equal(normalizeRecoveryAnswer("  Cửa Hàng   Vân An "), "cua hang van an");
  assert.equal(normalizeRecoveryAnswer("Dien lanh"), "dien lanh");
});

test("accepts one or two distinct configured recovery questions", () => {
  assert.equal(
    parseRecoveryEntries([{ questionId: "first_store", answer: "  Van An " }])?.length,
    1,
  );
  assert.equal(
    parseRecoveryEntries([
      { questionId: "first_store", answer: "Vân An" },
      { questionId: "internal_code", answer: "VA-89" },
    ])?.length,
    2,
  );
  assert.equal(
    parseRecoveryEntries([
      { questionId: "first_store", answer: "Vân An" },
      { questionId: "first_store", answer: "Khác" },
    ]),
    null,
  );
  assert.equal(parseRecoveryEntries([{ questionId: "unknown", answer: "answer" }]), null);
  assert.equal(parseRecoveryEntries([{ questionId: "first_store", answer: "ab" }]), null);
});

test("recovery answers are stored as salted hashes and verify normalized input", async () => {
  const saved = await hashRecoveryAnswer("Cửa Hàng Vân An");
  assert.notEqual(saved.hash, "Cửa Hàng Vân An");
  assert.equal(await verifyRecoveryAnswer(" cua hang van an ", saved.salt, saved.hash), true);
  assert.equal(await verifyRecoveryAnswer("Cửa hàng khác", saved.salt, saved.hash), false);
});
