import { useEffect, useRef, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getDeviceIdentity } from "@/lib/local-db";
import { useShop } from "@/lib/store";
import { getWorkspace, syncWorkspace } from "@/lib/workspace";
import { authEnabled } from "@/lib/auth/client";

type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

function snapshotOf(shop: ReturnType<typeof useShop>) {
  return {
    settings: shop.settings,
    parts: shop.parts,
    moves: shop.moves,
    customers: shop.customers,
    repairs: shop.repairs,
    quotes: shop.quotes,
    invoices: shop.invoices,
  };
}

export function WorkspaceSync() {
  const shop = useShop();
  const latest = useRef(shop);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  latest.current = shop;

  useEffect(() => {
    if (!authEnabled || !shop.ready) return;
    let active = true;
    let running = false;
    let timer = 0;
    let issueSignature = "";

    const sync = async () => {
      if (!active || running) return;
      if (!navigator.onLine) {
        setStatus("offline");
        return;
      }
      running = true;
      setStatus("syncing");
      try {
        const device = await getDeviceIdentity();
        const workspace = await getWorkspace({ data: device });
        if (!workspace) {
          if (active) setStatus("idle");
          return;
        }
        const current = latest.current;
        const document = { snapshot: snapshotOf(current), tombstones: current.tombstones };
        const result = await syncWorkspace({ data: { device, document } });
        if (!active) return;
        const latestDocument = {
          snapshot: snapshotOf(latest.current),
          tombstones: latest.current.tombstones,
        };
        if (
          JSON.stringify(document) === JSON.stringify(latestDocument) &&
          JSON.stringify(document) !== JSON.stringify(result.document)
        ) {
          await latest.current.applySyncDocument(result.document);
        }
        setStatus("synced");
        setErrorMessage("");
        const nextSignature = result.issues.join("|");
        if (nextSignature && nextSignature !== issueSignature) {
          toast.warning(nextSignature);
        }
        issueSignature = nextSignature;
      } catch (reason) {
        if (active) {
          setStatus(navigator.onLine ? "error" : "offline");
          setErrorMessage(reason instanceof Error ? reason.message : "Không đồng bộ được dữ liệu.");
        }
      } finally {
        running = false;
      }
    };

    const online = () => void sync();
    const offline = () => setStatus("offline");
    timer = window.setInterval(() => void sync(), 15_000);
    const initial = window.setTimeout(() => void sync(), 1_000);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(initial);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [shop.ready]);

  const Icon = status === "offline" || status === "error" ? CloudOff : status === "syncing" ? RefreshCw : Cloud;
  const label = {
    idle: "Chỉ lưu trên máy",
    syncing: "Đang đồng bộ",
    synced: "Đã đồng bộ",
    offline: "Chờ có mạng",
    error: "Lỗi đồng bộ",
  }[status];
  return (
    <span
      title={errorMessage || label}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-bg/70 px-2.5 py-1.5 text-xs font-semibold ${
        status === "error" ? "text-danger" : status === "synced" ? "text-ok" : "text-muted"
      }`}
      aria-live="polite"
    >
      <Icon className={`size-3.5 ${status === "syncing" ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
