import { useState } from "react";
import { toast } from "sonner";
import { errorText, Button, Field, fieldClass } from "@/components/ui";
import { useShop } from "@/lib/store";

export function SettingsScreen({
  canInstall,
  onInstall,
}: {
  canInstall: boolean;
  onInstall: () => void;
}) {
  const shop = useShop();
  const [shopName, setShopName] = useState(shop.settings.shopName);
  const [ownerName, setOwnerName] = useState(shop.settings.ownerName);
  const [phone, setPhone] = useState(shop.settings.phone);
  const [address, setAddress] = useState(shop.settings.address);
  const [taxCode, setTaxCode] = useState(shop.settings.taxCode);
  const [invoiceNote, setInvoiceNote] = useState(shop.settings.invoiceNote);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    setBusy(true);
    try {
      await shop.saveSettings({ shopName, ownerName, phone, address, taxCode, invoiceNote });
      toast.success("Đã lưu thông tin cửa hàng");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
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
      <p className="text-base text-pretty text-muted">Tên và địa chỉ này in trên báo giá, phiếu sửa và hóa đơn. Dữ liệu vẫn chỉ nằm trên máy.</p>
      <Field label="Tên cửa hàng">
        <input className={fieldClass} value={shopName} onChange={(event) => setShopName(event.target.value)} />
      </Field>
      <Field label="Người lập phiếu">
        <input className={fieldClass} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
      </Field>
      <Field label="Điện thoại">
        <input className={fieldClass} inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </Field>
      <Field label="Địa chỉ">
        <textarea className={`${fieldClass} min-h-20 py-3`} value={address} onChange={(event) => setAddress(event.target.value)} />
      </Field>
      <Field label="Mã số thuế (nếu có)">
        <input className={fieldClass} value={taxCode} onChange={(event) => setTaxCode(event.target.value)} />
      </Field>
      <Field label="Dòng cuối hóa đơn">
        <textarea className={`${fieldClass} min-h-28 py-3`} value={invoiceNote} onChange={(event) => setInvoiceNote(event.target.value)} />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu"}
      </Button>
      {canInstall ? (
        <Button tone="pine" onClick={onInstall}>
          Cài ứng dụng ra màn hình chính
        </Button>
      ) : (
        <p className="text-sm text-muted">Trên điện thoại, mở menu trình duyệt và chọn “Thêm vào Màn hình chính” để dùng như ứng dụng. Lần mở sau vẫn chạy khi mất mạng.</p>
      )}
    </form>
  );
}
