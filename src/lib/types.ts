/**
 * Mô hình dữ liệu Sổ Điện Lạnh.
 * Mọi thứ nằm trên máy (IndexedDB). File sao lưu JSON dùng đúng các kiểu này.
 * Tiền là VND (số nguyên). Số lượng có thể lẻ (gas, mét dây) tối đa 3 chữ số thập phân.
 */

export type MoveType = "in" | "out" | "adjust";
export type MoveRef = "manual" | "opening" | "repair" | "invoice" | "void" | "cancel";
export type RepairStatus = "open" | "done" | "cancelled";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";
export type InvoiceKind = "sale" | "repair";
export type InvoiceStatus = "issued" | "void";
export type LineKind = "part" | "labor" | "fee";

export interface Part {
  id: string;
  sku: string;
  name: string;
  machineType: string;
  brand: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMove {
  id: string;
  partId: string;
  /** Tên và mã tại thời điểm phát sinh — không đổi khi sửa danh mục sau này. */
  partName: string;
  sku: string;
  type: MoveType;
  qtyChange: number;
  stockBefore: number;
  stockAfter: number;
  note: string;
  refType: MoveRef;
  refId: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineItem {
  id: string;
  kind: LineKind;
  partId: string | null;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
}

export interface Repair {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  model: string;
  serial: string;
  symptom: string;
  cause: string;
  note: string;
  status: RepairStatus;
  lines: LineItem[];
  warrantyMonths: number;
  /** yyyy-mm-dd hoặc null */
  warrantyStart: string | null;
  warrantyEnd: string | null;
  /** Đã xuất kho linh kiện của phiếu này chưa. Tránh trừ tồn hai lần. */
  stockIssued: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Quote {
  id: string;
  code: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  address: string;
  title: string;
  note: string;
  lines: LineItem[];
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  code: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  customerId: string | null;
  customerName: string;
  phone: string;
  address: string;
  deviceName: string;
  model: string;
  serial: string;
  note: string;
  lines: LineItem[];
  warrantyStart: string | null;
  warrantyEnd: string | null;
  repairId: string | null;
  createdAt: string;
  voidedAt: string | null;
}

export interface Settings {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  taxCode: string;
  /** Dòng chân hóa đơn: tài khoản, lời cảm ơn, điều khoản bảo hành. */
  invoiceNote: string;
  nextRepair: number;
  nextQuote: number;
  nextInvoice: number;
  nextSku: number;
  lastBackupAt: string | null;
}

export interface Snapshot {
  settings: Settings;
  parts: Part[];
  moves: StockMove[];
  customers: Customer[];
  repairs: Repair[];
  quotes: Quote[];
  invoices: Invoice[];
}

export interface BackupFile extends Snapshot {
  app: "so-dien-lanh";
  version: 1;
  exportedAt: string;
}

/** Giấy in dùng chung cho báo giá, phiếu sửa và hóa đơn. */
export interface PaperDoc {
  title: string;
  code: string;
  dateText: string;
  shopName: string;
  shopMeta: string[];
  customerLines: string[];
  deviceLines: string[];
  lines: Array<{
    name: string;
    qty: string;
    unit: string;
    price: string;
    amount: string;
  }>;
  total: string;
  totalNumber: number;
  totalWords: string;
  warranty: string | null;
  note: string;
  footer: string;
  signer: string;
}

export interface PartInput {
  sku: string;
  name: string;
  machineType: string;
  brand: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  /** Chỉ dùng khi tạo mới. Sửa sau này phải qua nhập / xuất / kiểm kê. */
  openingStock: number;
  minStock: number;
  note: string;
}

export interface CustomerInput {
  name: string;
  phone: string;
  address: string;
  note: string;
}

export interface RepairInput {
  customerId: string | null;
  newCustomer: CustomerInput | null;
  deviceName: string;
  model: string;
  serial: string;
  symptom: string;
  cause: string;
  note: string;
  lines: LineItem[];
  warrantyMonths: number;
  warrantyStart: string | null;
  warrantyEnd: string | null;
}

export interface QuoteInput {
  customerId: string | null;
  customerName: string;
  phone: string;
  address: string;
  title: string;
  note: string;
  lines: LineItem[];
  status: QuoteStatus;
}

export interface SaleInput {
  customerId: string | null;
  customerName: string;
  phone: string;
  address: string;
  note: string;
  lines: LineItem[];
}
