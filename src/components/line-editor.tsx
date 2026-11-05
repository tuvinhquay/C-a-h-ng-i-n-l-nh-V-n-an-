import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { isLowStock } from "@/lib/domain";
import { lineAmount, matchesQuery, qtyText, uid, vnd } from "@/lib/format";
import type { LineItem, Part } from "@/lib/types";
import { Badge, Button, fieldClass } from "@/components/ui";

export function LineEditor({
  lines,
  onChange,
  parts,
  allowServices,
  locked,
}: {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  parts: Part[];
  allowServices: boolean;
  locked?: boolean;
}) {
  const [query, setQuery] = useState("");
  const hits = useMemo(() => {
    const needle = query.trim();
    if (!needle) return parts.slice(0, 6);
    return parts.filter((part) => matchesQuery(`${part.name} ${part.sku} ${part.brand} ${part.machineType}`, needle)).slice(0, 8);
  }, [parts, query]);

  function addPart(part: Part) {
    const existing = lines.find((line) => line.partId === part.id);
    if (existing) {
      onChange(lines.map((line) => (line.id === existing.id ? { ...line, qty: Math.round((line.qty + 1) * 1000) / 1000 } : line)));
    } else {
      onChange([
        ...lines,
        {
          id: uid(),
          kind: "part",
          partId: part.id,
          name: part.name,
          unit: part.unit,
          qty: 1,
          unitPrice: part.sellPrice,
        },
      ]);
    }
    setQuery("");
  }

  function addCustom(kind: "labor" | "fee") {
    onChange([
      ...lines,
      {
        id: uid(),
        kind,
        partId: null,
        name: kind === "labor" ? "Công thợ" : "Phụ phí",
        unit: "Lần",
        qty: 1,
        unitPrice: 0,
      },
    ]);
  }

  function patch(id: string, partial: Partial<LineItem>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...partial } : line)));
  }

  return (
    <div className="flex flex-col gap-3">
      {locked ? null : (
        <div className="rounded-card border border-line bg-bg p-3">
          <p className="text-sm font-semibold text-ink">Thêm linh kiện từ kho</p>
          <input
            className={`${fieldClass} mt-2`}
            value={query}
            placeholder="Gõ tên, mã, hãng…"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-2 flex flex-col gap-2">
            {hits.length === 0 ? <p className="text-sm text-muted">Không thấy linh kiện. Hãy thêm vào kho trước.</p> : null}
            {hits.map((part) => (
              <button
                key={part.id}
                type="button"
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface px-3 text-left"
                onClick={() => addPart(part)}
              >
                <span>
                  <span className="block font-semibold text-ink">{part.name}</span>
                  <span className="text-sm text-muted">
                    {part.sku} · còn {qtyText(part.stock)} {part.unit} · {vnd(part.sellPrice)}
                  </span>
                </span>
                {isLowStock(part) ? <Badge tone="danger">Thấp</Badge> : <Plus className="size-5 text-pine" />}
              </button>
            ))}
          </div>
          {allowServices ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button tone="soft" onClick={() => addCustom("labor")}>
                <Plus className="size-4" /> Công thợ
              </Button>
              <Button tone="ghost" onClick={() => addCustom("fee")}>
                <Plus className="size-4" /> Phụ phí
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {lines.map((line) => {
        const part = line.partId ? parts.find((item) => item.id === line.partId) : undefined;
        const short = Boolean(part && line.qty > part.stock);
        return (
          <div key={line.id} className="rounded-card border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2">
              {locked ? (
                <p className="font-semibold text-ink">{line.name}</p>
              ) : (
                <input className={fieldClass} value={line.name} onChange={(event) => patch(line.id, { name: event.target.value })} />
              )}
              {locked ? null : (
                <button type="button" className="inline-flex size-11 shrink-0 items-center justify-center text-danger" aria-label="Xóa dòng" onClick={() => onChange(lines.filter((item) => item.id !== line.id))}>
                  <Trash2 className="size-5" />
                </button>
              )}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="text-sm font-medium text-muted">
                SL
                <input
                  className={`${fieldClass} mt-1 tabular-nums`}
                  inputMode="decimal"
                  disabled={locked}
                  value={String(line.qty)}
                  onChange={(event) => patch(line.id, { qty: Number(event.target.value.replace(",", ".")) || 0 })}
                />
              </label>
              <label className="text-sm font-medium text-muted">
                Đơn giá
                <input
                  className={`${fieldClass} mt-1 tabular-nums`}
                  inputMode="numeric"
                  disabled={locked}
                  value={String(line.unitPrice)}
                  onChange={(event) => patch(line.id, { unitPrice: Number(event.target.value.replace(/[^\d]/g, "")) || 0 })}
                />
              </label>
              <div className="text-sm font-medium text-muted">
                Tiền
                <p className="mt-1 flex min-h-12 items-center text-base font-bold tabular-nums text-ink">{vnd(lineAmount(line))}</p>
              </div>
            </div>
            {short ? (
              <p className="mt-2 text-sm font-semibold text-danger">
                Vượt tồn: kho còn {qtyText(part?.stock ?? 0)} {part?.unit}. Phiếu chưa trừ kho cho đến khi hoàn thành hoặc xuất hóa đơn bán.
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
