/**
 * Quy tắc nghiệp vụ thuần (không đụng IndexedDB): bảo hành, lọc, tiền lãi ước tính.
 */

import { addDays, lineAmount, todayISO } from "@/lib/format";
import type { Customer, Invoice, Part, Repair, RepairStatus } from "@/lib/types";

export type RepairFilter = "all" | "open" | "done" | "warranty" | "expired";

export function isLowStock(part: Part): boolean {
  return part.stock <= part.minStock;
}

export type WarrantyState = "none" | "active" | "expired";

export function warrantyOf(repair: Repair, today = todayISO()): WarrantyState {
  if (repair.status !== "done" || repair.warrantyMonths <= 0 || !repair.warrantyEnd) return "none";
  return today <= repair.warrantyEnd ? "active" : "expired";
}

export function warrantyLabel(repair: Repair, today = todayISO()): string {
  const state = warrantyOf(repair, today);
  if (state === "active") return `Còn bảo hành đến ${repair.warrantyEnd}`;
  if (state === "expired") return `Hết bảo hành ${repair.warrantyEnd}`;
  if (repair.status === "open") return "Chưa chốt bảo hành";
  return "Không bảo hành";
}

export function matchesRepairFilter(repair: Repair, filter: RepairFilter, today = todayISO()): boolean {
  if (filter === "all") return true;
  if (filter === "open") return repair.status === "open";
  if (filter === "done") return repair.status === "done";
  return warrantyOf(repair, today) === (filter === "warranty" ? "active" : "expired");
}

export function statusLabel(status: RepairStatus): string {
  if (status === "open") return "Đang sửa";
  if (status === "done") return "Đã xong";
  return "Đã hủy";
}

export function customerName(customers: Customer[], id: string | null, fallback = ""): string {
  if (!id) return fallback || "Khách lẻ";
  return customers.find((item) => item.id === id)?.name || fallback || "Khách đã xóa";
}

export function relatedRepairs(
  repairs: Repair[],
  input: { customerId?: string | null; serial?: string; excludeId?: string },
): Repair[] {
  const serial = input.serial?.trim().toLowerCase() ?? "";
  return repairs
    .filter((repair) => {
      if (input.excludeId && repair.id === input.excludeId) return false;
      const sameCustomer = Boolean(input.customerId) && repair.customerId === input.customerId;
      const sameSerial = Boolean(serial) && repair.serial.trim().toLowerCase() === serial;
      return sameCustomer || sameSerial;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function expiringRepairs(repairs: Repair[], withinDays = 30, today = todayISO()): Repair[] {
  const limit = addDays(today, withinDays);
  return repairs
    .filter((repair) => {
      if (warrantyOf(repair, today) !== "active" || !repair.warrantyEnd) return false;
      return repair.warrantyEnd <= limit;
    })
    .sort((a, b) => (a.warrantyEnd ?? "").localeCompare(b.warrantyEnd ?? ""));
}

export function monthRevenue(invoices: Invoice[], month: string): number {
  return invoices.reduce((sum, invoice) => {
    if (invoice.status !== "issued" || !invoice.createdAt.startsWith(month)) return sum;
    return sum + invoice.lines.reduce((lineSum, line) => lineSum + lineAmount(line), 0);
  }, 0);
}

/**
 * Lãi gộp ước tính = doanh thu hóa đơn − giá nhập hiện tại của linh kiện.
 * Công thợ và phụ phí tính 100% là lãi. Giá nhập lấy ở thời điểm xem, không phải lúc bán.
 */
export function grossEstimate(
  invoices: Invoice[],
  parts: Part[],
  month: string,
): { revenue: number; partCost: number; gross: number } {
  const cost = new Map(parts.map((part) => [part.id, part.costPrice]));
  let revenue = 0;
  let partCost = 0;
  for (const invoice of invoices) {
    if (invoice.status !== "issued" || !invoice.createdAt.startsWith(month)) continue;
    for (const line of invoice.lines) {
      revenue += lineAmount(line);
      if (line.kind === "part" && line.partId && cost.has(line.partId)) {
        partCost += Math.round(line.qty * (cost.get(line.partId) ?? 0));
      }
    }
  }
  return { revenue, partCost, gross: revenue - partCost };
}

export function hasBusinessData(input: {
  parts: unknown[];
  customers: unknown[];
  repairs: unknown[];
  quotes: unknown[];
  invoices: unknown[];
}): boolean {
  return (
    input.parts.length +
      input.customers.length +
      input.repairs.length +
      input.quotes.length +
      input.invoices.length >
    0
  );
}

export function backupIsStale(lastBackupAt: string | null, hasData: boolean): boolean {
  if (!hasData) return false;
  if (!lastBackupAt) return true;
  const then = new Date(lastBackupAt).getTime();
  if (Number.isNaN(then)) return true;
  return Date.now() - then > 7 * 24 * 60 * 60 * 1000;
}
