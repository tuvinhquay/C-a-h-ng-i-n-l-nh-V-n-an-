/**
 * Kho dữ liệu cục bộ IndexedDB "so-dien-lanh".
 *
 * Cửa hàng:
 * - parts, moves, customers, repairs, quotes, invoices (keyPath: id)
 * - meta: bản ghi "settings"
 *
 * Mọi thao tác đổi tồn kho chạy trong một transaction. Nếu thiếu hàng, transaction
 * bị hủy và không trừ dở từng linh kiện.
 */

import { buildBackup, parseBackup } from "@/lib/backup";
import { addMonths, codeOf, nowIso, todayISO, uid } from "@/lib/format";
import type {
  BackupFile,
  Customer,
  CustomerInput,
  Invoice,
  LineItem,
  Part,
  PartInput,
  Quote,
  QuoteInput,
  Repair,
  RepairInput,
  SaleInput,
  Settings,
  Snapshot,
  StockMove,
  SyncCollection,
  SyncTombstone,
} from "@/lib/types";

const DB_NAME = "so-dien-lanh";
const DB_VERSION = 1;
const DATA_STORES = ["parts", "moves", "customers", "repairs", "quotes", "invoices"] as const;
const ALL_STORES = [...DATA_STORES, "meta"] as const;
type StoreName = (typeof ALL_STORES)[number];
const TOMBSTONES_KEY = "sync-tombstones";
const DEVICE_KEY = "device-identity";

export class ShopError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopError";
  }
}

export function defaultSettings(): Settings {
  return {
    shopName: "Xưởng điện lạnh",
    ownerName: "",
    phone: "",
    address: "",
    taxCode: "",
    invoiceNote: "Cảm ơn quý khách. Bảo hành theo thời hạn ghi trên hóa đơn, không áp dụng với cháy nổ, vào nước hoặc tác động bên ngoài.",
    nextRepair: 1,
    nextQuote: 1,
    nextInvoice: 1,
    nextSku: 1,
    lastBackupAt: null,
    updatedAt: nowIso(),
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new ShopError("Trình duyệt không cho lưu dữ liệu trên máy. Hãy tắt chế độ ẩn danh."));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of DATA_STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new ShopError("Không mở được dữ liệu trên máy."));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function ask<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new ShopError("Lỗi đọc dữ liệu."));
  });
}

async function withTx<T>(names: readonly StoreName[], mode: IDBTransactionMode, fn: (stores: Record<StoreName, IDBObjectStore>) => Promise<T>): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(names as string[], mode);
  const stores = {} as Record<StoreName, IDBObjectStore>;
  for (const name of names) stores[name] = tx.objectStore(name);

  return new Promise<T>((resolve, reject) => {
    let result!: T;
    let done = false;
    let reason: unknown = null;
    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      if (error) reject(error instanceof Error ? error : new ShopError("Không lưu được dữ liệu."));
      else resolve(result);
    };
    tx.oncomplete = () => finish(reason ?? undefined);
    tx.onerror = () => finish(reason ?? tx.error ?? new ShopError("Lỗi lưu dữ liệu."));
    tx.onabort = () => finish(reason ?? tx.error ?? new ShopError("Đã hủy thao tác."));
    fn(stores)
      .then((value) => {
        result = value;
      })
      .catch((error: unknown) => {
        reason = error instanceof Error ? error : new ShopError("Không lưu được dữ liệu.");
        try {
          tx.abort();
        } catch {
          finish(reason);
        }
      });
  });
}

async function readSettings(meta: IDBObjectStore): Promise<Settings> {
  const current = await ask<Settings | undefined>(meta.get("settings"));
  if (current) return current;
  const fresh = defaultSettings();
  await ask(meta.put(fresh, "settings"));
  return fresh;
}

async function writeSettings(meta: IDBObjectStore, settings: Settings): Promise<void> {
  await ask(meta.put(settings, "settings"));
}

function cleanLines(lines: LineItem[]): LineItem[] {
  return lines
    .filter((line) => line.name.trim() && line.qty > 0)
    .map((line) => ({
      ...line,
      id: line.id || uid(),
      name: line.name.trim(),
      unit: line.unit.trim() || "Cái",
      partId: line.kind === "part" ? line.partId : null,
      qty: Math.round(line.qty * 1000) / 1000,
      unitPrice: Math.round(line.unitPrice),
    }));
}

