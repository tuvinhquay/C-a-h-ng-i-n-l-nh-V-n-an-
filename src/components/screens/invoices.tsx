import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatWhen, matchesQuery, sumLines, uid, vnd } from "@/lib/format";
import { buildPaper } from "@/lib/paper";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import type { Invoice, LineItem } from "@/lib/types";
import { LineEditor } from "@/components/line-editor";
import { Badge, Button, EmptyState, Field, errorText, fieldClass } from "@/components/ui";

export function InvoicesScreen({ nav }: { nav: Nav }) {
  const shop = useShop();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "sale" | "repair">("all");
  const [month, setMonth] = useState("");
  const visible = shop.invoices.filter((invoice) => {
    if (kind !== "all" && invoice.kind !== kind) return false;
    if (month && !invoice.createdAt.startsWith(month)) return false;
    return matchesQuery(`${invoice.code} ${invoice.customerName} ${invoice.phone} ${invoice.deviceName} ${invoice.serial}`, query);
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => nav.go({ view: "sale" })}>Bán linh kiện</Button>
        <Button tone="pine" onClick={() => nav.go({ view: "repairs", filter: "done" })}>
          Lập từ phiếu sửa
        </Button>
      </div>
      <input className={fieldClass} value={query} placeholder="Tìm số hóa đơn, khách, serial…" onChange={(event) => setQuery(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "Tất cả"],
            ["sale", "Bán hàng"],
            ["repair", "Sửa chữa"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={`min-h-11 rounded-full px-3 text-sm font-semibold ${kind === id ? "bg-pine text-on-pine" : "border border-line bg-surface"}`} onClick={() => setKind(id)}>
            {label}
          </button>
        ))}
        <input className={`${fieldClass} w-auto`} type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Lọc theo tháng" />
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Chưa có hóa đơn" body="Hóa đơn bán hàng trừ kho ngay. Hóa đơn sửa chữa gắn với phiếu đã xong và in rõ hạn bảo hành." />
      ) : (
        visible.map((invoice) => (
          <button key={invoice.id} type="button" className="rounded-card border border-line bg-surface px-4 py-3 text-left" onClick={() => nav.go({ view: "invoice", id: invoice.id })}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{invoice.code}</span>
              <Badge tone={invoice.status === "void" ? "muted" : invoice.kind === "repair" ? "pine" : "copper"}>
                {invoice.status === "void" ? "Đã hủy" : invoice.kind === "repair" ? "Sửa chữa" : "Bán hàng"}
              </Badge>
            </span>
            <span className="mt-1 block text-sm text-muted">
              {invoice.customerName} · {formatWhen(invoice.createdAt)}
            </span>
            <span className="mt-1 block text-lg font-bold tabular-nums">{vnd(sumLines(invoice.lines))}</span>
          </button>
        ))
      )}
    </div>
  );
}

