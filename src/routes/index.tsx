import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { SignInGate } from "@/lib/auth/gates";

export const Route = createFileRoute("/")({
  ssr: false,
  component: () => (
    <SignInGate
      fallback={
        <main className="grid min-h-dvh place-items-center px-4 py-8">
          <section className="glass w-full max-w-md rounded-card p-8 text-center">
            <h1 className="text-2xl font-bold">Đăng nhập để mở sổ</h1>
            <p className="mt-2 text-muted">Tài khoản giúp bảo vệ dữ liệu và kết nối các thiết bị trong cửa hàng.</p>
            <Link to="/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-pine px-5 font-semibold text-on-pine">
              Đăng nhập / tạo tài khoản
            </Link>
          </section>
        </main>
      }
    >
      <AppShell />
    </SignInGate>
  ),
});
