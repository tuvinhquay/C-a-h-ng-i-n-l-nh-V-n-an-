/**
 * Định dạng tiền, ngày và đọc số tiền tiếng Việt.
 * Không phụ thuộc trình duyệt để có thể kiểm tra bằng Node.
 */

import type { LineItem } from "@/lib/types";

export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Ngày địa phương yyyy-mm-dd (không dùng UTC để khỏi lệch ngày ở Việt Nam). */
export function todayISO(date = new Date()): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${z(date.getMonth() + 1)}-${z(date.getDate())}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1 + months, d);
  return todayISO(dt);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.length === 10 ? `${value}T00:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN").format(date);
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function vnd(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${new Intl.NumberFormat("vi-VN").format(n)} đ`;
}

export function qtyText(qty: number): string {
  if (!Number.isFinite(qty)) return "0";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(qty);
}

/** Bỏ dấu để tìm "dieu hoa" ra "điều hòa". */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();
}

export function matchesQuery(haystack: string, query: string): boolean {
  const needle = fold(query);
  if (!needle) return true;
  return fold(haystack).includes(needle);
}

export function parseMoney(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Số tiền không hợp lệ.");
  }
  return Math.round(n);
}

export function parseQty(raw: string): number {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!text) throw new Error("Hãy nhập số lượng.");
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) throw new Error("Số lượng không hợp lệ.");
  return Math.round(n * 1000) / 1000;
}

export function lineAmount(line: Pick<LineItem, "qty" | "unitPrice">): number {
  return Math.round(line.qty * line.unitPrice);
}

export function sumLines(lines: Pick<LineItem, "qty" | "unitPrice">[]): number {
  return lines.reduce((sum, line) => sum + lineAmount(line), 0);
}

export function blankToNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"] as const;

function readGroup(n: number, forceHundreds: boolean): string {
  const hundred = Math.floor(n / 100);
  const ten = Math.floor((n % 100) / 10);
  const one = n % 10;
  const parts: string[] = [];
  if (hundred > 0 || forceHundreds) {
    parts.push(DIGITS[hundred], "trăm");
  }
  if (ten > 1) {
    parts.push(DIGITS[ten], "mươi");
    if (one === 1) parts.push("mốt");
    else if (one === 4) parts.push("tư");
    else if (one === 5) parts.push("lăm");
    else if (one > 0) parts.push(DIGITS[one]);
  } else if (ten === 1) {
    parts.push("mười");
    if (one === 5) parts.push("lăm");
    else if (one > 0) parts.push(DIGITS[one]);
  } else if (one > 0) {
    if (hundred > 0 || forceHundreds) parts.push("lẻ");
    parts.push(one === 5 && (hundred > 0 || forceHundreds) ? "năm" : DIGITS[one]);
  }
  return parts.join(" ");
}

/** Đọc số tiền nguyên: "Một triệu năm trăm nghìn đồng". */
export function vndInWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (n === 0) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const chunks: number[] = [];
  let rest = n;
  while (rest > 0 && chunks.length < units.length) {
    chunks.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts: string[] = [];
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    if (chunks[i] === 0) continue;
    const text = readGroup(chunks[i], i < chunks.length - 1 && chunks[i] < 100);
    parts.push(units[i] ? `${text} ${units[i]}` : text);
  }
  const sentence = parts.join(" ").replace(/\s+/g, " ").trim();
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} đồng`;
}

export function codeOf(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
