import { useEffect, useState } from "react";
import { Cloud, Copy, KeyRound, RefreshCw, Shield, UserRound, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Badge, EmptyState, Field, errorText, fieldClass } from "@/components/ui";
import { getDeviceIdentity } from "@/lib/local-db";
import { createWorkspace, createWorkspaceInvite, getWorkspace, joinWorkspace, removeWorkspaceMember, revokeWorkspaceInvite, syncWorkspace } from "@/lib/workspace";
import { useShop } from "@/lib/store";
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
  const [inviteCode, setInviteCode] = useState("");
  const [newInvite, setNewInvite] = useState<{ token: string; inviteId: string } | null>(null);
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

  async function join() {
    if (!device) return;
    const hasLocalData = shop.parts.length + shop.moves.length + shop.customers.length + shop.repairs.length + shop.quotes.length + shop.invoices.length > 0;
    if (hasLocalData && !window.confirm("Sổ dữ liệu hiện có trên thiết bị sẽ được gộp vào hệ thống được mời. Bạn đã sao lưu và muốn tiếp tục chứ?")) return;
    setBusy(true);
    try {
      await joinWorkspace({ data: { token: inviteCode, device } });
      const current = await syncWorkspace({ data: { device, document: documentOf(shop) } });
      await shop.applySyncDocument(current.document);
      setInviteCode("");
      toast.success("Thiết bị đã kết nối và đồng bộ dữ liệu.");
      await refresh(device);
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function issueInvite() {
    if (!device) return;
    setBusy(true);
    try {
      setNewInvite(await createWorkspaceInvite({ data: device }));
      toast.success("Đã tạo mã mời, mã chỉ hiển thị tại thiết bị này.");
      await refresh(device);
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusy(true);
    try {
      await revokeWorkspaceInvite({ data: { inviteId } });
      toast.success("Đã thu hồi mã mời.");
      await refresh();
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(memberUserId: string) {
    if (!window.confirm("Xóa thành viên này khỏi hệ thống dùng chung?")) return;
    setBusy(true);
    try {
      await removeWorkspaceMember({ data: { memberUserId } });
      toast.success("Đã xóa thành viên và các thiết bị của họ.");
      await refresh();
    } catch (reason) {
      toast.error(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!newInvite) return;
    try {
      await navigator.clipboard.writeText(newInvite.token);
      toast.success("Đã sao chép mã mời.");
    } catch (reason) {
      toast.error(`Không sao chép được: ${errorText(reason)}`);
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
              <p className="text-sm text-muted">Tạo một sổ dùng chung hoặc tham gia bằng mã mời của quản trị viên.</p>
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
            <div className="grid content-start gap-3 rounded-xl border border-copper/25 bg-copper/5 p-4">
              <h3 className="font-bold text-copper">Tham gia hệ thống</h3>
              <Field label="Mã mời">
                <input className={fieldClass} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="VA-…" autoComplete="off" />
              </Field>
              <p className="text-sm text-muted">Dữ liệu hiện có trên máy được gộp với sổ chung, không bị thay thế âm thầm.</p>
              <Button tone="soft" disabled={busy || inviteCode.trim().length < 20} onClick={() => void join()}>Kết nối thiết bị</Button>
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

  const users = new Map<string, typeof workspace.devices>();
  for (const entry of workspace.devices) {
    users.set(entry.userId, [...(users.get(entry.userId) ?? []), entry]);
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
          {workspace.role === "admin" ? <Button disabled={busy} onClick={() => void issueInvite()}><KeyRound className="size-4" /> Tạo mã mời</Button> : null}
          <Button tone="ghost" onClick={() => nav.show({ view: "backup" })}>Sao lưu dữ liệu</Button>
        </div>
        {newInvite ? (
          <div className="mt-4 rounded-xl border border-copper/35 bg-copper/5 p-4">
            <p className="text-sm font-bold text-copper">Mã mời — hết hạn sau 7 ngày, tối đa 20 lượt</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-bg/70 p-3 text-sm">{newInvite.token}</code>
              <Button tone="soft" onClick={() => void copyInvite()}><Copy className="size-4" /> Sao chép</Button>
            </div>
            <p className="mt-2 text-xs text-muted">Giữ mã này riêng tư. Có thể thu hồi trong danh sách mã mời.</p>
          </div>
        ) : null}
      </section>

      <section className="glass rounded-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserRound className="size-5 text-pine" />
          <h3 className="font-bold">Thành viên và thiết bị</h3>
        </div>
        <div className="grid gap-2">
          {[...users.entries()].map(([userId, devices]) => {
            const role = devices[0]?.role;
            const isSelf = userId === workspace.ownerId || devices.some((entry) => entry.deviceId === device?.id);
            return (
              <article key={userId} className="rounded-xl border border-line bg-bg/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold">{role === "admin" ? "Quản trị viên" : "Thành viên"} · {userId.slice(0, 10)}</p>
                    <p className="mt-1 text-xs text-muted">{devices.length} thiết bị</p>
                  </div>
                  {workspace.role === "admin" && role !== "admin" ? (
                    <Button tone="danger" className="min-h-10 px-3 text-sm" disabled={busy} onClick={() => void removeMember(userId)}>Xóa thành viên</Button>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {devices.map((entry) => (
                    <div key={entry.deviceId} className="flex items-center gap-2 rounded-lg bg-surface/50 px-3 py-2 text-sm">
                      {entry.online ? <Wifi className="size-4 shrink-0 text-ok" /> : <WifiOff className="size-4 shrink-0 text-muted" />}
                      <span className="min-w-0 flex-1 truncate">{entry.name}{entry.deviceId === device?.id ? " · thiết bị này" : ""}</span>
                      <span className={entry.online ? "text-ok" : "text-muted"}>{entry.online ? "Online" : "Offline"}</span>
                    </div>
                  ))}
                </div>
                {isSelf ? <p className="mt-2 text-xs text-muted">Tài khoản của bạn</p> : null}
              </article>
            );
          })}
          {workspace.devices.length === 0 ? <EmptyState title="Chưa có thiết bị" body="Thiết bị sẽ xuất hiện khi thành viên mở ứng dụng." /> : null}
        </div>
      </section>

      {workspace.role === "admin" ? (
        <section className="glass rounded-card p-5">
          <h3 className="font-bold">Quản lý mã mời</h3>
          <div className="mt-3 grid gap-2">
            {workspace.invites.map((invite) => {
              const expired = Date.now() >= new Date(invite.expiresAt).getTime();
              const disabled = Boolean(invite.revokedAt) || expired || invite.usesRemaining <= 0;
              return (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg/40 p-3">
                  <div>
                    <p className="text-sm font-semibold">{disabled ? invite.revokedAt ? "Đã thu hồi" : expired ? "Đã hết hạn" : "Đã dùng hết" : "Đang hoạt động"}</p>
                    <p className="text-xs text-muted">Còn {invite.usesRemaining} lượt · hết hạn {new Date(invite.expiresAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                  {!disabled ? <Button tone="danger" className="min-h-10 px-3 text-sm" disabled={busy} onClick={() => void revoke(invite.id)}>Thu hồi</Button> : null}
                </div>
              );
            })}
            {workspace.invites.length === 0 ? <p className="text-sm text-muted">Chưa tạo mã mời nào.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
