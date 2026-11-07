import type { RepairFilter } from "@/lib/domain";
import type { PaperDoc } from "@/lib/types";

export type Screen =
  | { view: "home" }
  | { view: "parts"; lowOnly?: boolean }
  | { view: "part"; id?: string }
  | { view: "moves" }
  | { view: "customers" }
  | { view: "customer"; id?: string }
  | { view: "repairs"; filter?: RepairFilter }
  | { view: "repair"; id?: string; fromQuoteId?: string; customerId?: string }
  | { view: "quotes" }
  | { view: "quote"; id?: string }
  | { view: "invoices" }
  | { view: "invoice"; id: string }
  | { view: "sale" }
  | { view: "repair-bill"; repairId: string }
  | { view: "backup" }
  | { view: "settings" }
  | { view: "workspace" };

export type TabName = "home" | "parts" | "repairs" | "invoices";

export interface Nav {
  screen: Screen;
  go: (screen: Screen) => void;
  back: () => void;
  /** Về một màn gốc, không chồng lên lịch sử quay lại. */
  show: (screen: Screen) => void;
  tab: (view: TabName) => void;
  openPaper: (doc: PaperDoc) => void;
}

export function screenTitle(screen: Screen): string {
  switch (screen.view) {
    case "home":
      return "Tổng quan";
    case "parts":
      return "Kho linh kiện";
    case "part":
      return screen.id ? "Sửa linh kiện" : "Thêm linh kiện";
    case "moves":
      return "Lịch sử nhập xuất";
    case "customers":
      return "Khách hàng";
    case "customer":
      return screen.id ? "Hồ sơ khách" : "Khách mới";
    case "repairs":
      return "Phiếu sửa chữa";
    case "repair":
      return screen.id ? "Phiếu sửa" : "Phiếu sửa mới";
    case "quotes":
      return "Báo giá";
    case "quote":
      return screen.id ? "Sửa báo giá" : "Báo giá mới";
    case "invoices":
      return "Hóa đơn";
    case "invoice":
      return "Chi tiết hóa đơn";
    case "sale":
      return "Hóa đơn bán hàng";
    case "repair-bill":
      return "Hóa đơn sửa chữa";
    case "backup":
      return "Sao lưu";
    case "settings":
      return "Cửa hàng";
    case "workspace":
      return "Thiết bị & đồng bộ";
    default:
      return "Sổ Điện Lạnh";
  }
}
