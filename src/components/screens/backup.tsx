import { useState } from "react";
import { toast } from "sonner";
import { parseBackup } from "@/lib/backup";
import { buildBackup, downloadText } from "@/lib/backup";
import { formatWhen, todayISO } from "@/lib/format";
import { useShop } from "@/lib/store";
import type { BackupFile } from "@/lib/types";
import { Button, errorText } from "@/components/ui";

export function BackupScreen() {
  const shop = useShop();
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const settings = await shop.markBackup();
      const file = buildBackup({
        settings,
        parts: shop.parts,
        moves: shop.moves,
        customers: shop.customers,
        repairs: shop.repairs,
        quotes: shop.quotes,
        invoices: shop.invoices,
      });
      downloadText(`so-dien-lanh-${todayISO()}.json`, JSON.stringify(file, null, 2));
      toast.success("Đã tải file sao lưu. Hãy giữ file này khi đổi máy.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const raw: unknown = JSON.parse(await file.text());
      setPending(parseBackup(raw));
      setArmed(false);
    } catch (error) {
      setPending(null);
      toast.error(error instanceof SyntaxError ? "File không phải JSON." : errorText(error));
    }
  }

  async function onRestore() {
    if (!pending || !armed) return;
    setBusy(true);
    try {
      await shop.restore(pending);
      setPending(null);
      setArmed(false);
      toast.success("Đã khôi phục toàn bộ sổ trên máy này.");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-pretty text-muted">
        Toàn bộ kho, khách, phiếu sửa, báo giá và hóa đơn đang nằm trong bộ nhớ máy này. Tải một file JSON và giữ nó. Sang điện thoại khác, mở ứng dụng rồi chọn file đó để khôi phục.
      </p>
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="font-bold">Đang có trên máy</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <li>{shop.parts.length} linh kiện</li>
          <li>{shop.moves.length} lần nhập xuất</li>
          <li>{shop.customers.length} khách</li>
          <li>{shop.repairs.length} phiếu sửa</li>
          <li>{shop.quotes.length} báo giá</li>
          <li>{shop.invoices.length} hóa đơn</li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Lần sao lưu gần nhất: {shop.settings.lastBackupAt ? formatWhen(shop.settings.lastBackupAt) : "chưa sao lưu"}
        </p>
        <Button className="mt-3 w-full" disabled={busy} onClick={() => void onExport()}>
          {busy ? "Đang chuẩn bị…" : "Tải file sao lưu"}
        </Button>
      </div>
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="font-bold">Khôi phục từ file</p>
        <p className="mt-1 text-sm text-pretty text-muted">Việc này thay toàn bộ dữ liệu đang có trên máy bằng nội dung file. Không gộp từng phần.</p>
        <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line bg-bg px-3 text-center font-semibold">
          Chọn file .json
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        {pending ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm">
              File xuất lúc {formatWhen(pending.exportedAt)} · {pending.parts.length} linh kiện · {pending.customers.length} khách · {pending.repairs.length} phiếu · {pending.invoices.length} hóa đơn · cửa hàng “{pending.settings.shopName}”.
            </p>
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input className="mt-1 size-5" type="checkbox" checked={armed} onChange={(event) => setArmed(event.target.checked)} />
              Tôi hiểu dữ liệu hiện tại trên máy này sẽ bị thay thế.
            </label>
            <Button tone="danger" disabled={!armed || busy} onClick={() => void onRestore()}>
              Khôi phục và thay toàn bộ
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
