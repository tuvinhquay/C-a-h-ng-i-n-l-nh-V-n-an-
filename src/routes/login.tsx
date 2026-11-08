import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Snowflake } from "lucide-react";
import { Button, fieldClass } from "@/components/ui";
import {
  authEnabled,
  getBearerToken,
  inLivePreview,
  setBearerToken,
} from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: AccessKeyLogin });

type Screen =
  | "loading"
  | "unavailable"
  | "ready-to-create"
  | "setup-pending"
  | "show-key"
  | "confirm-key"
  | "sign-in";
type AccessKeyStatus = { initialized: boolean; setupPending: boolean };
type AccessKeyResponse = { key: string; setupToken: string; token?: string };

async function accessKeyRequest<T>(
  path: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const headers = new Headers();
  const bearer = getBearerToken();
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  if (payload) headers.set("content-type", "application/json");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`/api/auth/access-key/${path}`, {
      method: payload ? "POST" : "GET",
      credentials: "same-origin",
      headers,
      signal: controller.signal,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") {
      throw new Error("Máy chủ chưa phản hồi. Hãy kiểm tra kết nối rồi thử lại.");
    }
    throw new Error("Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.");
  } finally {
    window.clearTimeout(timeout);
  }
  const result = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
    key?: string;
    setupToken?: string;
    token?: string;
    initialized?: boolean;
    setupPending?: boolean;
  } | null;
  if (!response.ok) {
    throw new Error(
      result?.message ??
        result?.error ??
        `Không thể hoàn tất yêu cầu (HTTP ${response.status}).`,
    );
  }
  if (!result) throw new Error("Máy chủ trả về dữ liệu không hợp lệ. Hãy thử lại.");
  return result as T;
}