function takeCode(settings: Settings, key: "nextRepair" | "nextQuote" | "nextInvoice" | "nextSku", prefix: string, used: Set<string>): string {
  let code = "";
  do {
    code = codeOf(prefix, settings[key]);
    settings[key] += 1;
  } while (used.has(code));
  return code;
}

async function loadPart(store: IDBObjectStore, partId: string): Promise<Part> {
  const part = await ask<Part | undefined>(store.get(partId));
  if (!part) throw new ShopError("Một linh kiện trong phiếu không còn trong kho.");
  return part;
}

/** Trừ hoặc cộng tồn. qtyChange âm = xuất. Ghi một dòng lịch sử. */
async function applyDelta(
  stores: Record<StoreName, IDBObjectStore>,
  partId: string,
  qtyChange: number,
  meta: { type: StockMove["type"]; note: string; refType: StockMove["refType"]; refId: string | null },
): Promise<StockMove> {
  const part = await loadPart(stores.parts, partId);
  const before = part.stock;
  const after = Math.round((before + qtyChange) * 1000) / 1000;
  if (after < -0.0001) {
    throw new ShopError(`${part.name} chỉ còn ${before} ${part.unit}, không đủ để xuất.`);
  }
  part.stock = Math.max(0, after);
  part.updatedAt = nowIso();
  await ask(stores.parts.put(part));
  const move: StockMove = {
    id: uid(),
    partId: part.id,
    partName: part.name,
    sku: part.sku,
    type: meta.type,
    qtyChange,
    stockBefore: before,
    stockAfter: part.stock,
    note: meta.note,
    refType: meta.refType,
    refId: meta.refId,
    createdAt: part.updatedAt,
  };
  await ask(stores.moves.put(move));
  return move;
}

function groupPartQty(lines: LineItem[]): Map<string, { qty: number; name: string }> {
  const map = new Map<string, { qty: number; name: string }>();
  for (const line of lines) {
    if (line.kind !== "part" || !line.partId || line.qty <= 0) continue;
    const current = map.get(line.partId);
    if (current) current.qty = Math.round((current.qty + line.qty) * 1000) / 1000;
    else map.set(line.partId, { qty: line.qty, name: line.name });
  }
  return map;
}

async function issueParts(
  stores: Record<StoreName, IDBObjectStore>,
  lines: LineItem[],
  meta: { note: string; refType: StockMove["refType"]; refId: string },
): Promise<void> {
  for (const [partId, item] of groupPartQty(lines)) {
    await applyDelta(stores, partId, -item.qty, {
      type: "out",
      note: meta.note,
      refType: meta.refType,
      refId: meta.refId,
    });
  }
}

async function returnParts(
  stores: Record<StoreName, IDBObjectStore>,
  lines: LineItem[],
  meta: { note: string; refType: StockMove["refType"]; refId: string },
): Promise<void> {
  for (const [partId, item] of groupPartQty(lines)) {
    const exists = await ask<Part | undefined>(stores.parts.get(partId));
    if (!exists) continue;
    await applyDelta(stores, partId, item.qty, {
      type: "in",
      note: meta.note,
      refType: meta.refType,
      refId: meta.refId,
    });
  }
}

