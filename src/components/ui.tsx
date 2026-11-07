import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";

const tones = {
  copper: "bg-copper text-on-copper",
  pine: "bg-pine text-on-pine",
  soft: "bg-pine-soft text-pine",
  ghost: "border border-line bg-surface text-ink backdrop-blur-md hover:bg-pine-soft",
  danger: "bg-danger text-on-copper",
} as const;

export function Button({
  tone = "copper",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof tones }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition active:scale-[0.99] disabled:opacity-50 ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export const fieldClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink outline-none placeholder:text-muted backdrop-blur-md";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-sm font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

const badges = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  pine: "bg-pine-soft text-pine",
  muted: "bg-bg text-muted",
  copper: "bg-copper-soft text-copper",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof badges; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${badges[tone]}`}>{children}</span>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass max-h-[92dvh] w-full overflow-y-auto rounded-t-card p-4 shadow-xl sm:max-w-lg sm:rounded-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl text-muted" onClick={onClose} aria-label="Đóng">
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-card border-dashed px-4 py-8 text-center">
      <p className="text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-base text-pretty text-muted">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Có lỗi, hãy thử lại.";
}
