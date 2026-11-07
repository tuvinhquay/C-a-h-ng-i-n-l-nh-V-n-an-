import type { Snapshot, SyncCollection, SyncDocument, SyncTombstone } from "@/lib/types";

type Identified = { id: string };

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

function mergeRows<T extends Identified>(
  local: T[],
  remote: T[],
  timestamp: (item: T) => string,
): T[] {
  const merged = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    const current = merged.get(item.id);
    if (!current) {
      merged.set(item.id, item);
      continue;
    }
    const difference = timestamp(item).localeCompare(timestamp(current));
    if (difference > 0 || (difference === 0 && serialized(item) > serialized(current))) {
      merged.set(item.id, item);
    }
  }
  return [...merged.values()];
}

const updated = <T extends { updatedAt?: string; createdAt?: string }>(item: T) =>
  item.updatedAt ?? item.createdAt ?? "";

function mergeTombstones(local: SyncTombstone[], remote: SyncTombstone[]): SyncTombstone[] {
  const merged = new Map<string, SyncTombstone>();
  for (const item of [...local, ...remote]) {
    const key = `${item.collection}:${item.id}`;
    const current = merged.get(key);
    if (!current || item.deletedAt > current.deletedAt) merged.set(key, item);
  }
  return [...merged.values()];
}

function removeDeleted<T extends Identified>(items: T[], deleted: Set<string>): T[] {
  return items.filter((item) => !deleted.has(item.id));
}

function mergedSettings(local: Snapshot["settings"], remote: Snapshot["settings"]): Snapshot["settings"] {
  const selected =
    (local.updatedAt ?? "") > (remote.updatedAt ?? "") ||
    (local.updatedAt ?? "") === (remote.updatedAt ?? "") && serialized(local) > serialized(remote)
      ? local
      : remote;
  return {
    ...selected,
    nextRepair: Math.max(local.nextRepair, remote.nextRepair),
    nextQuote: Math.max(local.nextQuote, remote.nextQuote),
    nextInvoice: Math.max(local.nextInvoice, remote.nextInvoice),
    nextSku: Math.max(local.nextSku, remote.nextSku),
    lastBackupAt: [local.lastBackupAt, remote.lastBackupAt].filter(Boolean).sort().at(-1) ?? null,
  };
}

export function mergeSyncDocuments(local: SyncDocument, remote: SyncDocument): SyncDocument {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones);
  const deletedByCollection = new Map<SyncCollection, Set<string>>();
  for (const entry of tombstones) {
    const deleted = deletedByCollection.get(entry.collection) ?? new Set<string>();
    deleted.add(entry.id);
    deletedByCollection.set(entry.collection, deleted);
  }
  const localSnapshot = local.snapshot;
  const remoteSnapshot = remote.snapshot;
  const moves = mergeRows(localSnapshot.moves, remoteSnapshot.moves, updated);
  const parts = removeDeleted(
    mergeRows(localSnapshot.parts, remoteSnapshot.parts, updated),
    deletedByCollection.get("parts") ?? new Set(),
  ).map((part) => {
    const balance = moves
      .filter((move) => move.partId === part.id)
      .reduce((sum, move) => sum + move.qtyChange, 0);
    return { ...part, stock: Math.round(balance * 1000) / 1000 };
  });

  const snapshot: Snapshot = {
    settings: mergedSettings(localSnapshot.settings, remoteSnapshot.settings),
    parts,
    moves,
    customers: removeDeleted(
      mergeRows(localSnapshot.customers, remoteSnapshot.customers, updated),
      deletedByCollection.get("customers") ?? new Set(),
    ),
    repairs: removeDeleted(
      mergeRows(localSnapshot.repairs, remoteSnapshot.repairs, updated),
      deletedByCollection.get("repairs") ?? new Set(),
    ),
    quotes: removeDeleted(
      mergeRows(localSnapshot.quotes, remoteSnapshot.quotes, updated),
      deletedByCollection.get("quotes") ?? new Set(),
    ),
    invoices: removeDeleted(
      mergeRows(
        localSnapshot.invoices,
        remoteSnapshot.invoices,
        (invoice) => invoice.voidedAt ?? invoice.createdAt,
      ),
      deletedByCollection.get("invoices") ?? new Set(),
    ),
  };

  return { snapshot, tombstones };
}

export function findSyncConflicts(document: SyncDocument): string[] {
  const issues: string[] = [];
  const negativeParts = document.snapshot.parts.filter((part) => part.stock < 0);
  if (negativeParts.length) {
    issues.push(`Có ${negativeParts.length} linh kiện bị xuất vượt tồn do thao tác đồng thời.`);
  }
  const duplicateSkus = new Set<string>();
  const seenSkus = new Set<string>();
  for (const part of document.snapshot.parts) {
    const sku = part.sku.trim().toLocaleLowerCase();
    if (seenSkus.has(sku)) duplicateSkus.add(part.sku);
    seenSkus.add(sku);
  }
  if (duplicateSkus.size) {
    issues.push(`Mã linh kiện bị trùng sau khi đồng bộ: ${[...duplicateSkus].join(", ")}.`);
  }
  for (const [label, rows] of [
    ["phiếu sửa", document.snapshot.repairs],
    ["báo giá", document.snapshot.quotes],
    ["hóa đơn", document.snapshot.invoices],
  ] as const) {
    const seenCodes = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of rows) {
      if (seenCodes.has(row.code)) duplicates.add(row.code);
      seenCodes.add(row.code);
    }
    if (duplicates.size) issues.push(`Số ${label} bị trùng: ${[...duplicates].join(", ")}.`);
  }
  return issues;
}
