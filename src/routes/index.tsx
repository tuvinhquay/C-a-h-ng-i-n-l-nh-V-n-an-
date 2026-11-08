import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { authEnabled } from "@/lib/auth/client";
import { SignInGate } from "@/lib/auth/gates";

type AccessKeyStatus = { initialized: boolean };

function Home() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!authEnabled) {
      setStatus("ready");
      return;
    }
    let active = true;
    void fetch("/api/auth/access-key/status", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không kiểm tra được mã chủ.");
        return (await response.json()) as AccessKeyStatus;
      })
      .then((result) => {
        if (!active) return;
        if (!result.initialized) {
          void navigate({ to: "/login", replace: true });
          return;
        }
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (status === "loading") {
    return <main className="grid min-h-dvh place-items-center text-sm text-muted">Đang kiểm tra mã bảo mật…</main>;
  }
  if (status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center px-4 py-8">
        <section className="glass w-full max-w-md rounded-card p-6 text-center">
          <h1 className="text-xl font-bold">Chưa kết nối được máy chủ xác thực</h1>
          <p className="mt-2 text-sm text-muted">Dữ liệu cục bộ vẫn được giữ nguyên. Hãy thử lại sau.</p>
          <Link to="/login" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-pine px-5 font-semibold text-on-pine">
            Thử mở đăng nhập
          </Link>
        </section>
      </main>
    );
  }

  return (
    <SignInGate fallback={<Navigate to="/login" replace />}>
      <AppShell />
    </SignInGate>
  );
}

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});
