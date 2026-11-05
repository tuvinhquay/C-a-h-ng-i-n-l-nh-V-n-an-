import { useMemo, useState } from "react";
import { toast } from "sonner";
import { isLowStock } from "@/lib/domain";
import { matchesQuery, parseMoney, parseQty, qtyText, vnd } from "@/lib/format";
import type { Nav } from "@/lib/nav";
import { useShop } from "@/lib/store";
import type { Part } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Modal, errorText, fieldClass } from "@/components/ui";

const MACHINES = ["Điều hòa", "Tủ lạnh", "Tủ đông", "Máy giặt", "Máy nước nóng", "Máy sấy", "Máy lọc nước", "Quạt"];
const UNITS = ["Cái", "Bộ", "Mét", "Cuộn", "Kg", "Chai", "Lon", "Lần"];

export function PartsScreen({ nav, lowOnly = false }: { nav: Nav; lowOnly?: boolean }) {
  const shop = useShop();
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(lowOnly);
  const [machine, setMachine] = useState("all");
  const [stockPart, setStockPart] = useState<Part | null>(null);
  const machines = useMemo(
    () => Array.from(new Set(shop.parts.map((part) => part.machineType).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi")),
    [shop.parts],
  );
  const visible = shop.parts.filter((part) => {
    if (onlyLow && !isLowStock(part)) return false;
    if (machine !== "all" && part.machineType !== machine) return false;
    return matchesQuery(`${part.name} ${part.sku} ${part.brand} ${part.machineType} ${part.note}`, query);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={() => nav.go({ view: "part" })}>
          Thêm linh kiện
        </Button>
        <Button tone="ghost" onClick={() => nav.go({ view: "moves" })}>
          Lịch sử
        </Button>
      </div>
      <input className={fieldClass} value={query} placeholder="Tìm tên, mã, hãng…" onChange={(event) => setQuery(event.target.value)} />
      <div className="flex gap-2 overflow-x-auto">
        <FilterChip active={onlyLow} onClick={() => setOnlyLow((value) => !value)}>
          Tồn thấp
        </FilterChip>
        <FilterChip active={machine === "all"} onClick={() => setMachine("all")}>
          Mọi loại máy
        </FilterChip>
        {machines.map((item) => (
          <FilterChip key={item} active={machine === item} onClick={() => setMachine(item)}>
            {item}
          </FilterChip>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          title={shop.parts.length === 0 ? "Kho đang trống" : "Không khớp bộ lọc"}
          body={shop.parts.length === 0 ? "Thêm linh kiện thật của xưởng. Tồn đầu sẽ được ghi vào sổ nhập xuất." : "Thử từ khóa khác hoặc bỏ lọc tồn thấp."}
          action={shop.parts.length === 0 ? <Button onClick={() => nav.go({ view: "part" })}>Thêm linh kiện đầu tiên</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((part) => (
            <article key={part.id} className="rounded-card border border-line bg-surface p-4">
              <button type="button" className="w-full text-left" onClick={() => nav.go({ view: "part", id: part.id })}>
                <span className="flex items-start justify-between gap-2">
                  <span>
                    <span className="block text-lg font-bold text-ink">{part.name}</span>
                    <span className="text-sm text-muted">
                      {part.sku}
                      {part.brand ? ` · ${part.brand}` : ""}
                      {part.machineType ? ` · ${part.machineType}` : ""}
                    </span>
                  </span>
                  {isLowStock(part) ? <Badge tone="danger">Tồn thấp</Badge> : <Badge tone="ok">Đủ hàng</Badge>}
                </span>
                <span className={`mt-2 block text-3xl font-bold tabular-nums ${isLowStock(part) ? "text-danger" : "text-ink"}`}>
                  {qtyText(part.stock)} <span className="text-base font-semibold text-muted">{part.unit}</span>
                </span>
                <span className="mt-1 block text-sm tabular-nums text-muted">
                  Bán {vnd(part.sellPrice)} · Vốn {vnd(part.costPrice)} · Tối thiểu {qtyText(part.minStock)}
                </span>
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button tone="pine" onClick={() => setStockPart(part)}>
                  Nhập / xuất
                </Button>
                <Button tone="ghost" onClick={() => nav.go({ view: "part", id: part.id })}>
                  Sửa
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <StockDialog part={stockPart} onClose={() => setStockPart(null)} />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${active ? "bg-pine text-on-pine" : "bg-surface text-ink border border-line"}`}>
      {children}
    </button>
  );
}

export function PartEditor({ nav, id }: { nav: Nav; id?: string }) {
  const shop = useShop();
  const part = id ? shop.parts.find((item) => item.id === id) : undefined;
  const [sku, setSku] = useState(part?.sku ?? "");
  const [name, setName] = useState(part?.name ?? "");
  const [machineType, setMachineType] = useState(part?.machineType ?? "");
  const [brand, setBrand] = useState(part?.brand ?? "");
  const [unit, setUnit] = useState(part?.unit ?? "Cái");
  const [costPrice, setCostPrice] = useState(part ? String(part.costPrice) : "");
  const [sellPrice, setSellPrice] = useState(part ? String(part.sellPrice) : "");
  const [openingStock, setOpeningStock] = useState(part ? String(part.stock) : "0");
  const [minStock, setMinStock] = useState(part ? String(part.minStock) : "1");
  const [note, setNote] = useState(part?.note ?? "");
  const [busy, setBusy] = useState(false);
  const history = part ? shop.moves.filter((move) => move.partId === part.id).slice(0, 12) : [];

  if (id && !part) return <EmptyState title="Không thấy linh kiện" body="Có thể đã bị xóa trên máy này." />;

  async function onSave() {
    setBusy(true);
    try {
      await shop.savePart(
        {
          sku,
          name,
          machineType,
          brand,
          unit,
          costPrice: parseMoney(costPrice),
          sellPrice: parseMoney(sellPrice),
          openingStock: part ? part.stock : parseQty(openingStock || "0"),
          minStock: parseQty(minStock || "0"),
          note,
        },
        part?.id,
      );
      toast.success(part ? "Đã lưu linh kiện" : "Đã thêm vào kho");
      nav.back();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!part) return;
    if (!window.confirm(`Xóa ${part.name} khỏi danh mục? Lịch sử nhập xuất vẫn giữ lại.`)) return;
    try {
      await shop.removePart(part.id);
      toast.success("Đã xóa linh kiện");
      nav.tab("parts");
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <Field label="Tên linh kiện">
        <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mã" hint={part ? undefined : "Để trống sẽ tự đánh LK-0001"}>
          <input className={fieldClass} value={sku} onChange={(event) => setSku(event.target.value)} />
        </Field>
        <Field label="Đơn vị">
          <input className={fieldClass} list="units" value={unit} onChange={(event) => setUnit(event.target.value)} />
        </Field>
        <Field label="Loại máy">
          <input className={fieldClass} list="machines" value={machineType} onChange={(event) => setMachineType(event.target.value)} />
        </Field>
        <Field label="Hãng">
          <input className={fieldClass} value={brand} onChange={(event) => setBrand(event.target.value)} />
        </Field>
        <Field label="Giá nhập">
          <input className={fieldClass} inputMode="numeric" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} />
        </Field>
        <Field label="Giá bán">
          <input className={fieldClass} inputMode="numeric" value={sellPrice} onChange={(event) => setSellPrice(event.target.value)} />
        </Field>
        {part ? (
          <Field label="Tồn hiện tại" hint="Đổi tồn bằng nút nhập, xuất hoặc kiểm kê để còn lịch sử.">
            <input className={fieldClass} value={`${qtyText(part.stock)} ${part.unit}`} readOnly />
          </Field>
        ) : (
          <Field label="Tồn đầu">
            <input className={fieldClass} inputMode="decimal" value={openingStock} onChange={(event) => setOpeningStock(event.target.value)} />
          </Field>
        )}
        <Field label="Tồn tối thiểu" hint="Khi tồn bằng hoặc thấp hơn mức này, sổ sẽ cảnh báo.">
          <input className={fieldClass} inputMode="decimal" value={minStock} onChange={(event) => setMinStock(event.target.value)} />
        </Field>
      </div>
      <Field label="Ghi chú">
        <textarea className={`${fieldClass} min-h-24 py-3`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <datalist id="machines">
        {MACHINES.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <datalist id="units">
        {UNITS.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <Button type="submit" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu linh kiện"}
      </Button>
      {part ? (
        <Button tone="danger" onClick={() => void onDelete()}>
          Xóa khỏi danh mục
        </Button>
      ) : null}
      {history.length > 0 ? (
        <section>
          <h2 className="mb-2 text-lg font-bold">Nhập xuất gần đây</h2>
          <MoveList moves={history} />
        </section>
      ) : null}
    </form>
  );
}

export function MovesScreen() {
  const shop = useShop();
  const [query, setQuery] = useState("");
  const visible = shop.moves.filter((move) => matchesQuery(`${move.partName} ${move.sku} ${move.note}`, query));
  return (
    <div className="flex flex-col gap-3">
      <input className={fieldClass} value={query} placeholder="Tìm theo tên, mã, ghi chú…" onChange={(event) => setQuery(event.target.value)} />
      {visible.length === 0 ? <EmptyState title="Chưa có lần nhập xuất" body="Tạo linh kiện có tồn đầu, hoặc nhập kho, sẽ hiện ở đây." /> : <MoveList moves={visible} />}
    </div>
  );
}

function MoveList({ moves }: { moves: import("@/lib/types").StockMove[] }) {
  return (
    <div className="flex flex-col gap-2">
      {moves.map((move) => (
        <article key={move.id} className="rounded-card border border-line bg-surface px-4 py-3">
          <p className="font-bold text-ink">
            {move.partName} <span className="font-medium text-muted">{move.sku}</span>
          </p>
          <p className="text-sm text-muted">
            {labelMove(move.type)} {qtyText(Math.abs(move.qtyChange))} · tồn {qtyText(move.stockBefore)} → {qtyText(move.stockAfter)}
          </p>
          <p className="text-sm text-muted">
            {move.note} · {new Date(move.createdAt).toLocaleString("vi-VN")}
          </p>
        </article>
      ))}
    </div>
  );
}

function labelMove(type: "in" | "out" | "adjust"): string {
  if (type === "in") return "Nhập";
  if (type === "out") return "Xuất";
  return "Kiểm kê";
}

function StockDialog({ part, onClose }: { part: Part | null; onClose: () => void }) {
  const shop = useShop();
  const [mode, setMode] = useState<"in" | "out" | "count">("in");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!part) return;
    setBusy(true);
    try {
      const amount = parseQty(qty || "0");
      const move = await shop.postStock({ partId: part.id, mode, qty: amount, note });
      toast.success(move ? "Đã ghi sổ kho" : "Tồn kho không đổi");
      onClose();
      setQty("");
      setNote("");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={Boolean(part)} title={part ? part.name : "Kho"} onClose={onClose}>
      {part ? (
        <div className="flex flex-col gap-3">
          <p className="text-base text-muted">
            Đang còn <strong className="text-ink">{qtyText(part.stock)} {part.unit}</strong>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button tone={mode === "in" ? "pine" : "ghost"} onClick={() => setMode("in")}>
              Nhập
            </Button>
            <Button tone={mode === "out" ? "pine" : "ghost"} onClick={() => setMode("out")}>
              Xuất
            </Button>
            <Button tone={mode === "count" ? "pine" : "ghost"} onClick={() => setMode("count")}>
              Kiểm kê
            </Button>
          </div>
          <Field label={mode === "count" ? "Số đếm thực tế" : "Số lượng"} hint={mode === "count" ? "Sổ ghi phần chênh so với tồn hiện tại." : "Không trừ quá tồn đang có."}>
            <input className={fieldClass} inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhà cung cấp, lý do xuất…" />
          </Field>
          <Button disabled={busy} onClick={() => void onSubmit()}>
            {busy ? "Đang ghi…" : "Ghi sổ"}
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}
