import assert from "node:assert/strict";
import test from "node:test";
import { findSyncConflicts, mergeSyncDocuments } from "./sync.ts";
import type { Part, Snapshot, StockMove, SyncDocument } from "./types";

function part(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-1",
    sku: "LK-0001",
    name: "Quạt dàn lạnh",
    machineType: "Tủ lạnh",
    brand: "LG",
    color: "",
    location: "",
    unit: "Cái",
    costPrice: 0,
    sellPrice: 0,
    stock: 5,
    minStock: 0,
    note: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stockMove(id: string, qtyChange: number): StockMove {
  return {
    id,
    partId: "part-1",
    partName: "Quạt dàn lạnh",
    sku: "LK-0001",
    type: qtyChange < 0 ? "out" : "in",
    qtyChange,
    stockBefore: 0,
    stockAfter: 0,
    note: "",
    refType: "manual",
    refId: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  };
}

function document(snapshot: Partial<Snapshot> = {}, tombstones: SyncDocument["tombstones"] = []): SyncDocument {
  return {
    snapshot: {
      settings: {
        shopName: "Vân An",
        ownerName: "",
        phone: "",
        address: "",
        taxCode: "",
        invoiceNote: "",
        nextRepair: 1,
        nextQuote: 1,
        nextInvoice: 1,
        nextSku: 1,
        lastBackupAt: null,
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
      parts: [],
      moves: [],
      customers: [],
      repairs: [],
      quotes: [],
      invoices: [],
      ...snapshot,
    },
    tombstones,
  };
}

test("merges independent stock movements and applies deletion tombstones", () => {
  const initialMove = stockMove("opening", 5);
  const local = document({ parts: [part()], moves: [initialMove] });
  const remote = document(
    { parts: [part()], moves: [initialMove, stockMove("sale", -2)] },
    [{ collection: "customers", id: "gone", deletedAt: "2025-01-02T00:00:00.000Z" }],
  );
  const merged = mergeSyncDocuments(local, remote);

  assert.equal(merged.snapshot.parts[0]?.stock, 3);
  assert.equal(merged.snapshot.moves.length, 2);
  assert.equal(merged.tombstones[0]?.id, "gone");
});

test("preserves oversell conflicts instead of hiding negative merged stock", () => {
  const opening = stockMove("opening", 5);
  const local = document({ parts: [part()], moves: [opening, stockMove("local-out", -4)] });
  const remote = document({ parts: [part()], moves: [opening, stockMove("remote-out", -4)] });
  const merged = mergeSyncDocuments(local, remote);

  assert.equal(merged.snapshot.parts[0]?.stock, -3);
  assert.match(findSyncConflicts(merged)[0] ?? "", /xuất vượt tồn/);
});

test("keeps the most recently edited copy of the same record", () => {
  const local = document({ parts: [part({ name: "Tên cũ" })] });
  const remote = document({
    parts: [part({ name: "Tên mới", updatedAt: "2025-01-03T00:00:00.000Z" })],
  });

  assert.equal(mergeSyncDocuments(local, remote).snapshot.parts[0]?.name, "Tên mới");
});