function sortSnapshot(snapshot: Snapshot): Snapshot {
  const byName = <T extends { name: string }>(list: T[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const byTimeDesc = <T extends { createdAt: string }>(list: T[]) =>
    [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    settings: snapshot.settings,
    parts: byName(snapshot.parts),
    customers: byName(snapshot.customers),
    moves: byTimeDesc(snapshot.moves),
    repairs: [...snapshot.repairs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    quotes: [...snapshot.quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    invoices: byTimeDesc(snapshot.invoices),
  };
}

export async function loadSnapshot(): Promise<Snapshot> {
  return withTx(ALL_STORES, "readwrite", async (stores) => {
    const settings = await readSettings(stores.meta);
    const [parts, moves, customers, repairs, quotes, invoices] = await Promise.all([
      ask<Part[]>(stores.parts.getAll()),
      ask<StockMove[]>(stores.moves.getAll()),
      ask<Customer[]>(stores.customers.getAll()),
      ask<Repair[]>(stores.repairs.getAll()),
      ask<Quote[]>(stores.quotes.getAll()),
      ask<Invoice[]>(stores.invoices.getAll()),
    ]);
    const compatibleParts = parts.map((part) => ({
      ...part,
      color: part.color ?? "",
      location: part.location ?? "",
    }));
    return sortSnapshot({ settings, parts: compatibleParts, moves, customers, repairs, quotes, invoices });
  });
}

export async function loadTombstones(): Promise<SyncTombstone[]> {
  return withTx(["meta"], "readonly", async ({ meta }) => {
    const items = await ask<SyncTombstone[] | undefined>(meta.get(TOMBSTONES_KEY));
    return items ?? [];
  });
}

export async function getDeviceIdentity(): Promise<{ id: string; name: string }> {
  return withTx(["meta"], "readwrite", async ({ meta }) => {
    const stored = await ask<{ id: string; name: string } | undefined>(meta.get(DEVICE_KEY));
    if (stored) return stored;
    const id = uid();
    const identity = { id, name: `Thiết bị ${id.slice(0, 4)}` };
    await ask(meta.put(identity, DEVICE_KEY));
    return identity;
  });
}

async function addTombstone(meta: IDBObjectStore, collection: SyncCollection, id: string): Promise<void> {
  const current = (await ask<SyncTombstone[] | undefined>(meta.get(TOMBSTONES_KEY))) ?? [];
  const next = current.filter((entry) => entry.collection !== collection || entry.id !== id);
  next.push({ collection, id, deletedAt: nowIso() });
  await ask(meta.put(next, TOMBSTONES_KEY));
}

export async function savePart(input: PartInput, id?: string): Promise<Part> {
  const name = input.name.trim();
  if (!name) throw new ShopError("Hãy nhập tên linh kiện.");
  if (input.openingStock < 0 || input.minStock < 0) throw new ShopError("Tồn kho không được âm.");
  return withTx(["parts", "moves", "meta"], "readwrite", async (stores) => {
    const all = await ask<Part[]>(stores.parts.getAll());
    const settings = await readSettings(stores.meta);
    const sku = input.sku.trim() || takeCode(settings, "nextSku", "LK", new Set(all.map((item) => item.sku)));
    if (all.some((item) => item.sku.toLowerCase() === sku.toLowerCase() && item.id !== id)) {
      throw new ShopError(`Mã ${sku} đã có trong kho.`);
    }
    const now = nowIso();
    if (!id) {
      const part: Part = {
        id: uid(),
        sku,
        name,
        machineType: input.machineType.trim(),
        brand: input.brand.trim(),
        color: input.color.trim(),
        location: input.location.trim(),
        unit: input.unit.trim() || "Cái",
        costPrice: Math.round(input.costPrice),
        sellPrice: Math.round(input.sellPrice),
        stock: input.openingStock,
        minStock: input.minStock,
        note: input.note.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await ask(stores.parts.put(part));
      await writeSettings(stores.meta, settings);
      if (part.stock > 0) {
        const move: StockMove = {
          id: uid(),
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          type: "in",
          qtyChange: part.stock,
          stockBefore: 0,
          stockAfter: part.stock,
          note: "Tồn đầu khi tạo danh mục",
          refType: "opening",
          refId: null,
          createdAt: now,
        };
        await ask(stores.moves.put(move));
      }
      return part;
    }
    const current = await ask<Part | undefined>(stores.parts.get(id));
    if (!current) throw new ShopError("Không tìm thấy linh kiện.");
    const next: Part = {
      ...current,
      sku,
      name,
      machineType: input.machineType.trim(),
      brand: input.brand.trim(),
      color: input.color.trim(),
      location: input.location.trim(),
      unit: input.unit.trim() || "Cái",
      costPrice: Math.round(input.costPrice),
      sellPrice: Math.round(input.sellPrice),
      minStock: input.minStock,
      note: input.note.trim(),
      updatedAt: now,
    };
    await ask(stores.parts.put(next));
    await writeSettings(stores.meta, settings);
    return next;
  });
}

export async function removePart(id: string): Promise<void> {
  return withTx(["parts", "repairs", "meta"], "readwrite", async (stores) => {
    const part = await ask<Part | undefined>(stores.parts.get(id));
    if (!part) return;
    if (part.stock > 0) throw new ShopError("Hãy xuất hết hoặc kiểm kê về 0 trước khi xóa linh kiện.");
    const repairs = await ask<Repair[]>(stores.repairs.getAll());
    const blocked = repairs.some(
      (repair) => repair.status === "open" && repair.lines.some((line) => line.partId === id),
    );
    if (blocked) throw new ShopError("Linh kiện đang nằm trong phiếu sửa chưa xong.");
    await addTombstone(stores.meta, "parts", id);
    await ask(stores.parts.delete(id));
  });
}

export async function postStock(input: {
  partId: string;
  mode: "in" | "out" | "count";
  qty: number;
  note: string;
}): Promise<{ part: Part; move: StockMove | null }> {
  if (input.qty < 0) throw new ShopError("Số lượng không được âm.");
  return withTx(["parts", "moves"], "readwrite", async (stores) => {
    const part = await loadPart(stores.parts, input.partId);
    const note = input.note.trim();
    if (input.mode === "count") {
      const delta = Math.round((input.qty - part.stock) * 1000) / 1000;
      if (delta === 0) return { part, move: null };
      const move = await applyDelta(stores, part.id, delta, {
        type: "adjust",
        note: note || "Kiểm kê",
        refType: "manual",
        refId: null,
      });
      const updated = await loadPart(stores.parts, part.id);
      return { part: updated, move };
    }
    if (input.qty === 0) throw new ShopError("Hãy nhập số lượng lớn hơn 0.");
    const delta = input.mode === "in" ? input.qty : -input.qty;
    const move = await applyDelta(stores, part.id, delta, {
      type: input.mode,
      note: note || (input.mode === "in" ? "Nhập kho" : "Xuất kho"),
      refType: "manual",
      refId: null,
    });
    const updated = await loadPart(stores.parts, part.id);
    return { part: updated, move };
  });
}

export async function saveCustomer(input: CustomerInput, id?: string): Promise<Customer> {
  const name = input.name.trim();
  if (!name) throw new ShopError("Hãy nhập tên khách.");
  return withTx(["customers"], "readwrite", async (stores) => {
    const now = nowIso();
    if (!id) {
      const customer: Customer = {
        id: uid(),
        name,
        phone: input.phone.trim(),
        address: input.address.trim(),
        note: input.note.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await ask(stores.customers.put(customer));
      return customer;
    }
    const current = await ask<Customer | undefined>(stores.customers.get(id));
    if (!current) throw new ShopError("Không tìm thấy khách.");
    const next: Customer = {
      ...current,
      name,
      phone: input.phone.trim(),
      address: input.address.trim(),
      note: input.note.trim(),
      updatedAt: now,
    };
    await ask(stores.customers.put(next));
    return next;
  });
}

export async function removeCustomer(id: string): Promise<void> {
  return withTx(["customers", "repairs", "quotes", "invoices", "meta"], "readwrite", async (stores) => {
    const [repairs, quotes, invoices] = await Promise.all([
      ask<Repair[]>(stores.repairs.getAll()),
      ask<Quote[]>(stores.quotes.getAll()),
      ask<Invoice[]>(stores.invoices.getAll()),
    ]);
    const used =
      repairs.some((item) => item.customerId === id) ||
      quotes.some((item) => item.customerId === id) ||
      invoices.some((item) => item.customerId === id);
    if (used) throw new ShopError("Khách đang có phiếu, báo giá hoặc hóa đơn. Hãy sửa hồ sơ thay vì xóa.");
    await addTombstone(stores.meta, "customers", id);
    await ask(stores.customers.delete(id));
  });
}

async function resolveCustomer(
  stores: Record<StoreName, IDBObjectStore>,
  input: RepairInput,
): Promise<Customer> {
  if (input.customerId) {
    const customer = await ask<Customer | undefined>(stores.customers.get(input.customerId));
    if (!customer) throw new ShopError("Không tìm thấy khách hàng.");
    return customer;
  }
  if (!input.newCustomer?.name.trim()) throw new ShopError("Hãy chọn khách hoặc nhập tên khách mới.");
  const now = nowIso();
  const customer: Customer = {
    id: uid(),
    name: input.newCustomer.name.trim(),
    phone: input.newCustomer.phone.trim(),
    address: input.newCustomer.address.trim(),
    note: input.newCustomer.note.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await ask(stores.customers.put(customer));
  return customer;
}

function applyWarranty(repair: Repair, today: string): void {
  if (repair.warrantyMonths > 0) {
    if (!repair.warrantyStart) repair.warrantyStart = today;
    if (!repair.warrantyEnd && repair.warrantyStart) {
      repair.warrantyEnd = addMonths(repair.warrantyStart, repair.warrantyMonths);
    }
  } else {
    repair.warrantyStart = null;
    repair.warrantyEnd = null;
  }
}

function fillRepair(base: Repair, input: RepairInput, customer: Customer): Repair {
  const device = input.deviceName.trim();
  if (!device) throw new ShopError("Hãy nhập tên thiết bị.");
  return {
    ...base,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    deviceName: device,
    model: input.model.trim(),
    serial: input.serial.trim(),
    symptom: input.symptom.trim(),
    cause: input.cause.trim(),
    note: input.note.trim(),
    lines: cleanLines(input.lines),
    warrantyMonths: Math.max(0, Math.round(input.warrantyMonths)),
    warrantyStart: input.warrantyStart,
    warrantyEnd: input.warrantyEnd,
    updatedAt: nowIso(),
  };
}

export async function saveRepair(id: string | null, input: RepairInput, complete: boolean): Promise<{ repair: Repair; customer: Customer }> {
  return withTx(["repairs", "customers", "parts", "moves", "meta"], "readwrite", async (stores) => {
    const customer = await resolveCustomer(stores, input);
    const now = nowIso();
    let repair: Repair;
    if (!id) {
      const settings = await readSettings(stores.meta);
      const existing = await ask<Repair[]>(stores.repairs.getAll());
      const code = takeCode(settings, "nextRepair", "SC", new Set(existing.map((item) => item.code)));
      await writeSettings(stores.meta, settings);
      repair = fillRepair(
        {
          id: uid(),
          code,
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          deviceName: "",
          model: "",
          serial: "",
          symptom: "",
          cause: "",
          note: "",
          status: "open",
          lines: [],
          warrantyMonths: 0,
          warrantyStart: null,
          warrantyEnd: null,
          stockIssued: false,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        },
        input,
        customer,
      );
    } else {
      const current = await ask<Repair | undefined>(stores.repairs.get(id));
      if (!current) throw new ShopError("Không tìm thấy phiếu sửa.");
      if (current.status === "cancelled") throw new ShopError("Phiếu đã hủy, không sửa được.");
      if (current.status === "done" && complete) throw new ShopError("Phiếu đã hoàn thành.");
      if (current.status === "done") throw new ShopError("Phiếu đã xong. Chỉ sửa bảo hành và ghi chú.");
      repair = fillRepair(current, input, customer);
    }
    if (complete) {
      if (!repair.stockIssued) {
        await issueParts(stores, repair.lines, {
          note: `Xuất kho phiếu ${repair.code}`,
          refType: "repair",
          refId: repair.id,
        });
        repair.stockIssued = true;
      }
      repair.status = "done";
      repair.completedAt = repair.completedAt ?? now;
      applyWarranty(repair, todayISO());
    } else {
      repair.status = "open";
    }
    await ask(stores.repairs.put(repair));
    return { repair, customer };
  });
}

export async function patchDoneRepair(id: string, input: RepairInput): Promise<{ repair: Repair; customer: Customer }> {
  return withTx(["repairs", "customers"], "readwrite", async (stores) => {
    const current = await ask<Repair | undefined>(stores.repairs.get(id));
    if (!current || current.status !== "done") throw new ShopError("Chỉ sửa thông tin khi phiếu đã hoàn thành.");
    const customer = await resolveCustomer(stores, input);
    const repair = fillRepair(current, input, customer);
    repair.lines = current.lines;
    repair.stockIssued = current.stockIssued;
    repair.status = "done";
    repair.completedAt = current.completedAt;
    applyWarranty(repair, repair.warrantyStart ?? todayISO());
    await ask(stores.repairs.put(repair));
    return { repair, customer };
  });
}

export async function removeRepair(id: string): Promise<void> {
  return withTx(["repairs", "meta"], "readwrite", async (stores) => {
    const repair = await ask<Repair | undefined>(stores.repairs.get(id));
    if (!repair) return;
    if (repair.status !== "open" || repair.stockIssued) {
      throw new ShopError("Phiếu đã xuất kho hoặc đã đóng. Hãy hủy phiếu nếu cần hoàn tồn.");
    }
    await addTombstone(stores.meta, "repairs", id);
    await ask(stores.repairs.delete(id));
  });
}

export async function cancelRepair(id: string): Promise<Repair> {
  return withTx(["repairs", "parts", "moves"], "readwrite", async (stores) => {
    const repair = await ask<Repair | undefined>(stores.repairs.get(id));
    if (!repair) throw new ShopError("Không tìm thấy phiếu sửa.");
    if (repair.status === "cancelled") return repair;
    if (repair.stockIssued) {
      await returnParts(stores, repair.lines, {
        note: `Hoàn kho do hủy phiếu ${repair.code}`,
        refType: "cancel",
        refId: repair.id,
      });
    }
    repair.status = "cancelled";
    repair.updatedAt = nowIso();
    await ask(stores.repairs.put(repair));
    return repair;
  });
}

export async function saveQuote(id: string | null, input: QuoteInput): Promise<Quote> {
  const lines = cleanLines(input.lines);
  if (lines.length === 0) throw new ShopError("Báo giá cần ít nhất một dòng linh kiện, công thợ hoặc phụ phí.");
  return withTx(["quotes", "meta"], "readwrite", async (stores) => {
    const now = nowIso();
    if (!id) {
      const settings = await readSettings(stores.meta);
      const existing = await ask<Quote[]>(stores.quotes.getAll());
      const code = takeCode(settings, "nextQuote", "BG", new Set(existing.map((item) => item.code)));
      await writeSettings(stores.meta, settings);
      const quote: Quote = {
        id: uid(),
        code,
        customerId: input.customerId,
        customerName: input.customerName.trim() || "Khách lẻ",
        phone: input.phone.trim(),
        address: input.address.trim(),
        title: input.title.trim() || "Báo giá sửa chữa",
        note: input.note.trim(),
        lines,
        status: input.status,
        createdAt: now,
        updatedAt: now,
      };
      await ask(stores.quotes.put(quote));
      return quote;
    }
    const current = await ask<Quote | undefined>(stores.quotes.get(id));
    if (!current) throw new ShopError("Không tìm thấy báo giá.");
    const next: Quote = {
      ...current,
      customerId: input.customerId,
      customerName: input.customerName.trim() || "Khách lẻ",
      phone: input.phone.trim(),
      address: input.address.trim(),
      title: input.title.trim() || current.title,
      note: input.note.trim(),
      lines,
      status: input.status,
      updatedAt: now,
    };
    await ask(stores.quotes.put(next));
    return next;
  });
}

export async function removeQuote(id: string): Promise<void> {
  return withTx(["quotes", "meta"], "readwrite", async (stores) => {
    await addTombstone(stores.meta, "quotes", id);
    await ask(stores.quotes.delete(id));
  });
}

export async function issueSale(input: SaleInput): Promise<Invoice> {
  const lines = cleanLines(input.lines);
  const partLines = lines.filter((line) => line.kind === "part");
  if (partLines.length === 0) throw new ShopError("Hóa đơn bán hàng cần ít nhất một linh kiện.");
  return withTx(["invoices", "parts", "moves", "meta"], "readwrite", async (stores) => {
    const settings = await readSettings(stores.meta);
    const existing = await ask<Invoice[]>(stores.invoices.getAll());
    const code = takeCode(settings, "nextInvoice", "HD", new Set(existing.map((item) => item.code)));
    await writeSettings(stores.meta, settings);
    const invoice: Invoice = {
      id: uid(),
      code,
      kind: "sale",
      status: "issued",
      customerId: input.customerId,
      customerName: input.customerName.trim() || "Khách lẻ",
      phone: input.phone.trim(),
      address: input.address.trim(),
      deviceName: "",
      model: "",
      serial: "",
      note: input.note.trim(),
      lines,
      warrantyStart: null,
      warrantyEnd: null,
      repairId: null,
      createdAt: nowIso(),
      voidedAt: null,
    };
    await issueParts(stores, lines, {
      note: `Xuất bán hóa đơn ${code}`,
      refType: "invoice",
      refId: invoice.id,
    });
    await ask(stores.invoices.put(invoice));
    return invoice;
  });
}

export async function issueRepairInvoice(repairId: string, input: { note: string; lines: LineItem[] }): Promise<Invoice> {
  const lines = cleanLines(input.lines);
  if (lines.length === 0) throw new ShopError("Hóa đơn chưa có dòng nào.");
  return withTx(["invoices", "repairs", "customers", "meta"], "readwrite", async (stores) => {
    const repair = await ask<Repair | undefined>(stores.repairs.get(repairId));
    if (!repair) throw new ShopError("Không tìm thấy phiếu sửa.");
    if (repair.status !== "done") throw new ShopError("Hãy hoàn thành phiếu sửa trước khi xuất hóa đơn.");
    const invoices = await ask<Invoice[]>(stores.invoices.getAll());
    const active = invoices.find((item) => item.repairId === repairId && item.status === "issued");
    if (active) throw new ShopError(`Phiếu này đã có hóa đơn ${active.code}. Hủy hóa đơn đó nếu cần lập lại.`);
    const customer = await ask<Customer | undefined>(stores.customers.get(repair.customerId));
    const settings = await readSettings(stores.meta);
    const code = takeCode(settings, "nextInvoice", "HD", new Set(invoices.map((item) => item.code)));
    await writeSettings(stores.meta, settings);
    const invoice: Invoice = {
      id: uid(),
      code,
      kind: "repair",
      status: "issued",
      customerId: repair.customerId,
      customerName: customer?.name || repair.customerName,
      phone: customer?.phone || repair.customerPhone,
      address: customer?.address ?? "",
      deviceName: repair.deviceName,
      model: repair.model,
      serial: repair.serial,
      note: input.note.trim(),
      lines,
      warrantyStart: repair.warrantyStart,
      warrantyEnd: repair.warrantyEnd,
      repairId: repair.id,
      createdAt: nowIso(),
      voidedAt: null,
    };
    await ask(stores.invoices.put(invoice));
    return invoice;
  });
}

export async function voidInvoice(id: string): Promise<Invoice> {
  return withTx(["invoices", "parts", "moves"], "readwrite", async (stores) => {
    const invoice = await ask<Invoice | undefined>(stores.invoices.get(id));
    if (!invoice) throw new ShopError("Không tìm thấy hóa đơn.");
    if (invoice.status === "void") return invoice;
    if (invoice.kind === "sale") {
      await returnParts(stores, invoice.lines, {
        note: `Hoàn kho do hủy hóa đơn ${invoice.code}`,
        refType: "void",
        refId: invoice.id,
      });
    }
    invoice.status = "void";
    invoice.voidedAt = nowIso();
    await ask(stores.invoices.put(invoice));
    return invoice;
  });
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return withTx(["meta"], "readwrite", async (stores) => {
    const current = await readSettings(stores.meta);
    const next: Settings = {
      ...current,
      ...patch,
      shopName: (patch.shopName ?? current.shopName).trim() || "Xưởng điện lạnh",
      ownerName: (patch.ownerName ?? current.ownerName).trim(),
      phone: (patch.phone ?? current.phone).trim(),
      address: (patch.address ?? current.address).trim(),
      taxCode: (patch.taxCode ?? current.taxCode).trim(),
      invoiceNote: (patch.invoiceNote ?? current.invoiceNote).trim(),
      nextRepair: current.nextRepair,
      nextQuote: current.nextQuote,
      nextInvoice: current.nextInvoice,
      nextSku: current.nextSku,
      lastBackupAt: patch.lastBackupAt === undefined ? current.lastBackupAt : patch.lastBackupAt,
      updatedAt: nowIso(),
    };
    await writeSettings(stores.meta, next);
    return next;
  });
}

export async function importBackup(raw: unknown, tombstones: SyncTombstone[] = []): Promise<Snapshot> {
  const data = parseBackup(raw);
  return withTx(ALL_STORES, "readwrite", async (stores) => {
    for (const name of DATA_STORES) {
      await ask(stores[name].clear());
    }
    await writeSettings(stores.meta, data.settings);
    await ask(stores.meta.put(tombstones, TOMBSTONES_KEY));
    for (const item of data.parts) await ask(stores.parts.put(item));
    for (const item of data.moves) await ask(stores.moves.put(item));
    for (const item of data.customers) await ask(stores.customers.put(item));
    for (const item of data.repairs) await ask(stores.repairs.put(item));
    for (const item of data.quotes) await ask(stores.quotes.put(item));
    for (const item of data.invoices) await ask(stores.invoices.put(item));
    return sortSnapshot(data);
  });
}

export function snapshotToBackup(snapshot: Snapshot): BackupFile {
  return buildBackup(snapshot);
}