export function InvoiceDetail({ nav, id }: { nav: Nav; id: string }) {
  const shop = useShop();
  const invoice = shop.invoices.find((item) => item.id === id);
  if (!invoice) return <EmptyState title="Không thấy hóa đơn" body="Hóa đơn không còn trên máy này." />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{invoice.code}</h2>
        <Badge tone={invoice.status === "void" ? "muted" : "ok"}>{invoice.status === "void" ? "Đã hủy" : "Đang hiệu lực"}</Badge>
      </div>
      <p className="text-base text-muted">
        {invoice.customerName} · {formatWhen(invoice.createdAt)}
        {invoice.phone ? ` · ${invoice.phone}` : ""}
      </p>
      {invoice.deviceName ? (
        <p className="text-base">
          {invoice.deviceName}
          {invoice.model ? ` · ${invoice.model}` : ""}
          {invoice.serial ? ` · SN ${invoice.serial}` : ""}
        </p>
      ) : null}
      {invoice.warrantyStart && invoice.warrantyEnd ? (
        <p className="rounded-card bg-pine-soft px-4 py-3 font-semibold text-pine">
          Bảo hành từ {invoice.warrantyStart} đến {invoice.warrantyEnd}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {invoice.lines.map((line) => (
          <li key={line.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2">
            <span>
              {line.name}
              <span className="block text-sm text-muted">
                {line.qty} {line.unit} × {vnd(line.unitPrice)}
              </span>
            </span>
            <span className="font-bold tabular-nums">{vnd(Math.round(line.qty * line.unitPrice))}</span>
          </li>
        ))}
      </ul>
      <p className="text-xl font-bold tabular-nums">Tổng {vnd(sumLines(invoice.lines))}</p>
      <Button onClick={() => nav.openPaper(invoicePaper(invoice, shop.settings, shop.customers))}>In / PDF / Ảnh</Button>
      {invoice.repairId ? (
        <Button tone="ghost" onClick={() => nav.go({ view: "repair", id: invoice.repairId ?? undefined })}>
          Mở phiếu sửa
        </Button>
      ) : null}
      {invoice.status === "issued" ? (
        <Button
          tone="danger"
          onClick={() => {
            const message = invoice.kind === "sale" ? "Hủy hóa đơn và hoàn linh kiện vào kho?" : "Hủy hóa đơn sửa chữa? Kho không đổi vì đã xuất theo phiếu.";
            if (!window.confirm(message)) return;
            void shop.voidInvoice(invoice.id).then(
              () => toast.success("Đã hủy hóa đơn"),
              (error: unknown) => toast.error(errorText(error)),
            );
          }}
        >
          Hủy hóa đơn
        </Button>
      ) : null}
    </div>
  );
}

function invoicePaper(invoice: Invoice, settings: import("@/lib/types").Settings, customers: import("@/lib/types").Customer[]) {
  const customer = invoice.customerId ? customers.find((item) => item.id === invoice.customerId) : undefined;
  return buildPaper({
    title: invoice.kind === "repair" ? "HÓA ĐƠN SỬA CHỮA" : "HÓA ĐƠN BÁN HÀNG",
    code: invoice.code,
    when: invoice.createdAt,
    settings,
    customerName: customer?.name || invoice.customerName,
    phone: customer?.phone || invoice.phone,
    address: customer?.address || invoice.address,
    deviceName: invoice.deviceName,
    model: invoice.model,
    serial: invoice.serial,
    lines: invoice.lines,
    warrantyStart: invoice.warrantyStart,
    warrantyEnd: invoice.warrantyEnd,
    note: invoice.status === "void" ? `ĐÃ HỦY. ${invoice.note}` : invoice.note,
  });
}

export function SaleEditor({ nav }: { nav: Nav }) {
  const shop = useShop();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [busy, setBusy] = useState(false);
  const hits = useMemo(
    () => shop.customers.filter((customer) => matchesQuery(`${customer.name} ${customer.phone}`, query)).slice(0, 5),
    [query, shop.customers],
  );

  async function onIssue() {
    setBusy(true);
    try {
      const invoice = await shop.issueSale({
        customerId: customerId || null,
        customerName: customerName || "Khách lẻ",
        phone,
        address,
        note,
        lines,
      });
      toast.success(`Đã xuất ${invoice.code} và trừ kho`);
      nav.go({ view: "invoice", id: invoice.id });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-muted">Bán linh kiện lẻ. Khi lưu, tồn kho bị trừ ngay. Muốn hoàn hàng thì hủy hóa đơn.</p>
      <Field label="Tìm khách (không bắt buộc)">
        <input className={fieldClass} value={query} placeholder="Bỏ trống nếu khách lẻ" onChange={(event) => setQuery(event.target.value)} />
      </Field>
      {hits.map((customer) => (
        <button
          key={customer.id}
          type="button"
          className={`min-h-12 rounded-xl px-3 text-left ${customerId === customer.id ? "bg-pine text-on-pine" : "border border-line bg-surface"}`}
          onClick={() => {
            setCustomerId(customer.id);
            setCustomerName(customer.name);
            setPhone(customer.phone);
            setAddress(customer.address);
          }}
        >
          {customer.name}
        </button>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên trên hóa đơn">
          <input className={fieldClass} value={customerName} placeholder="Khách lẻ" onChange={(event) => { setCustomerName(event.target.value); setCustomerId(""); }} />
        </Field>
        <Field label="Điện thoại">
          <input className={fieldClass} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
      </div>
      <Field label="Địa chỉ">
        <input className={fieldClass} value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold">Hàng bán</h2>
        <p className="font-bold tabular-nums">{vnd(sumLines(lines))}</p>
      </div>
      <LineEditor lines={lines} onChange={setLines} parts={shop.parts} allowServices />
      <Field label="Ghi chú">
        <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button disabled={busy} onClick={() => void onIssue()}>
        {busy ? "Đang xuất…" : "Xuất hóa đơn và trừ kho"}
      </Button>
    </div>
  );
}

export function RepairBillEditor({ nav, repairId }: { nav: Nav; repairId: string }) {
  const shop = useShop();
  const repair = shop.repairs.find((item) => item.id === repairId);
  const [lines, setLines] = useState<LineItem[]>(() => (repair?.lines ?? []).map((line) => ({ ...line, id: uid() })));
  const [note, setNote] = useState(repair?.note ?? "");
  const [busy, setBusy] = useState(false);
  if (!repair) return <EmptyState title="Không thấy phiếu" body="Không lập được hóa đơn vì phiếu không còn." />;
  if (repair.status !== "done") {
    return <EmptyState title="Phiếu chưa xong" body="Hoàn thành phiếu sửa (xuất kho) trước, rồi mới lập hóa đơn." action={<Button onClick={() => nav.go({ view: "repair", id: repair.id })}>Mở phiếu</Button>} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base">
        {repair.code} · {repair.customerName} · {repair.deviceName}
      </p>
      {repair.warrantyStart && repair.warrantyEnd ? (
        <p className="rounded-card bg-pine-soft px-4 py-3 font-semibold text-pine">
          Hóa đơn sẽ ghi bảo hành {repair.warrantyStart} → {repair.warrantyEnd}
        </p>
      ) : (
        <p className="text-sm text-muted">Phiếu này không đặt bảo hành. Có thể sửa hạn trên phiếu rồi quay lại.</p>
      )}
      <p className="text-sm text-muted">Kho đã trừ lúc hoàn thành phiếu. Sửa giá ở đây chỉ đổi tiền trên hóa đơn, không đổi tồn.</p>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold">Nội dung thu</h2>
        <p className="font-bold tabular-nums">{vnd(sumLines(lines))}</p>
      </div>
      <LineEditor lines={lines} onChange={setLines} parts={shop.parts} allowServices />
      <Field label="Ghi chú hóa đơn">
        <textarea className={`${fieldClass} min-h-20 py-3`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void shop.issueRepairInvoice(repair.id, { note, lines }).then(
            (invoice) => {
              toast.success(`Đã lập ${invoice.code}`);
              nav.go({ view: "invoice", id: invoice.id });
            },
            (error: unknown) => {
              toast.error(errorText(error));
              setBusy(false);
            },
          );
        }}
      >
        {busy ? "Đang lập…" : "Lập hóa đơn sửa chữa"}
      </Button>
    </div>
  );
}