function AccessKeyLogin() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("loading");
  const [generatedKey, setGeneratedKey] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [enteredKey, setEnteredKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const initialCheck = useRef(false);

  const checkStatus = useCallback(async () => {
    setScreen("loading");
    setError("");
    try {
      const status = await accessKeyRequest<AccessKeyStatus>("status");
      if (status.initialized) {
        setScreen("sign-in");
      } else if (status.setupPending) {
        setScreen("setup-pending");
      } else {
        setScreen("ready-to-create");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không kiểm tra được hệ thống.");
      setScreen("unavailable");
    }
  }, []);

  function applySetup(result: AccessKeyResponse) {
    setGeneratedKey(result.key);
    setSetupToken(result.setupToken);
    setEnteredKey("");
    setError("");
    setScreen("show-key");
  }

  async function beginSetup(restart: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = await accessKeyRequest<AccessKeyResponse>("begin", { restart });
      applySetup(result);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Không thể tạo mã bí mật.";
      if (message.includes("Mã chủ đã được thiết lập")) {
        await checkStatus();
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (initialCheck.current) return;
    initialCheck.current = true;
    if (!authEnabled) {
      setError("Đăng nhập chưa được bật trên hệ thống này.");
      setScreen("unavailable");
      return;
    }
    void checkStatus();
  }, [checkStatus]);

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await accessKeyRequest<AccessKeyResponse>("confirm", {
        key: enteredKey,
        setupToken,
      });
      if (inLivePreview() && result.token) setBearerToken(result.token);
      setGeneratedKey("");
      setSetupToken("");
      await navigate({ to: "/", replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xác nhận mã.");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await accessKeyRequest<AccessKeyResponse>("sign-in", { key: enteredKey });
      if (inLivePreview() && result.token) setBearerToken(result.token);
      setEnteredKey("");
      await navigate({ to: "/", replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đăng nhập bằng mã này.");
    } finally {
      setBusy(false);
    }
  }

  const heading =
    screen === "show-key" || screen === "confirm-key" || screen === "setup-pending" || screen === "ready-to-create"
      ? "Tạo mã chủ hệ thống"
      : "Đăng nhập bằng mã";

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <section className="glass w-full max-w-md rounded-card p-5 sm:p-8">
        <a
          href="/"
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Về trang chủ
        </a>
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl border border-pine/40 bg-pine-soft text-pine">
            <Snowflake className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-copper">Vân An</p>
            <h1 className="text-xl font-bold">{heading}</h1>
          </div>
        </div>

        <p className="mb-4 text-sm text-muted">
          Mã chủ là cách duy nhất để đăng nhập trên các thiết bị.
        </p>

        {screen === "loading" ? (
          <div className="grid gap-3">
            <p role="status" className="text-sm text-muted">Đang kiểm tra hệ thống…</p>
            <Button type="button" tone="ghost" onClick={() => void checkStatus()}>
              Kiểm tra lại
            </Button>
            <Button type="button" disabled={busy} onClick={() => void beginSetup(false)}>
              <KeyRound className="size-4" />
              {busy ? "Đang tạo mã tự động…" : "Tạo mã tự động"}
            </Button>
          </div>
        ) : null}

        {screen === "unavailable" ? (
          <div className="grid gap-3">
            <p className="rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm leading-relaxed text-danger">
              {error || "Chưa kết nối được máy chủ xác thực."}
            </p>
            <Button type="button" disabled={busy} onClick={() => void checkStatus()}>
              Thử lại
            </Button>
          </div>
        ) : null}

        {screen === "ready-to-create" ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-copper/40 bg-copper/10 p-3 text-sm leading-relaxed">
              Tạo mã dùng chung cho tất cả thiết bị. Ai có mã đều có cùng quyền truy cập và cùng dữ liệu.
              Hãy lưu mã an toàn; nếu mất, hệ thống không thể khôi phục.
            </div>
            <Button type="button" disabled={busy} onClick={() => void beginSetup(false)}>
              <KeyRound className="size-4" />
              {busy ? "Đang tạo mã tự động…" : "Tạo mã tự động"}
            </Button>
          </div>
        ) : null}

        {screen === "setup-pending" ? (
          <div className="grid gap-3">
            <p className="rounded-xl border border-copper/40 bg-copper/10 p-3 text-sm leading-relaxed">
              Quá trình tạo mã trước đó chưa hoàn tất hoặc mã chỉ được hiển thị một lần. Tạo mã mới
              sẽ thay thế bản thiết lập đang chờ.
            </p>
            <Button type="button" disabled={busy} onClick={() => void beginSetup(true)}>
              {busy ? "Đang tạo mã…" : "Tạo mã mới"}
            </Button>
          </div>
        ) : null}

        {screen === "show-key" ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-copper/50 bg-copper/10 p-3 text-sm leading-relaxed">
              Hãy lưu mã này ở nơi an toàn. Bất kỳ ai có mã đều đăng nhập với cùng quyền và truy cập
              toàn bộ dữ liệu; nếu mất mã, hệ thống không thể khôi phục.
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">Mã bí mật của hệ thống</p>
              <output className="block select-all break-all rounded-xl border border-pine/40 bg-black/30 px-4 py-5 text-center font-mono text-lg font-bold tracking-wider text-pine">
                {generatedKey}
              </output>
            </div>
            <Button type="button" onClick={() => setScreen("confirm-key")}>
              Tôi đã lưu mã
            </Button>
            <p className="text-xs leading-relaxed text-muted">
            Sau khi xác nhận mã đã lưu, bạn cần nhập lại mã một lần nữa để kích hoạt và vào ứng dụng.
            </p>
          </div>
        ) : null}

        {screen === "confirm-key" ? (
          <form className="grid gap-3" onSubmit={(event) => void confirmSetup(event)}>
            <p className="text-sm leading-relaxed text-muted">
              Nhập lại mã bí mật bạn vừa lưu. Mã chỉ được kích hoạt sau khi xác nhận thành công.
            </p>
            <label className="grid gap-1.5 text-sm font-semibold">
              Xác nhận mã bí mật
              <input
                className={fieldClass}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                value={enteredKey}
                onChange={(event) => setEnteredKey(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              <KeyRound className="size-4" />
              {busy ? "Đang xác nhận…" : "Xác nhận và kích hoạt mã"}
            </Button>
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-muted"
              onClick={() => setScreen("show-key")}
            >
              Xem lại mã đã tạo
            </button>
          </form>
        ) : null}

        {screen === "sign-in" ? (
          <form className="grid gap-3" onSubmit={(event) => void signIn(event)}>
            <label className="grid gap-1.5 text-sm font-semibold">
              Mã bí mật
              <input
                className={fieldClass}
                autoComplete="current-password"
                autoCapitalize="characters"
                spellCheck={false}
                required
                value={enteredKey}
                onChange={(event) => setEnteredKey(event.target.value)}
              />
            </label>
            <Button type="submit" disabled={busy}>
              <KeyRound className="size-4" />
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              Không gửi mã cho người lạ. Nếu đã mất mã, hệ thống không thể khôi phục tài khoản.
            </p>
          </form>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
