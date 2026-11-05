import { useMemo, useState } from "react";
import { toast } from "sonner";
import { matchesQuery, sumLines, uid, vnd } from "@/lib/format";
import { buildPaper } from "@/lib/paper";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import type { LineItem, QuoteStatus } from "@/lib/types";
import { LineEditor } from "@/components/line-editor";
import { Badge, Button, EmptyState, Field, errorText, fieldClass } from "@/components/ui";

const STATUS: Array<{ id: QuoteStatus; label: string }> = [
  { id: "draft", label: "Nháp" },
  { id: "sent", label: "Đã gửi" },
  { id: "accepted", label: "Khách chốt" },
  { id: "rejected", label: "Không làm" },
];

function statusTone(status: QuoteStatus): "muted" | "pine" | "ok" | "danger" {
  if (status === "accepted") return "ok";
  if (status === "rejected") return "danger";
  if (status === "sent") return "pine";
  return "muted";
}

export function QuotesScreen({ nav }: { nav: Nav }) {
  const shop = useShop();
  const [query, setQuery] = useState("");
  const visible = shop.quotes.filter((quote) => matchesQuery(`${quote.code} ${quote.customerName} ${quote.phone} ${quote.title}`, query));
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => nav.go({ view: "quote" })}>Tạo báo giá</Button>
      <input className={fieldClass} value={query} placeholder="Tìm mã, khách, số điện thoại…" onChange={(event) => setQuery(event.target.value)} />
      {visible.length === 0 ? (
        <EmptyState title="Chưa có báo giá" body="Chọn linh kiện, công thợ và phụ phí. Giá sửa được trước khi gửi khách." action={<Button onClick={() => nav.go({ view: "quote" })}>Lập báo giá</Button>} />
      ) : (
        visible.map((quote) => (
          <button key={quote.id} type="button" className="rounded-card border border-line bg-surface px-4 py-3 text-left" onClick={() => nav.go({ view: "quote", id: quote.id })}>
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{quote.title}</span>
              <Badge tone={statusTone(quote.status)}>{STATUS.find((item) => item.id === quote.status)?.label}</Badge>
            </span>
            <span className="mt-1 block text-sm text-muted">
              {quote.code} · {quote.customerName}
            </span>
            <span className="mt-1 block font-bold tabular-nums">{vnd(sumLines(quote.lines))}</span>
          </button>
        ))
      )}
    </div>
  );
}

export function QuoteEditor({ nav, id }: { nav: Nav; id?: string }) {
  const shop = useShop();
  const existing = id ? shop.quotes.find((item) => item.id === id) : undefined;
  const [customerId, setCustomerId] = useState(existing?.customerId ?? "");
  const [customerName, setCustomerName] = useState(existing?.customerName ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [title, setTitle] = useState(existing?.title ?? "Báo giá sửa chữa");
  const [note, setNote] = useState(existing?.note ?? "");
  const [status, setStatus] = useState<QuoteStatus>(existing?.status ?? "draft");
  const [lines, setLines] = useState<LineItem[]>(() => (existing?.lines ?? []).map((line) => ({ ...line })));
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const hits = useMemo(
    () => shop.customers.filter((customer) => matchesQuery(`${customer.name} ${customer.phone}`, query)).slice(0, 5),
    [shop.customers, query],
  );

  if (id && !existing) return <EmptyState title="Không thấy báo giá" body="Báo giá không còn trên máy này." />;

  function chooseCustomer(idValue: string) {
    const customer = shop.customers.find((item) => item.id === idValue);
    if (!customer) return;
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address);
  }

  async function onSave() {
    setBusy(true);
    try {
      const saved = await shop.saveQuote(existing?.id ?? null, {
        customerId: customerId || null,
        customerName,
        phone,
        address,
        title,
        note,
        lines,
        status,
      });
      toast.success("Đã lưu báo giá");
      if (!existing) nav.go({ view: "quote", id: saved.id });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  function openPaper() {
    if (!existing) {
      toast.error("Hãy lưu báo giá trước khi xuất.");
      return;
    }
    nav.openPaper(
      buildPaper({
        title: "BÁO GIÁ SỬA CHỮA",
        code: existing.code,
        when: existing.updatedAt,
        settings: shop.settings,
        customerName: existing.customerName,
        phone: existing.phone,
        address: existing.address,
        lines: existing.lines,
        note: existing.note,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {existing ? <p className="font-bold text-pine">{existing.code}</p> : null}
      <Field label="Tiêu đề">
        <input className={fieldClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Tìm khách có sẵn">
        <input className={fieldClass} value={query} placeholder="Tên hoặc số điện thoại" onChange={(event) => setQuery(event.target.value)} />
      </Field>
      {hits.map((customer) => (
        <button key={customer.id} type="button" className={`min-h-12 rounded-xl px-3 text-left ${customerId === customer.id ? "bg-pine text-on-pine" : "border border-line bg-surface"}`} onClick={() => chooseCustomer(customer.id)}>
          {customer.name} · {customer.phone || "không số"}
        </button>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên trên báo giá">
          <input className={fieldClass} value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerId(""); }} />
        </Field>
        <Field label="Điện thoại">
          <input className={fieldClass} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
      </div>
      <Field label="Địa chỉ">
        <input className={fieldClass} value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        {STATUS.map((item) => (
          <button key={item.id} type="button" className={`min-h-11 rounded-full px-3 text-sm font-semibold ${status === item.id ? "bg-copper text-on-copper" : "border border-line bg-surface"}`} onClick={() => setStatus(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold">Hạng mục</h2>
        <p className="text-lg font-bold tabular-nums">{vnd(sumLines(lines))}</p>
      </div>
      <LineEditor lines={lines} onChange={setLines} parts={shop.parts} allowServices />
      <Field label="Ghi chú gửi khách">
        <textarea className={`${fieldClass} min-h-20 py-3`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <Button disabled={busy} onClick={() => void onSave()}>
        {busy ? "Đang lưu…" : "Lưu báo giá"}
      </Button>
      {existing ? (
        <>
          <Button tone="ghost" onClick={openPaper}>
            Xuất báo giá (in, PDF, ảnh)
          </Button>
          <Button tone="pine" onClick={() => nav.go({ view: "repair", fromQuoteId: existing.id })}>
            Chuyển thành phiếu sửa
          </Button>
          <Button
            tone="danger"
            onClick={() => {
              if (!window.confirm("Xóa báo giá này?")) return;
              void shop.removeQuote(existing.id).then(
                () => {
                  toast.success("Đã xóa báo giá");
                  nav.back();
                },
                (error: unknown) => toast.error(errorText(error)),
              );
            }}
          >
            Xóa báo giá
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted">Lưu xong mới xuất file hoặc chuyển thành phiếu sửa. Sửa giá trực tiếp trên từng dòng trước khi lưu.</p>
      )}
    </div>
  );
}
