import { Package, Wrench, FileText, ClipboardList, ArrowRight } from "lucide-react";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import { Button } from "@/components/ui";

export function HomeScreen({ nav }: { nav: Nav }) {
  const shop = useShop();

  // Tạm tính số liệu (sau này có thể lấy thật từ store)
  const repairing = shop.repairs?.filter((r) => r.status !== "done").length ?? 0;
  const lowStock = shop.parts?.filter((p) => p.stock <= (p.minStock ?? 0)).length ?? 0;
  const warrantySoon = 0; // có thể tính sau
  const monthRevenue = 0;

  return (
    <div className="space-y-6">
      {/* Giới thiệu */}
      <div className="glass rounded-2xl p-5">
        <p className="text-sm leading-relaxed text-muted">
          Phần mềm quản lý kho hàng đa nền tảng là cộng sự số một cho mọi Doanh nghiệp lớn/nhỏ.
        </p>
      </div>

      {/* 4 thẻ thống kê - Bento Glass */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-muted">Đang sửa</p>
          <p className="mt-1 text-3xl font-bold text-copper">{repairing}</p>
          <p className="mt-1 text-xs text-muted">Phiếu chưa xong</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-muted">Tồn thấp</p>
          <p className="mt-1 text-3xl font-bold text-pine">{lowStock}</p>
          <p className="mt-1 text-xs text-muted">Dưới mức tối thiểu</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-muted">BH sắp hết</p>
          <p className="mt-1 text-3xl font-bold text-warn">{warrantySoon}</p>
          <p className="mt-1 text-xs text-muted">Trong 30 ngày</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="text-xs font-medium text-muted">Doanh thu tháng</p>
          <p className="mt-1 text-3xl font-bold text-ok">{monthRevenue.toLocaleString("vi-VN")}đ</p>
          <p className="mt-1 text-xs text-muted">Lãi gộp ước tính</p>
        </div>
      </div>

      {/* Nút hành động nhanh */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-14 justify-start gap-3 rounded-2xl bg-copper/20 border border-copper/40 text-copper hover:bg-copper/30"
          onClick={() => nav.go({ view: "part" })}
        >
          <Package className="size-5" />
          Nhập linh kiện
        </Button>

        <Button
          className="h-14 justify-start gap-3 rounded-2xl bg-pine/20 border border-pine/40 text-pine hover:bg-pine/30"
          onClick={() => nav.go({ view: "repair" })}
        >
          <Wrench className="size-5" />
          Phiếu sửa
        </Button>

        <Button
          className="h-14 justify-start gap-3 rounded-2xl bg-white/5 border border-white/10 text-ink hover:bg-white/10"
          onClick={() => nav.go({ view: "sale" })}
        >
          <FileText className="size-5" />
          Bán linh kiện
        </Button>

        <Button
          className="h-14 justify-start gap-3 rounded-2xl bg-white/5 border border-white/10 text-ink hover:bg-white/10"
          onClick={() => nav.go({ view: "quote" })}
        >
          <ClipboardList className="size-5" />
          Báo giá
        </Button>
      </div>

      {/* Phiếu gần đây */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Phiếu gần đây</h2>
          <button
            type="button"
            onClick={() => nav.tab("repairs")}
            className="flex items-center gap-1 text-sm text-pine"
          >
            Xem tất cả <ArrowRight className="size-4" />
          </button>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-muted">Chưa có phiếu. Khi có máy vào sẽ hiện ở đây.</p>
        </div>
      </div>
    </div>
  );
}
