/**
 * Đọc / ghi file sao lưu JSON.
 * File phải tự mô tả (app + version) để máy khác khôi phục không nhầm dữ liệu.
 */

import type {
  BackupFile,
  Customer,
  Invoice,
  LineItem,
  Part,
  Quote,
  Repair,
  Settings,
  Snapshot,
  StockMove,
} from "@/lib/types";

const APP = "so-dien-lanh";

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`File sao lưu lỗi ở "${label}".`);
  return value;
}

function optStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`File sao lưu lỗi ở "${label}".`);
  return value;
}

function intCounter(value: unknown, label: string): number {
  const n = num(value, label);
  if (!Number.isInteger(n) || n < 1) fail(`File sao lưu lỗi ở "${label}".`);
  return n;
}

function nullableDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") fail(`File sao lưu lỗi ở "${label}".`);
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) return value as T;
  fail(`File sao lưu lỗi ở "${label}".`);
}

function line(value: unknown, label: string): LineItem {
  if (!isRecord(value)) fail(`File sao lưu lỗi ở "${label}".`);
  return {
    id: str(value.id, `${label}.id`),
    kind: oneOf(value.kind, ["part", "labor", "fee"] as const, `${label}.kind`),
    partId: value.partId === null || value.partId === undefined ? null : str(value.partId, `${label}.partId`),
    name: str(value.name, `${label}.name`),
    unit: optStr(value.unit) || "Cái",
    qty: num(value.qty, `${label}.qty`),
    unitPrice: num(value.unitPrice, `${label}.unitPrice`),
  };
}

function lines(value: unknown, label: string): LineItem[] {
  if (!Array.isArray(value)) fail(`File sao lưu lỗi ở "${label}".`);
  return value.map((item, index) => line(item, `${label}[${index}]`));
}

function part(value: unknown): Part {
  if (!isRecord(value)) fail("Danh mục kho trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "part.id"),
    sku: str(value.sku, "part.sku"),
    name: str(value.name, "part.name"),
    machineType: optStr(value.machineType),
    brand: optStr(value.brand),
    unit: optStr(value.unit) || "Cái",
    costPrice: num(value.costPrice, "part.costPrice"),
    sellPrice: num(value.sellPrice, "part.sellPrice"),
    stock: num(value.stock, "part.stock"),
    minStock: num(value.minStock, "part.minStock"),
    note: optStr(value.note),
    createdAt: str(value.createdAt, "part.createdAt"),
    updatedAt: str(value.updatedAt, "part.updatedAt"),
  };
}

function move(value: unknown): StockMove {
  if (!isRecord(value)) fail("Lịch sử kho trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "move.id"),
    partId: str(value.partId, "move.partId"),
    partName: optStr(value.partName),
    sku: optStr(value.sku),
    type: oneOf(value.type, ["in", "out", "adjust"] as const, "move.type"),
    qtyChange: num(value.qtyChange, "move.qtyChange"),
    stockBefore: num(value.stockBefore, "move.stockBefore"),
    stockAfter: num(value.stockAfter, "move.stockAfter"),
    note: optStr(value.note),
    refType: oneOf(
      value.refType,
      ["manual", "opening", "repair", "invoice", "void", "cancel"] as const,
      "move.refType",
    ),
    refId: value.refId === null || value.refId === undefined ? null : str(value.refId, "move.refId"),
    createdAt: str(value.createdAt, "move.createdAt"),
  };
}

function customer(value: unknown): Customer {
  if (!isRecord(value)) fail("Khách hàng trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "customer.id"),
    name: str(value.name, "customer.name"),
    phone: optStr(value.phone),
    address: optStr(value.address),
    note: optStr(value.note),
    createdAt: str(value.createdAt, "customer.createdAt"),
    updatedAt: str(value.updatedAt, "customer.updatedAt"),
  };
}

function repair(value: unknown): Repair {
  if (!isRecord(value)) fail("Phiếu sửa chữa trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "repair.id"),
    code: str(value.code, "repair.code"),
    customerId: str(value.customerId, "repair.customerId"),
    customerName: optStr(value.customerName),
    customerPhone: optStr(value.customerPhone),
    deviceName: str(value.deviceName, "repair.deviceName"),
    model: optStr(value.model),
    serial: optStr(value.serial),
    symptom: optStr(value.symptom),
    cause: optStr(value.cause),
    note: optStr(value.note),
    status: oneOf(value.status, ["open", "done", "cancelled"] as const, "repair.status"),
    lines: lines(value.lines, "repair.lines"),
    warrantyMonths: num(value.warrantyMonths, "repair.warrantyMonths"),
    warrantyStart: nullableDate(value.warrantyStart, "repair.warrantyStart"),
    warrantyEnd: nullableDate(value.warrantyEnd, "repair.warrantyEnd"),
    stockIssued: value.stockIssued === true,
    createdAt: str(value.createdAt, "repair.createdAt"),
    updatedAt: str(value.updatedAt, "repair.updatedAt"),
    completedAt: nullableDate(value.completedAt, "repair.completedAt"),
  };
}

