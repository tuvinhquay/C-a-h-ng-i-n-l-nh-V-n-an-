import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Snowflake } from "lucide-react";
import { Button, fieldClass } from "@/components/ui";
import { authClient, authEnabled, getBearerToken } from "@/lib/auth/client";
import {
  parseRecoveryEntries,
  RECOVERY_QUESTIONS,
  type RecoveryEntry,
  type RecoveryQuestionId,
} from "@/lib/password-recovery";

export const Route = createFileRoute("/login")({ component: Login });

type Mode = "sign-in" | "sign-up" | "recover" | "setup";

const initialRecoveryEntries: RecoveryEntry[] = [
  { questionId: "first_store", answer: "" },
  { questionId: "internal_code", answer: "" },
];

function RecoveryQuestionFields({
  entries,
  onChange,
}: {
  entries: RecoveryEntry[];
  onChange: (entries: RecoveryEntry[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {entries.map((entry, index) => (
        <fieldset key={index} className="grid gap-2 rounded-2xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Câu hỏi {index + 1}</legend>
          <label className="grid gap-1.5 text-sm">
            Câu hỏi bí mật
            <select
              className={fieldClass}
              required
              value={entry.questionId}
              onChange={(event) =>
                onChange(
                  entries.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, questionId: event.target.value as RecoveryQuestionId }
                      : item,
                  ),
                )
              }
            >
              {RECOVERY_QUESTIONS.map((question) => (
                <option
                  key={question.id}
                  value={question.id}
                  disabled={entries.some(
                    (item, itemIndex) => itemIndex !== index && item.questionId === question.id,
                  )}
                >
                  {question.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm">
            Câu trả lời
            <input
              className={fieldClass}
              autoComplete="off"
              minLength={3}
              maxLength={160}
              required
              value={entry.answer}
              onChange={(event) =>
                onChange(
                  entries.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, answer: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          {entries.length === 2 ? (
            <button
              type="button"
              className="min-h-10 justify-self-start text-sm font-semibold text-copper"
              onClick={() => onChange(entries.filter((_, itemIndex) => itemIndex !== index))}
            >
              Bỏ câu hỏi này
            </button>
          ) : null}
        </fieldset>
      ))}
      {entries.length < 2 ? (
        <button
          type="button"
          className="min-h-11 justify-self-start text-sm font-semibold text-pine"
          onClick={() =>
            onChange([
              ...entries,
              {
                questionId: RECOVERY_QUESTIONS.find(
                  (question) => !entries.some((entry) => entry.questionId === question.id),
                )!.id,
                answer: "",
              },
            ])
          }
        >
          + Thêm câu hỏi thứ hai
        </button>
      ) : null}
    </div>
  );
}

async function postRecovery(payload: Record<string, unknown>): Promise<void> {
  const headers = new Headers({ "content-type": "application/json" });
  const bearer = getBearerToken();
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);

  const response = await fetch("/api/password-recovery", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(result.error ?? "Không thể hoàn tất yêu cầu.");
  }
}

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryEntries, setRecoveryEntries] = useState(initialRecoveryEntries);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    let accountCreated = false;
    try {
      if (mode === "recover") {
        if (password !== confirmPassword) {
          setError("Hai mật khẩu chưa trùng nhau.");
          return;
        }
        const entries = parseRecoveryEntries(recoveryEntries);
        if (!entries) {
          setError("Hãy chọn và trả lời 1 hoặc 2 câu hỏi bảo mật.");
          return;
        }
        await postRecovery({
          action: "reset",
          email: email.trim(),
          entries,
          newPassword: password,
        });
        setPassword("");
        setConfirmPassword("");
        setRecoveryEntries(initialRecoveryEntries);
        setMode("sign-in");
        setNotice("Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.");
        return;
      }

      if (mode === "sign-up") {
        const entries = parseRecoveryEntries(recoveryEntries);
        if (!entries) {
          setError("Hãy chọn và trả lời 1 hoặc 2 câu hỏi bảo mật.");
          return;
        }
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Không thể tạo tài khoản.");
          return;
        }
        accountCreated = true;
        await postRecovery({ action: "setup", entries });
      } else if (mode === "setup") {
        const entries = parseRecoveryEntries(recoveryEntries);
        if (!entries) {
          setError("Hãy chọn và trả lời 1 hoặc 2 câu hỏi bảo mật.");
          return;
        }
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Không thể đăng nhập.");
          return;
        }
        await postRecovery({ action: "setup", entries });
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Không thể đăng nhập.");
          return;
        }
      }

      await navigate({ to: "/", replace: true });
    } catch (reason) {
      setError(
        accountCreated
          ? "Tài khoản đã được tạo nhưng chưa lưu được câu hỏi bảo mật. Hãy đăng nhập, chọn “Thiết lập câu hỏi phục hồi” rồi thử lại."
          : reason instanceof Error
            ? reason.message
            : "Không thể hoàn tất yêu cầu.",
      );
    } finally {
      setBusy(false);
    }
  }

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
            <h1 className="text-xl font-bold">
              {mode === "recover"
                ? "Phục hồi mật khẩu"
                : mode === "setup"
                  ? "Thiết lập câu hỏi bảo mật"
                  : mode === "sign-up"
                    ? "Tạo tài khoản nội bộ"
                    : "Đăng nhập nội bộ"}
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-muted">
          Dữ liệu được lưu ngay trên thiết bị và đồng bộ khi có mạng.
        </p>

        {authEnabled ? (
          <>
            <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
              {mode === "sign-up" ? (
                <label className="grid gap-1.5 text-sm font-semibold">
                  Tên hiển thị
                  <input
                    className={fieldClass}
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              ) : null}
              {mode !== "sign-up" ? (
                <>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Email
                    <input
                      className={fieldClass}
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  {mode !== "recover" ? (
                    <label className="grid gap-1.5 text-sm font-semibold">
                      Mật khẩu
                      <input
                        className={fieldClass}
                        type="password"
                        autoComplete="current-password"
                        minLength={8}
                        maxLength={128}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                  ) : null}
                </>
              ) : null}

              {mode === "sign-up" || mode === "setup" ? (
                <div className="grid gap-2">
                  <div>
                    <h2 className="text-sm font-bold">Câu hỏi phục hồi mật khẩu</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Chọn 1 hoặc 2 câu. Câu trả lời không phân biệt dấu, chữ hoa/thường hoặc khoảng
                      trắng.
                    </p>
                  </div>
                  <RecoveryQuestionFields entries={recoveryEntries} onChange={setRecoveryEntries} />
                </div>
              ) : null}

              {mode === "recover" ? (
                <>
                  <div>
                    <h2 className="text-sm font-bold">Trả lời câu hỏi đã chọn khi đăng ký</h2>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Chọn đúng câu hỏi và nhập câu trả lời đã đăng ký. Không gửi email hoặc mã OTP.
                    </p>
                  </div>
                  <RecoveryQuestionFields entries={recoveryEntries} onChange={setRecoveryEntries} />
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Mật khẩu mới
                    <input
                      className={fieldClass}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Nhập lại mật khẩu mới
                    <input
                      className={fieldClass}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </label>
                </>
              ) : null}

              {notice ? (
                <p role="status" className="rounded-xl bg-pine-soft p-3 text-sm text-pine">
                  {notice}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy}>
                <KeyRound className="size-4" />
                {busy
                  ? "Đang xử lý…"
                  : mode === "recover"
                    ? "Đặt lại mật khẩu"
                    : mode === "setup"
                      ? "Lưu câu hỏi bảo mật"
                      : mode === "sign-up"
                        ? "Tạo tài khoản"
                        : "Đăng nhập"}
              </Button>
            </form>

            {mode === "sign-in" ? (
              <>
                <button
                  type="button"
                  className="mt-3 min-h-11 w-full text-sm font-semibold text-copper"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setRecoveryEntries(initialRecoveryEntries);
                    setMode("recover");
                  }}
                >
                  Quên mật khẩu?
                </button>
                <button
                  type="button"
                  className="min-h-11 w-full text-sm font-semibold text-pine"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setMode("sign-up");
                  }}
                >
                  Tạo tài khoản mới
                </button>
                <button
                  type="button"
                  className="min-h-11 w-full text-sm font-semibold text-pine"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setRecoveryEntries(initialRecoveryEntries);
                    setMode("setup");
                  }}
                >
                  Thiết lập câu hỏi phục hồi
                </button>
              </>
            ) : mode === "recover" ? (
              <button
                type="button"
                className="mt-4 min-h-11 w-full text-sm font-semibold text-pine"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setMode("sign-in");
                }}
              >
                Quay lại đăng nhập
              </button>
            ) : mode === "setup" || mode === "sign-up" ? (
              <button
                type="button"
                className="mt-4 min-h-11 w-full text-sm font-semibold text-pine"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setMode("sign-in");
                }}
              >
                Đã có tài khoản? Đăng nhập
              </button>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Đăng nhập chưa được bật.</p>
        )}
      </section>
    </main>
  );
}
