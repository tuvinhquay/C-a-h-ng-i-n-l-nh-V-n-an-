import {
  ClipboardList,
  FileText,
  House,
  Menu,
  Package,
  Settings,
  Shield,
  Snowflake,
  Users,
  Wrench,
  ArrowLeft,
  BookOpen,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import { downloadBlob } from "@/lib/backup";
import type { Nav, Screen, TabName } from "@/lib/nav";
import { screenTitle } from "@/lib/nav";
import { paperToPdf, paperToPng, warmFonts } from "@/lib/paper";
import { ShopProvider, useShop } from "@/lib/store";
import type { PaperDoc } from "@/lib/types";
import { PaperView } from "@/components/paper-view";
import { BackupScreen } from "@/components/screens/backup";
import { CustomerEditor, CustomersScreen } from "@/components/screens/customers";
import { HomeScreen } from "@/components/screens/home";
import { InvoiceDetail, InvoicesScreen, RepairBillEditor, SaleEditor } from "@/components/screens/invoices";
import { MovesScreen, PartEditor, PartsScreen } from "@/components/screens/parts";
import { QuoteEditor, QuotesScreen } from "@/components/screens/quotes";
import { RepairEditor, RepairsScreen } from "@/components/screens/repairs";
import { SettingsScreen } from "@/components/screens/settings";
import { WorkspaceScreen } from "@/components/screens/workspace";
import { WorkspaceSync } from "@/components/workspace-sync";
import { AssistantBot } from "@/components/assistant-bot";
import { GuideScreen } from "@/components/screens/guide";
import { UserButton } from "@/lib/auth/gates";
import { Button, errorText, Modal } from "@/components/ui";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function AppShell() {
  return (
    <ShopProvider>
      <Toaster position="top-center" />
      <Shell />
    </ShopProvider>
  );
}

function Shell() {
  const shop = useShop();
  const [stack, setStack] = useState<Screen[]>([{ view: "home" }]);
  const [more, setMore] = useState(false);
  const [paper, setPaper] = useState<PaperDoc | null>(null);
  const [exporting, setExporting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  const screen = stack[stack.length - 1] ?? { view: "home" };

  useEffect(() => {
    warmFonts();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPrompt);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      const base = import.meta.env.BASE_URL || "/";
      const url = `${base.endsWith("/") ? base : `${base}/`}sw.js`;
      navigator.serviceWorker.register(url).catch((error: unknown) => {
        console.error("Không thể kích hoạt chế độ ngoại tuyến.", error);
        toast.error("Không thể kích hoạt chế độ ngoại tuyến.");
      });
    }
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  const nav: Nav = {
    screen,
    go(next) {
      setStack((current) => [...current, next]);
    },
    back() {
      setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
    },
    show(next) {
      setStack([next]);
      setMore(false);
    },
    tab(view) {
      setStack([{ view }]);
      setMore(false);
    },
    openPaper(doc) {
      setPaper(doc);
    },
  };

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    setInstallEvent(null);
  }

  async function savePdf() {
    if (!paper) return;
    setExporting(true);
    try {
      const blob = await paperToPdf(paper);
      downloadBlob(`${paper.code}.pdf`, blob);
      toast.success("Đã tải PDF");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setExporting(false);
    }
  }

  async function savePng() {
    if (!paper) return;
    setExporting(true);
    try {
      const blob = await paperToPng(paper);
      downloadBlob(`${paper.code}.png`, blob);
      toast.success("Đã tải ảnh");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setExporting(false);
    }
  }

  if (!shop.ready) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-ink">
        <Mark />
        <h1 className="text-2xl font-bold">Cửa hàng điện lạnh Vân An</h1>
        <p className="text-base text-muted">Đang mở sổ dữ liệu trên máy…</p>
      </main>
    );
  }

  if (shop.error) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center text-ink">
        <h1 className="text-2xl font-bold">Không mở được sổ</h1>
        <p className="max-w-sm text-base text-muted">{shop.error}</p>
      </main>
    );
  }

  const active = tabOf(screen);

  return (
    <div className="min-h-dvh text-ink md:flex">
      {/* Sidebar desktop */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-4 py-5">
          <Mark />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-copper">Cửa hàng</p>
            <p className="text-lg font-bold leading-tight">Điện lạnh Vân An</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 px-3">
          <SideLink active={active === "home"} onClick={() => nav.tab("home")} icon={<House className="size-5" />} label="Tổng quan" />
          <SideLink active={active === "parts"} onClick={() => nav.tab("parts")} icon={<Package className="size-5" />} label="Kho linh kiện" />
          <SideLink active={active === "repairs"} onClick={() => nav.tab("repairs")} icon={<Wrench className="size-5" />} label="Sửa chữa" />
          <SideLink active={active === "invoices"} onClick={() => nav.tab("invoices")} icon={<FileText className="size-5" />} label="Hóa đơn" />
          <SideLink active={screen.view === "customers" || screen.view === "customer"} onClick={() => nav.show({ view: "customers" })} icon={<Users className="size-5" />} label="Khách hàng" />
          <SideLink active={screen.view === "quotes" || screen.view === "quote"} onClick={() => nav.show({ view: "quotes" })} icon={<ClipboardList className="size-5" />} label="Báo giá" />
          <SideLink active={screen.view === "backup"} onClick={() => nav.show({ view: "backup" })} icon={<Shield className="size-5" />} label="Sao lưu" />
          <SideLink active={screen.view === "workspace"} onClick={() => nav.show({ view: "workspace" })} icon={<Wifi className="size-5" />} label="Thiết bị & đồng bộ" />
          <SideLink active={screen.view === "guide"} onClick={() => nav.show({ view: "guide" })} icon={<BookOpen className="size-5" />} label="Hướng dẫn sử dụng" />
          <SideLink active={screen.view === "settings"} onClick={() => nav.show({ view: "settings" })} icon={<Settings className="size-5" />} label="Cửa hàng" />
        </div>
        <p className="px-4 py-4 text-sm text-muted">{shop.settings.shopName}</p>
        <div className="px-4 pb-4"><UserButton /></div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Header */}
        <header className="no-print sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
            {stack.length > 1 ? (
              <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl text-ink" onClick={() => nav.back()} aria-label="Quay lại">
                <ArrowLeft className="size-6" />
              </button>
            ) : (
              <Mark className="size-11 md:hidden" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-copper">{shop.settings.shopName || "Cửa hàng điện lạnh Vân An"}</p>
              <h1 className="truncate text-xl font-bold leading-tight">{screenTitle(screen)}</h1>
            </div>
            <WorkspaceSync />
            {online ? null : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-1 text-xs font-bold text-warn">
                <WifiOff className="size-3.5" /> Ngoại tuyến
              </span>
            )}
          </div>
        </header>

        <main className="no-print mx-auto flex w-full max-w-5xl flex-col px-4 py-4 pb-28 md:pb-10">
          <ScreenView screen={screen} nav={nav} canInstall={Boolean(installEvent)} onInstall={() => void install()} />
        </main>

        {/* Bottom Dock - Glass style */}
        <nav className="dock no-print z-20 glass md:hidden" aria-label="Mục chính">
          <div className="grid grid-cols-5 gap-1">
            <DockButton active={active === "home"} label="Tổng" onClick={() => nav.tab("home")} icon={<House className="size-5" />} />
            <DockButton active={active === "parts"} label="Kho" onClick={() => nav.tab("parts")} icon={<Package className="size-5" />} />
            <DockButton active={active === "repairs"} label="Sửa" onClick={() => nav.tab("repairs")} icon={<Wrench className="size-5" />} />
            <DockButton active={active === "invoices"} label="Đơn" onClick={() => nav.tab("invoices")} icon={<FileText className="size-5" />} />
            <DockButton active={more || active === "more"} label="Thêm" onClick={() => setMore(true)} icon={<Menu className="size-5" />} />
          </div>
        </nav>
      </div>

      <Modal open={more} title="Thêm" onClose={() => setMore(false)}>
        <div className="grid gap-2">
          <Button tone="ghost" onClick={() => nav.show({ view: "customers" })}>Khách hàng</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "quotes" })}>Báo giá</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "backup" })}>Sao lưu và khôi phục</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "workspace" })}>Thiết bị & đồng bộ</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "guide" })}>Hướng dẫn sử dụng</Button>
          <Button tone="ghost" onClick={() => nav.show({ view: "settings" })}>Thông tin cửa hàng</Button>
          {installEvent ? <Button onClick={() => void install()}>Cài ra màn hình chính</Button> : null}
          <div className="border-t border-line pt-3"><UserButton /></div>
        </div>
      </Modal>

      <AssistantBot onNavigate={(target) => nav.show(target)} />

      {paper ? (
        <>
          <div className="no-print fixed inset-0 z-40 overflow-y-auto bg-bg">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-10">
              <div className="flex flex-wrap gap-2">
                <Button tone="ghost" onClick={() => setPaper(null)}>Đóng</Button>
                <Button tone="pine" onClick={() => window.print()}>In / Lưu PDF máy</Button>
                <Button disabled={exporting} onClick={() => void savePdf()}>Tải PDF</Button>
                <Button tone="soft" disabled={exporting} onClick={() => void savePng()}>Tải ảnh</Button>
              </div>
              <p className="text-sm text-muted">Gửi file PDF hoặc ảnh qua Zalo. Nút in dùng hộp thoại của máy, có thể chọn “Lưu thành PDF”.</p>
              <PaperView doc={paper} />
            </div>
          </div>
          <div className="print-root" aria-hidden="true">
            <PaperView doc={paper} printable />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ScreenView({
  screen,
  nav,
  canInstall,
  onInstall,
}: {
  screen: Screen;
  nav: Nav;
  canInstall: boolean;
  onInstall: () => void;
}) {
  switch (screen.view) {
    case "home":
      return <HomeScreen nav={nav} />;
    case "parts":
      return <PartsScreen nav={nav} lowOnly={screen.lowOnly} />;
    case "part":
      return <PartEditor key={screen.id ?? "new"} nav={nav} id={screen.id} />;
    case "moves":
      return <MovesScreen />;
    case "customers":
      return <CustomersScreen nav={nav} />;
    case "customer":
      return <CustomerEditor key={screen.id ?? "new"} nav={nav} id={screen.id} />;
    case "repairs":
      return <RepairsScreen nav={nav} filter={screen.filter} />;
    case "repair":
      return <RepairEditor key={`${screen.id ?? "new"}-${screen.fromQuoteId ?? ""}-${screen.customerId ?? ""}`} nav={nav} id={screen.id} fromQuoteId={screen.fromQuoteId} presetCustomerId={screen.customerId} />;
    case "quotes":
      return <QuotesScreen nav={nav} />;
    case "quote":
      return <QuoteEditor key={screen.id ?? "new"} nav={nav} id={screen.id} />;
    case "invoices":
      return <InvoicesScreen nav={nav} />;
    case "invoice":
      return <InvoiceDetail nav={nav} id={screen.id} />;
    case "sale":
      return <SaleEditor nav={nav} />;
    case "repair-bill":
      return <RepairBillEditor nav={nav} repairId={screen.repairId} />;
    case "backup":
      return <BackupScreen />;
    case "guide":
      return <GuideScreen nav={nav} />;
    case "settings":
      return <SettingsScreen canInstall={canInstall} onInstall={onInstall} />;
    case "workspace":
      return <WorkspaceScreen nav={nav} />;
    default:
      return null;
  }
}

function tabOf(screen: Screen): TabName | "more" {
  if (screen.view === "home") return "home";
  if (screen.view === "parts" || screen.view === "part" || screen.view === "moves") return "parts";
  if (screen.view === "repairs" || screen.view === "repair") return "repairs";
  if (screen.view === "invoices" || screen.view === "invoice" || screen.view === "sale" || screen.view === "repair-bill") return "invoices";
  return "more";
}

function Mark({ className = "size-10" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-xl bg-pine/20 text-pine border border-pine/40 ${className}`} aria-hidden="true">
      <Snowflake className="size-5" />
    </span>
  );
}

function SideLink({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-base font-semibold transition-colors ${
        active ? "bg-pine-soft text-pine" : "text-muted hover:bg-white/5 hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DockButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
        active ? "text-pine" : "text-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
