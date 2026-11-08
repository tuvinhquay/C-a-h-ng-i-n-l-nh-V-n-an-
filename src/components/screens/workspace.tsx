import { useEffect, useState } from "react";
import { Cloud, RefreshCw, Shield, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, EmptyState, Field, errorText, fieldClass } from "@/components/ui";
import { getDeviceIdentity } from "@/lib/local-db";
import { createWorkspace, getWorkspace } from "@/lib/workspace";
import { useShop } from "@/lib/store";
import { authEnabled } from "@/lib/auth/client";
import type { SyncDocument } from "@/lib/types";
import type { Nav } from "@/lib/nav";

type DeviceIdentity = Awaited<ReturnType<typeof getDeviceIdentity>>;
type WorkspaceInfo = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;

function documentOf(shop: ReturnType<typeof useShop>): SyncDocument {
  return {
    snapshot: {
      settings: shop.settings,
      parts: shop.parts,
      moves: shop.moves,
      customers: shop.customers,
      repairs: shop.repairs,
      quotes: shop.quotes,
      invoices: shop.invoices,
    },
    tombstones: shop.tombstones,
  };
}

export function WorkspaceScreen({ nav }: { nav: Nav }) {
  const shop = useShop();
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [name, setName] = useState(shop.settings.shopName);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(identity = device) {
    if (!identity) return;
    try {
      const current = await getWorkspace({ data: identity });
      setWorkspace(current);
      setLoadError("");
    } catch (reason) {
      setLoadError(errorText(reason));
      toast.error(errorText(reason));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authEnabled) return;
    let active = true;
    let timer = 0;
    const pull = async (identity: DeviceIdentity) => {
      try {
        const current = await getWorkspace({ data: identity });
        if (active) {
          setWorkspace(current);
          setLoadError("");
        }
      } catch (reason) {
        if (active) setLoadError(errorText(reason));
      } finally {
        if (active) setLoading(false);
      }
    };
    void getDeviceIdentity()
      .then(async (identity) => {
        if (!active) return;
        setDevice(identity);
        await pull(identity);
        if (active) timer = window.setInterval(() => void pull(identity), 15_000);
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadError(errorText(reason));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  if (!authEnabled) {
    return (
      <section className="glass rounded-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Dữ liệu đang lưu trên thiết bị này</h2>
        <p className="mt-2 text-sm text-muted">
          Chế độ vào thẳng không yêu cầu mã đăng nhập. Dữ liệu kho vẫn hoạt động offline trên thiết bị
          này; đồng bộ giữa nhiều thiết bị tạm dừng. Hãy sao lưu thường xuyên để bảo vệ dữ liệu.
        </p>
        <Button className="mt-4" onClick={() => nav.show({ view: "backup" })}>
          Mở sao lưu / khôi phục
        </Button>
      </section>
    );
  }

  async function create() {
    if (!device) return;
    setBusy(true);
    try {
      await createWorkspace({
        data: {
          name,
          document: documentOf(shop),
          device,
        },
      });
      toast.success("Đã tạo hệ thống dùng chung.");
      await refresh(device);
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="glass rounded-card p-6 text-muted">Đang kiểm tra hệ thống dùng chung…</div>;
  }

  if (loadError && !workspace) {
    return (
      <section className="glass rounded-card p-5">
        <h2 className="font-bold">Chưa kết nối được máy chủ</h2>
        <p className="mt-2 text-sm text-muted">{loadError} Dữ liệu cục bộ trên thiết bị vẫn được giữ nguyên.</p>
        <Button className="mt-4" onClick={() => void refresh()}>Thử lại</Button>
      </section>
    );
  }

  if (!workspace) {
    return (
      <div className="grid gap-4">
        <section className="glass rounded-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-pine-soft text-pine"><Cloud className="size-5" /></span>
            <div>
              <h2 className="text-lg font-bold">Kết nối hệ thống cửa hàng</h2>
              <p className="text-sm text-muted">Tạo sổ dùng chung. Các thiết bị đăng nhập bằng cùng mã chủ sẽ tự dùng chung sổ này.</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid content-start gap-3 rounded-xl border border-pine/25 bg-pine/5 p-4">
              <h3 className="font-bold text-pine">Tạo hệ thống mới</h3>
              <Field label="Tên hệ thống">
                <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
              </Field>
              <p className="text-sm text-muted">Sổ đang có trên thiết bị này sẽ trở thành bản dữ liệu ban đầu.</p>
              <Button disabled={busy || !name.trim()} onClick={() => void create()}>Tạo hệ thống</Button>
            </div>
          </div>
        </section>
        <section className="glass rounded-card p-4 text-sm text-muted">
          <p className="flex items-center gap-2 font-semibold text-ink"><Shield className="size-4 text-pine" /> Lưu trữ và ngoại tuyến</p>
          <p className="mt-2">Mỗi thao tác được lưu trước trên thiết bị. Khi có mạng, dữ liệu mới được đồng bộ lên sổ dùng chung; thành viên đã kết nối vẫn xem được bản cục bộ khi mất mạng.</p>
          <Button className="mt-3" tone="ghost" onClick={() => nav.show({ view: "backup" })}>Mở sao lưu / khôi phục</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="glass rounded-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-copper">Hệ thống dùng chung</p>
            <h2 className="mt-1 break-words text-xl font-bold">{workspace.name}</h2>
            <p className="mt-1 text-sm text-muted">Mã hệ thống: <span className="font-mono">{workspace.id}</span></p>
          </div>
          <Badge tone={workspace.role === "admin" ? "pine" : "muted"}>{workspace.role === "admin" ? "Quản trị viên" : "Thành viên"}</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button tone="ghost" disabled={busy} onClick={() => void refresh()}><RefreshCw className="size-4" /> Làm mới</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "backup" })}>Sao lưu dữ liệu</Button>
        </div>
      </section>

      <section className="glass rounded-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Cloud className="size-5 text-pine" />
          <h3 className="font-bold">Thiết bị của hệ thống</h3>
        </div>
        <div className="grid gap-2">
          {workspace.devices.map((entry) => (
            <div key={`${entry.userId}-${entry.deviceId}`} className="flex items-center gap-2 rounded-xl border border-line bg-bg/40 px-3 py-2 text-sm">
              {entry.online ? <Wifi className="size-4 shrink-0 text-ok" /> : <WifiOff className="size-4 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1 truncate">{entry.name}{entry.deviceId === device?.id ? " · thiết bị này" : ""}</span>
              <span className={entry.online ? "text-ok" : "text-muted"}>{entry.online ? "Online" : "Offline"}</span>
            </div>
          ))}
          {workspace.devices.length === 0 ? <EmptyState title="Chưa có thiết bị" body="Thiết bị sẽ xuất hiện khi mở ứng dụng bằng mã chủ." /> : null}
        </div>
      </section>
    </div>
  );
}
