import { useState } from "react";
import { toast } from "sonner";
import { statusLabel, warrantyLabel } from "@/lib/domain";
import { formatWhen, matchesQuery } from "@/lib/format";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import { Badge, Button, EmptyState, Field, errorText, fieldClass } from "@/components/ui";

export function CustomersScreen({ nav }: { nav: Nav }) {
  const shop = useShop();
  const [query, setQuery] = useState("");
  const visible = shop.customers.filter((customer) => matchesQuery(`${customer.name} ${customer.phone} ${customer.address} ${customer.note}`, query));
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => nav.go({ view: "customer" })}>Thêm khách</Button>
      <input className={fieldClass} value={query} placeholder="Tìm tên hoặc số điện thoại…" onChange={(event) => setQuery(event.target.value)} />
      {visible.length === 0 ? (
        <EmptyState title={shop.customers.length === 0 ? "Chưa có khách" : "Không thấy khách"} body="Hồ sơ khách giúp đối chiếu các lần sửa trước và hạn bảo hành." action={shop.customers.length === 0 ? <Button onClick={() => nav.go({ view: "customer" })}>Tạo hồ sơ</Button> : undefined} />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((customer) => {
            const jobs = shop.repairs.filter((repair) => repair.customerId === customer.id).length;
            return (
              <button key={customer.id} type="button" className="rounded-card border border-line bg-surface px-4 py-3 text-left" onClick={() => nav.go({ view: "customer", id: customer.id })}>
                <span className="block text-lg font-bold">{customer.name}</span>
                <span className="text-sm text-muted">
                  {customer.phone || "Chưa có số"} · {jobs} phiếu
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CustomerEditor({ nav, id }: { nav: Nav; id?: string }) {
  const shop = useShop();
  const customer = id ? shop.customers.find((item) => item.id === id) : undefined;
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [note, setNote] = useState(customer?.note ?? "");
  const [busy, setBusy] = useState(false);
  const repairs = customer ? shop.repairs.filter((repair) => repair.customerId === customer.id) : [];

  if (id && !customer) return <EmptyState title="Không thấy khách" body="Hồ sơ không còn trên máy này." />;

  async function onSave() {
    setBusy(true);
    try {
      const saved = await shop.saveCustomer({ name, phone, address, note }, customer?.id);
      toast.success("Đã lưu khách");
      if (!customer) nav.go({ view: "customer", id: saved.id });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!customer) return;
    if (!window.confirm(`Xóa hồ sơ ${customer.name}?`)) return;
    try {
      await shop.removeCustomer(customer.id);
      toast.success("Đã xóa khách");
      nav.tab("home");
      nav.go({ view: "customers" });
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <Field label="Tên khách">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Số điện thoại">
          <input className={fieldClass} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="Địa chỉ">
          <input className={fieldClass} value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field label="Ghi chú">
          <textarea className={`${fieldClass} min-h-24 py-3`} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu hồ sơ"}
        </Button>
        {customer ? (
          <Button tone="pine" onClick={() => nav.go({ view: "repair", customerId: customer.id })}>
            Tạo phiếu sửa cho khách này
          </Button>
        ) : null}
        {customer ? (
          <Button tone="danger" onClick={() => void onDelete()}>
            Xóa hồ sơ
          </Button>
        ) : null}
      </form>
      {customer ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Lịch sử sửa chữa</h2>
          {repairs.length === 0 ? <p className="text-base text-muted">Chưa có phiếu nào.</p> : null}
          {repairs.map((repair) => (
            <button key={repair.id} type="button" className="rounded-card border border-line bg-surface px-4 py-3 text-left" onClick={() => nav.go({ view: "repair", id: repair.id })}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold">{repair.deviceName}</span>
                <Badge tone={repair.status === "done" ? "ok" : repair.status === "open" ? "copper" : "muted"}>{statusLabel(repair.status)}</Badge>
              </span>
              <span className="mt-1 block text-sm text-muted">
                {repair.code} · {formatWhen(repair.createdAt)}
                {repair.model ? ` · ${repair.model}` : ""}
                {repair.serial ? ` · SN ${repair.serial}` : ""}
              </span>
              <span className="mt-1 block text-sm text-pine">{warrantyLabel(repair)}</span>
              {repair.symptom ? <span className="mt-1 block text-sm text-ink">Triệu chứng: {repair.symptom}</span> : null}
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
