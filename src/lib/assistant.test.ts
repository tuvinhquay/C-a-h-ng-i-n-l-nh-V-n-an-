import assert from "node:assert/strict";
import test from "node:test";
import { findPart, identifyIntent, isGreeting, parseTaughtPart } from "./assistant.ts";
import type { Part } from "./types";

const taught = "LG M31UII màu đen số lượng còn 13 cái. Vị trí đang để khu vực A3 kệ số 5 ngăn số 2";
const question = "Tủ lạnh LG M31UII còn bao nhiêu cái?";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    sku: "LK-0001",
    name: "M31UII",
    machineType: "Tủ lạnh",
    brand: "LG",
    color: "đen",
    location: "khu vực A3 kệ số 5 ngăn số 2",
    unit: "Cái",
    costPrice: 0,
    sellPrice: 0,
    stock: 13,
    minStock: 0,
    note: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("recognizes stock, low-stock, repair and fallback intents in Vietnamese", () => {
  assert.equal(identifyIntent(question), "stock");
  assert.equal(identifyIntent("Linh kiện nào sắp hết?"), "low-stock");
  assert.equal(identifyIntent("Có bao nhiêu phiếu sửa đang chờ?"), "repair");
  assert.equal(identifyIntent("Bạn giúp được gì?"), "help");
  assert.equal(isGreeting("Xin chào trợ lý"), true);
});

test("parses the example teaching message into an inventory record", () => {
  assert.deepEqual(parseTaughtPart(taught, question), {
    quantity: 13,
    brand: "LG",
    name: "M31UII",
    machineType: "Tủ lạnh",
    color: "đen",
    location: "khu vực A3 kệ số 5 ngăn số 2",
  });
});

test("keeps product identity from the question when a clarification only supplies quantity", () => {
  assert.deepEqual(parseTaughtPart("số lượng còn 13 cái", question), {
    quantity: 13,
    brand: "LG",
    name: "M31UII",
    machineType: "Tủ lạnh",
    color: "",
    location: "",
  });
});

test("matches model and brand without accents and asks when results are ambiguous", () => {
  const match = findPart(question, [makePart()]);
  assert.equal(match.part?.id, "part-1");

  const ambiguous = findPart(question, [makePart(), makePart({ id: "part-2", sku: "LK-0002" })]);
  assert.equal(ambiguous.part, null);
  assert.equal(ambiguous.ambiguous.length, 2);
});
