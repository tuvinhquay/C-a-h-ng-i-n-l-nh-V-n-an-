import { ArrowRight, ClipboardList, FileText, Package, Wrench } from "lucide-react";
import type { Nav } from "@/lib/nav";
import { expiringRepairs, grossEstimate, isLowStock, statusLabel } from "@/lib/domain";
import { formatWhen, todayISO, vnd } from "@/lib/format";
import { useShop } from "@/lib/store";
import { Badge, Button, EmptyState } from "@/components/ui";

export function HomeScreen({ nav }: { nav: Nav }) {
  const shop = useShop();
  const month = todayISO().slice(0, 7);
  const openRepairs = shop.repairs.filter((repair) => repair.status === "open").length;
  const lowStockParts = shop.parts.filter(isLowStock).length;
  const expiringWarranty = expiringRepairs(shop.repairs).length;
  const monthlyFigures = grossEstimate(shop.invoices, shop.parts, month);
  const recentRepairs = [...shop.repairs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="glass glass-orange rounded-3xl p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-copper">Vận hành cửa hàng</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Chào mừng đến với Vân An</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
              Theo dõi kho linh kiện, tiến độ sửa chữa và doanh thu trong cùng một nơi.
            </p>
          </div>
          <p className="text-sm font-semibold text-muted">
            {shop.parts.length} mã hàng <span className="px-1 text-copper">·</span> {shop.customers.length} khách hàng
          </p>
        </div>
      </section>

      <section aria-label="Tình hình cửa hàng" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="glass glass-orange col-span-2 rounded-2xl p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">Doanh thu tháng này</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-ink sm:text-4xl">{vnd(monthlyFigures.revenue)}</p>
            </div>
            <span className="rounded-xl border border-copper/30 bg-copper-soft px-3 py-2 text-xs font-bold text-copper">THÁNG NÀY</span>
          </div>
          <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
            Lãi gộp ước tính <span className="font-bold text-copper">{vnd(monthlyFigures.gross)}</span>
          </p>
        </article>

        <article className="glass rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-muted">Phiếu đang sửa</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-copper sm:text-4xl">{openRepairs}</p>
          <p className="mt-1 text-xs text-muted">Đang chờ hoàn tất</p>
        </article>

        <article className="glass rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-muted">Linh kiện tồn thấp</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-pine sm:text-4xl">{lowStockParts}</p>
          <p className="mt-1 text-xs text-muted">Đã chạm mức tối thiểu</p>
        </article>

        <article className="glass rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-muted">Sắp hết bảo hành</p>
          <p className="mt-3 text-3xl font-bold tabular-nums text-warn sm:text-4xl">{expiringWarranty}</p>
          <p className="mt-1 text-xs text-muted">Trong 30 ngày tới</p>
        </article>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Thao tác nhanh</h2>
            <p className="mt-1 text-sm text-muted">Tạo bản ghi mới cho công việc trong ngày.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Button
            tone="ghost"
            className="min-h-14 justify-start gap-3 rounded-2xl border border-copper/35 bg-copper-soft text-copper hover:bg-copper/20"
            onClick={() => nav.go({ view: "part" })}
          >
            <Package className="size-5 shrink-0" />
            Nhập linh kiện
          </Button>
          <Button
            tone="ghost"
            className="min-h-14 justify-start gap-3 rounded-2xl border border-pine/30 bg-pine-soft text-pine hover:bg-pine/20"
            onClick={() => nav.go({ view: "repair" })}
          >
            <Wrench className="size-5 shrink-0" />
            Phiếu sửa
          </Button>
          <Button
            tone="ghost"
            className="min-h-14 justify-start gap-3 rounded-2xl"
            onClick={() => nav.go({ view: "sale" })}
          >
            <FileText className="size-5 shrink-0 text-copper" />
            Bán linh kiện
          </Button>
          <Button
            tone="ghost"
            className="min-h-14 justify-start gap-3 rounded-2xl"
            onClick={() => nav.go({ view: "quote" })}
          >
            <ClipboardList className="size-5 shrink-0 text-pine" />
            Tạo báo giá
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Phiếu sửa gần đây</h2>
            <p className="mt-1 text-sm text-muted">Cập nhật mới nhất trong sổ cửa hàng.</p>
          </div>
          <button
            type="button"
            onClick={() => nav.tab("repairs")}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-pine"
          >
            Tất cả <ArrowRight className="size-4" />
          </button>
        </div>

        {recentRepairs.length === 0 ? (
          <EmptyState
            title="Chưa có phiếu sửa"
            body="Phiếu mới sẽ xuất hiện tại đây để bạn theo dõi nhanh tiến độ."
            action={<Button onClick={() => nav.go({ view: "repair" })}>Tạo phiếu sửa đầu tiên</Button>}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {recentRepairs.map((repair) => (
              <button
                key={repair.id}
                type="button"
                onClick={() => nav.go({ view: "repair", id: repair.id })}
                className="glass min-h-28 rounded-2xl p-4 text-left transition hover:border-pine/40 hover:bg-pine-soft/30"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{repair.deviceName || "Thiết bị chưa ghi tên"}</span>
                    <span className="mt-1 block truncate text-sm text-muted">
                      {repair.code} · {repair.customerName}
                    </span>
                  </span>
                  <Badge tone={repair.status === "done" ? "ok" : repair.status === "open" ? "copper" : "muted"}>
                    {statusLabel(repair.status)}
                  </Badge>
                </span>
                <span className="mt-3 block text-xs text-muted">{formatWhen(repair.updatedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