function quote(value: unknown): Quote {
  if (!isRecord(value)) fail("Báo giá trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "quote.id"),
    code: str(value.code, "quote.code"),
    customerId: value.customerId === null || value.customerId === undefined ? null : str(value.customerId, "quote.customerId"),
    customerName: optStr(value.customerName),
    phone: optStr(value.phone),
    address: optStr(value.address),
    title: optStr(value.title) || "Báo giá sửa chữa",
    note: optStr(value.note),
    lines: lines(value.lines, "quote.lines"),
    status: oneOf(value.status, ["draft", "sent", "accepted", "rejected"] as const, "quote.status"),
    createdAt: str(value.createdAt, "quote.createdAt"),
    updatedAt: str(value.updatedAt, "quote.updatedAt"),
  };
}

function invoice(value: unknown): Invoice {
  if (!isRecord(value)) fail("Hóa đơn trong file sao lưu bị hỏng.");
  return {
    id: str(value.id, "invoice.id"),
    code: str(value.code, "invoice.code"),
    kind: oneOf(value.kind, ["sale", "repair"] as const, "invoice.kind"),
    status: oneOf(value.status, ["issued", "void"] as const, "invoice.status"),
    customerId:
      value.customerId === null || value.customerId === undefined ? null : str(value.customerId, "invoice.customerId"),
    customerName: optStr(value.customerName) || "Khách lẻ",
    phone: optStr(value.phone),
    address: optStr(value.address),
    deviceName: optStr(value.deviceName),
    model: optStr(value.model),
    serial: optStr(value.serial),
    note: optStr(value.note),
    lines: lines(value.lines, "invoice.lines"),
    warrantyStart: nullableDate(value.warrantyStart, "invoice.warrantyStart"),
    warrantyEnd: nullableDate(value.warrantyEnd, "invoice.warrantyEnd"),
    repairId: value.repairId === null || value.repairId === undefined ? null : str(value.repairId, "invoice.repairId"),
    createdAt: str(value.createdAt, "invoice.createdAt"),
    voidedAt: nullableDate(value.voidedAt, "invoice.voidedAt"),
  };
}

function settingsOf(value: unknown): Settings {
  if (!isRecord(value)) fail("Phần cài đặt trong file sao lưu bị hỏng.");
  return {
    shopName: optStr(value.shopName) || "Xưởng điện lạnh",
    ownerName: optStr(value.ownerName),
    phone: optStr(value.phone),
    address: optStr(value.address),
    taxCode: optStr(value.taxCode),
    invoiceNote: optStr(value.invoiceNote),
    nextRepair: intCounter(value.nextRepair, "settings.nextRepair"),
    nextQuote: intCounter(value.nextQuote, "settings.nextQuote"),
    nextInvoice: intCounter(value.nextInvoice, "settings.nextInvoice"),
    nextSku: intCounter(value.nextSku, "settings.nextSku"),
    lastBackupAt: nullableDate(value.lastBackupAt, "settings.lastBackupAt"),
  };
}

function list<T>(value: unknown, map: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) fail(`File sao lưu thiếu mục ${label}.`);
  return value.map((item) => map(item));
}

export function buildBackup(snapshot: Snapshot): BackupFile {
  return {
    app: APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: snapshot.settings,
    parts: snapshot.parts,
    moves: snapshot.moves,
    customers: snapshot.customers,
    repairs: snapshot.repairs,
    quotes: snapshot.quotes,
    invoices: snapshot.invoices,
  };
}

export function parseBackup(raw: unknown): BackupFile {
  if (!isRecord(raw)) fail("File không phải dữ liệu sao lưu.");
  if (raw.app !== APP) fail("Đây không phải file sao lưu của Sổ Điện Lạnh.");
  if (raw.version !== 1) fail("Phiên bản file sao lưu này không dùng được. Cần file version 1.");
  return {
    app: APP,
    version: 1,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    settings: settingsOf(raw.settings),
    parts: list(raw.parts, part, "kho"),
    moves: list(raw.moves, move, "nhập xuất"),
    customers: list(raw.customers, customer, "khách hàng"),
    repairs: list(raw.repairs, repair, "phiếu sửa"),
    quotes: list(raw.quotes, quote, "báo giá"),
    invoices: list(raw.invoices, invoice, "hóa đơn"),
  };
}

export function downloadText(filename: string, text: string, type = "application/json"): void {
  const blob = new Blob([text], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}
