import { useMemo, useState } from "react";
import { toast } from "sonner";
import { matchesRepairFilter, relatedRepairs, statusLabel, warrantyLabel, type RepairFilter } from "@/lib/domain";
import { addMonths, blankToNull, formatWhen, matchesQuery, todayISO, uid, vnd, sumLines } from "@/lib/format";
import { buildPaper } from "@/lib/paper";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import type { Customer, LineItem, RepairInput } from "@/lib/types";
import { LineEditor } from "@/components/line-editor";
import { Badge, Button, EmptyState, Field, errorText, fieldClass } from "@/components/ui";

const FILTERS: Array<{ id: RepairFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "open", label: "Đang sửa" },
  { id: "done", label: "Đã xong" },
  { id: "warranty", label: "Còn bảo hành" },
  { id: "expired", label: "Hết bảo hành" },
];

export function RepairsScreen({ nav, filter = "all" }: { nav: Nav; filter?: RepairFilter }) {
  const shop = useShop();
  const [current, setCurrent] = useState<RepairFilter>(filter);
  const [query, setQuery] = useState("");
  const visible = shop.repairs.filter((repair) => {
    if (!matchesRepairFilter(repair, current)) return false;
    return matchesQuery(`${repair.code} ${repair.customerName} ${repair.customerPhone} ${repair.deviceName} ${repair.model} ${repair.serial} ${repair.symptom}`, query);
  });
  return (
    <div className="flex flex-col gap-3">
      <Button onClick={() => nav.go({ view: "repair" })}>Tạo phiếu sửa</Button>
      <input className={fieldClass} value={query} placeholder="Tìm khách, serial, máy, mã phiếu…" onChange={(event) => setQuery(event.target.value)} />
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${current === item.id ? "bg-pine text-on-pine" : "border border-line bg-surface text-ink"}`} onClick={() => setCurrent(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Không có phiếu" body="Tạo phiếu khi nhận máy: ghi triệu chứng, linh kiện, công thợ và số tháng bảo hành." action={<Button onClick={() => nav.go({ view: "repair" })}>Tạo phiếu</Button>} />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((repair) => (
            <button key={repair.id} type="button" className="rounded-card border border-line bg-surface px-4 py-3 text-left" onClick={() => nav.go({ view: "repair", id: repair.id })}>
              <span className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold">{repair.deviceName}</span>
                <Badge tone={repair.status === "open" ? "copper" : repair.status === "done" ? "ok" : "muted"}>{statusLabel(repair.status)}</Badge>
              </span>
              <span className="mt-1 block text-sm text-muted">
                {repair.code} · {repair.customerName} · {formatWhen(repair.createdAt)}
              </span>
              <span className="mt-1 block text-sm text-pine">{warrantyLabel(repair)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function RepairEditor({ nav, id, fromQuoteId, presetCustomerId }: { nav: Nav; id?: string; fromQuoteId?: string; presetCustomerId?: string }) {
  const shop = useShop();
  const existing = id ? shop.repairs.find((item) => item.id === id) : undefined;
  const quote = !id && fromQuoteId ? shop.quotes.find((item) => item.id === fromQuoteId) : undefined;
  const lockedLines = existing?.status === "done" || existing?.status === "cancelled";
  const cancelled = existing?.status === "cancelled";
  const [customerId, setCustomerId] = useState(existing?.customerId ?? quote?.customerId ?? presetCustomerId ?? "");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(quote && !quote.customerId ? quote.customerName : "");
  const [newPhone, setNewPhone] = useState(quote?.phone ?? "");
  const [newAddress, setNewAddress] = useState(quote?.address ?? "");
  const [deviceName, setDeviceName] = useState(existing?.deviceName ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [serial, setSerial] = useState(existing?.serial ?? "");
  const [symptom, setSymptom] = useState(existing?.symptom ?? "");
  const [cause, setCause] = useState(existing?.cause ?? "");
  const [note, setNote] = useState(existing?.note ?? quote?.note ?? "");
  const [lines, setLines] = useState<LineItem[]>(() => {
    const source = existing?.lines ?? quote?.lines ?? [];
    return source.map((line) => ({ ...line, id: existing ? line.id : uid() }));
  });
  const [warrantyMonths, setWarrantyMonths] = useState(existing?.warrantyMonths ?? 6);
  const [warrantyStart, setWarrantyStart] = useState(existing?.warrantyStart ?? "");
  const [warrantyEnd, setWarrantyEnd] = useState(existing?.warrantyEnd ?? "");
  const [busy, setBusy] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");

  const customerHits = useMemo(() => {
    return shop.customers.filter((customer) => matchesQuery(`${customer.name} ${customer.phone}`, customerQuery)).slice(0, 6);
  }, [shop.customers, customerQuery]);

  const history = relatedRepairs(shop.repairs, {
    customerId: creating ? null : customerId,
    serial,
    excludeId: existing?.id,
  });

  if (id && !existing) return <EmptyState title="Không thấy phiếu" body="Phiếu không còn trong sổ trên máy này." />;

  function inputOf(): RepairInput {
    return {
      customerId: creating ? null : customerId || null,
      newCustomer: creating ? { name: newName, phone: newPhone, address: newAddress, note: "" } : null,
      deviceName,
      model,
      serial,
      symptom,
      cause,
      note,
      lines,
      warrantyMonths: Number(warrantyMonths) || 0,
      warrantyStart: blankToNull(warrantyStart),
      warrantyEnd: blankToNull(warrantyEnd),
    };
  }

  function setMonths(months: number) {
    setWarrantyMonths(months);
    if (months <= 0) {
      setWarrantyStart("");
      setWarrantyEnd("");
      return;
    }
    const start = warrantyStart || todayISO();
    setWarrantyStart(start);
    setWarrantyEnd(addMonths(start, months));
  }

  async function persist(complete: boolean) {
    setBusy(true);
    try {
      if (existing?.status === "done") {
        await shop.patchDoneRepair(existing.id, inputOf());
        toast.success("Đã lưu thông tin bảo hành");
        return;
      }
      const saved = await shop.saveRepair(existing?.id ?? null, inputOf(), complete);
      toast.success(complete ? "Đã hoàn thành và xuất kho" : "Đã lưu phiếu đang sửa");
      if (!existing) nav.go({ view: "repair", id: saved.id });
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(repairId: string) {
    if (!window.confirm("Hủy phiếu và hoàn lại linh kiện đã xuất kho?")) return;
    try {
      await shop.cancelRepair(repairId);
      toast.success("Đã hủy phiếu");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  function openPaper() {
    if (!existing) return;
    const customer = shop.customers.find((item) => item.id === existing.customerId);
    nav.openPaper(
      buildPaper({
        title: "PHIẾU SỬA CHỮA",
        code: existing.code,
        when: existing.completedAt ?? existing.updatedAt,
        settings: shop.settings,
        customerName: customer?.name || existing.customerName,
        phone: customer?.phone || existing.customerPhone,
        address: customer?.address || "",
        deviceName: existing.deviceName,
        model: existing.model,
        serial: existing.serial,
        symptom: existing.symptom,
        lines: existing.lines,
        warrantyStart: existing.warrantyStart,
        warrantyEnd: existing.warrantyEnd,
        note: [existing.cause ? `Nguyên nhân: ${existing.cause}` : "", existing.note].filter(Boolean).join("\n"),
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {existing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={existing.status === "open" ? "copper" : existing.status === "done" ? "ok" : "muted"}>{statusLabel(existing.status)}</Badge>
          <span className="font-bold">{existing.code}</span>
          <span className="text-sm text-pine">{warrantyLabel(existing)}</span>
        </div>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Khách hàng</h2>
        {cancelled ? (
          <p className="text-base">{existing?.customerName}</p>
        ) : (
          <>
            <input className={fieldClass} value={customerQuery} placeholder="Tìm khách đã có…" onChange={(event) => setCustomerQuery(event.target.value)} />
            {customerHits.map((customer) => (
              <CustomerHit key={customer.id} customer={customer} active={!creating && customerId === customer.id} onClick={() => { setCreating(false); setCustomerId(customer.id); }} />
            ))}
            <Button tone={creating ? "pine" : "ghost"} onClick={() => setCreating((value) => !value)}>
              {creating ? "Đang thêm khách mới" : "Khách mới"}
            </Button>
            {creating ? (
              <div className="grid gap-3">
                <Field label="Tên khách mới">
                  <input className={fieldClass} value={newName} onChange={(event) => setNewName(event.target.value)} />
                </Field>
                <Field label="Số điện thoại">
                  <input className={fieldClass} inputMode="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} />
                </Field>
                <Field label="Địa chỉ">
                  <input className={fieldClass} value={newAddress} onChange={(event) => setNewAddress(event.target.value)} />
                </Field>
              </div>
            ) : null}
          </>
        )}
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Thiết bị">
          <input className={fieldClass} value={deviceName} disabled={cancelled} onChange={(event) => setDeviceName(event.target.value)} placeholder="Điều hòa, tủ lạnh…" />
        </Field>
        <Field label="Model">
          <input className={fieldClass} value={model} disabled={cancelled} onChange={(event) => setModel(event.target.value)} />
        </Field>
        <Field label="Serial" hint="Nhập serial để lần sau đối chiếu đúng chiếc máy.">
          <input className={fieldClass} value={serial} disabled={cancelled} onChange={(event) => setSerial(event.target.value)} />
        </Field>
        <Field label="Bảo hành (tháng)">
          <input className={fieldClass} inputMode="numeric" disabled={cancelled} value={String(warrantyMonths)} onChange={(event) => setMonths(Number(event.target.value.replace(/[^\d]/g, "")) || 0)} />
        </Field>
        <Field label="Bảo hành từ">
          <input className={fieldClass} type="date" disabled={cancelled} value={warrantyStart} onChange={(event) => setWarrantyStart(event.target.value)} />
        </Field>
        <Field label="Bảo hành đến">
          <input className={fieldClass} type="date" disabled={cancelled} value={warrantyEnd} onChange={(event) => setWarrantyEnd(event.target.value)} />
        </Field>
      </section>
      <Field label="Triệu chứng">
        <textarea className={`${fieldClass} min-h-24 py-3`} disabled={cancelled} value={symptom} onChange={(event) => setSymptom(event.target.value)} />
      </Field>
      <Field label="Nguyên nhân">
        <textarea className={`${fieldClass} min-h-20 py-3`} disabled={cancelled} value={cause} onChange={(event) => setCause(event.target.value)} />
      </Field>
      <Field label="Ghi chú">
        <textarea className={`${fieldClass} min-h-20 py-3`} disabled={cancelled} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-lg font-bold">Linh kiện và công</h2>
          <p className="text-base font-bold tabular-nums">{vnd(sumLines(lines))}</p>
        </div>
        <LineEditor lines={lines} onChange={setLines} parts={shop.parts} allowServices locked={lockedLines} />
      </section>
      {history.length > 0 ? (
        <section className="rounded-card border border-pine bg-pine-soft p-3">
          <h2 className="font-bold text-pine">Lịch sử cùng khách hoặc cùng serial</h2>
          <div className="mt-2 flex flex-col gap-2">
            {history.map((repair) => (
              <button key={repair.id} type="button" className="rounded-xl bg-surface px-3 py-2 text-left" onClick={() => nav.go({ view: "repair", id: repair.id })}>
                <span className="font-semibold">{repair.deviceName}</span>
                <span className="block text-sm text-muted">
                  {formatWhen(repair.createdAt)} · {repair.customerName} · {warrantyLabel(repair)}
                </span>
                {repair.symptom ? <span className="block text-sm">{repair.symptom}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {cancelled ? null : existing?.status === "done" ? (
        <div className="grid gap-2">
          <Button disabled={busy} onClick={() => void persist(false)}>
            Lưu bảo hành và ghi chú
          </Button>
          <Button tone="pine" onClick={() => nav.go({ view: "repair-bill", repairId: existing.id })}>
            Xuất hóa đơn sửa chữa
          </Button>
          <Button tone="ghost" onClick={openPaper}>
            In phiếu
          </Button>
          <Button tone="danger" onClick={() => void cancel(existing.id)}>
            Hủy phiếu và hoàn kho
          </Button>
        </div>
      ) : (
        <div className="grid gap-2">
          <Button tone="pine" disabled={busy} onClick={() => void persist(true)}>
            Hoàn thành và xuất kho
          </Button>
          <Button tone="ghost" disabled={busy} onClick={() => void persist(false)}>
            Lưu, vẫn đang sửa
          </Button>
          {existing ? (
            <Button tone="soft" onClick={openPaper}>
              In phiếu nháp
            </Button>
          ) : null}
          {existing ? (
            <Button
              tone="danger"
              onClick={() => {
                if (!window.confirm("Xóa phiếu nháp này?")) return;
                void shop.removeRepair(existing.id).then(
                  () => {
                    toast.success("Đã xóa phiếu");
                    nav.tab("repairs");
                  },
                  (error: unknown) => toast.error(errorText(error)),
                );
              }}
            >
              Xóa phiếu nháp
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CustomerHit({ customer, active, onClick }: { customer: Customer; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`min-h-12 rounded-xl px-3 text-left ${active ? "bg-pine text-on-pine" : "bg-surface border border-line"}`} onClick={onClick}>
      <span className="font-semibold">{customer.name}</span>
      <span className={`block text-sm ${active ? "text-on-pine" : "text-muted"}`}>{customer.phone || "Không có số"}</span>
    </button>
  );
}
