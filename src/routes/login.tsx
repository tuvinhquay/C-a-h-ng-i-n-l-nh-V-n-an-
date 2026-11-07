import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Snowflake } from "lucide-react";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { Button, fieldClass } from "@/components/ui";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? "Không thể đăng nhập.");
        return;
      }
      await navigate({ to: "/", replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể hoàn tất đăng nhập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="glass w-full max-w-md rounded-card p-5 sm:p-8">
        <a href="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Về trang chủ
        </a>
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl border border-pine/40 bg-pine-soft text-pine">
            <Snowflake className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-copper">Vân An</p>
            <h1 className="text-xl font-bold">Đăng nhập nội bộ</h1>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted">
          Dữ liệu được lưu ngay trên thiết bị và đồng bộ khi có mạng.
        </p>

        {authEnabled ? (
          <>
            <div className="grid gap-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  tone="ghost"
                  disabled={busy}
                  onClick={() => void signIn(provider.providerId, { callbackURL: "/" }).catch((reason: unknown) =>
                    setError(reason instanceof Error ? reason.message : "Không thể mở đăng nhập."),
                  )}
                >
                  Tiếp tục với {provider.label}
                </Button>
              ))}
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              HOẶC EMAIL
              <span className="h-px flex-1 bg-line" />
            </div>
            <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
              {mode === "sign-up" ? (
                <label className="grid gap-1.5 text-sm font-semibold">
                  Tên hiển thị
                  <input className={fieldClass} autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm font-semibold">
                Email
                <input className={fieldClass} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Mật khẩu
                <input className={fieldClass} type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              {error ? <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                <KeyRound className="size-4" />
                {busy ? "Đang xử lý…" : mode === "sign-up" ? "Tạo tài khoản" : "Đăng nhập"}
              </Button>
            </form>
            <button
              type="button"
              className="mt-4 min-h-11 w-full text-sm font-semibold text-pine"
              onClick={() => {
                setError("");
                setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
              }}
            >
              {mode === "sign-up" ? "Đã có tài khoản? Đăng nhập" : "Tạo tài khoản mới"}
            </button>
          </>
        ) : (
          <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Đăng nhập chưa được bật.</p>
        )}
      </section>
    </main>
  );
}
