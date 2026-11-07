import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/lib/store";
import type { Part, PartInput } from "@/lib/types";
import { errorText } from "@/components/ui";
import { findPart, identifyIntent, isGreeting, parseTaughtPart } from "@/lib/assistant";

type Message = { id: string; role: "assistant" | "user"; text: string; action?: "confirmTeach" };
type PendingTeach = { question: string; teachingText: string };

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(value);
}

function partReply(part: Part): string {
  const detail = [
    part.color ? `màu ${part.color}` : "",
    part.location ? `vị trí ${part.location}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `${part.name} hiện còn ${formatQuantity(part.stock)} ${part.unit}${detail ? ` (${detail})` : ""}.`;
}

export function AssistantBot() {
  const shop = useShop();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingTeach, setPendingTeach] = useState<PendingTeach | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PartInput | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", text: "Bạn cần tôi giúp gì sao?" },
  ]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, open]);

  function answer(text: string, role: Message["role"] = "assistant", action?: Message["action"]) {
    setMessages((current) => [...current, { id: crypto.randomUUID(), role, text, action }]);
  }

  function prepareTeach(text: string, pending: PendingTeach) {
    const reply = /^\d+(?:[.,]\d+)?$/.test(text.trim()) ? `số lượng còn ${text.trim()} cái` : text;
    const teachingText = [pending.teachingText, reply].filter(Boolean).join(" ");
    const details = parseTaughtPart(teachingText, pending.question);
    if (details.quantity === null) {
      setPendingTeach({ ...pending, teachingText });
      answer("Tôi chưa thấy số lượng. Bạn cho tôi biết hiện còn bao nhiêu chiếc nhé.");
      return;
    }
    if (!details.name.trim()) {
      setPendingTeach({ ...pending, teachingText });
      answer("Bạn cho tôi biết tên hoặc mã model của linh kiện nhé.");
      return;
    }
    const input: PartInput = {
      sku: "",
      name: details.name,
      machineType: details.machineType,
      brand: details.brand,
      color: details.color,
      location: details.location,
      unit: "Cái",
      costPrice: 0,
      sellPrice: 0,
      openingStock: details.quantity,
      minStock: 0,
      note: "Tạo từ Trợ lý thông minh",
    };
    setPendingTeach(null);
    setPendingConfirmation(input);
    answer(
      `Tôi sẽ thêm sản phẩm sau khi bạn xác nhận:\nTên/model: ${input.name}\nThương hiệu: ${input.brand || "Chưa rõ"}\nLoại thiết bị: ${input.machineType || "Chưa rõ"}\nSố lượng đầu: ${formatQuantity(input.openingStock)} ${input.unit}${input.color ? `\nMàu: ${input.color}` : ""}${input.location ? `\nVị trí: ${input.location}` : ""}`,
      "assistant",
      "confirmTeach",
    );
  }

  async function confirmTeach() {
    if (!pendingConfirmation || busy) return;
    setBusy(true);
    try {
      const part = await shop.savePart(pendingConfirmation);
      setPendingConfirmation(null);
      answer(
        `Đã thêm ${part.name}: ${formatQuantity(part.stock)} ${part.unit}${part.color ? `, màu ${part.color}` : ""}${part.location ? `, vị trí ${part.location}` : ""}. Dữ liệu đã lưu trên thiết bị này.`,
      );
    } catch (reason) {
      const message = errorText(reason);
      answer(`Chưa thể lưu thông tin: ${message}`);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function cancelTeach() {
    setPendingTeach(null);
    setPendingConfirmation(null);
    answer("Đã hủy, chưa có thay đổi nào được lưu.");
  }

  async function respond(text: string) {
    if (pendingConfirmation) {
      answer("Thông tin đang chờ xác nhận. Chọn “Xác nhận thêm” để lưu hoặc “Hủy” để bỏ qua.");
      return;
    }
    if (pendingTeach) {
      if (/^(hủy|huy|thôi|thoi|cancel)$/i.test(text.trim())) {
        cancelTeach();
        return;
      }
      prepareTeach(text, pendingTeach);
      return;
    }
    const intent = identifyIntent(text);
    if (intent === "repair") {
      const openRepairs = shop.repairs.filter((repair) => repair.status === "open");
      answer(`Hiện có ${openRepairs.length} phiếu sửa đang mở.`);
      return;
    }
    if (intent === "low-stock") {
      const low = shop.parts.filter((part) => part.stock <= part.minStock);
      if (!low.length) {
        answer("Kho hiện không có linh kiện nào ở dưới mức tồn tối thiểu.");
        return;
      }
      answer(
        `Có ${low.length} linh kiện cần kiểm tra: ${low
          .slice(0, 8)
          .map((part) => `${part.name} (${formatQuantity(part.stock)} ${part.unit})`)
          .join("; ")}.`,
      );
      return;
    }
    if (intent === "stock") {
      const found = findPart(text, shop.parts);
      if (found.ambiguous.length) {
        answer(
          `Tôi tìm thấy vài sản phẩm phù hợp: ${found.ambiguous.map((part) => `${part.name} (${part.sku})`).join(", ")}. Bạn nhập thêm mã hoặc model nhé.`,
        );
        return;
      }
      if (found.part) {
        answer(partReply(found.part));
        return;
      }
      setPendingTeach({ question: text, teachingText: "" });
      answer(
        "Tôi chưa có thông tin sản phẩm này. Bạn có thể dạy tôi bằng tên hoặc model, số lượng còn, màu sắc và vị trí. Ví dụ: “LG M31UII màu đen, số lượng còn 13 cái, vị trí khu vực A3 kệ số 5 ngăn số 2”.",
      );
      return;
    }
    if (isGreeting(text)) {
      answer(
        "Xin chào! Tôi có thể tra tồn kho, vị trí linh kiện, cảnh báo hàng sắp hết và số phiếu sửa đang mở.",
      );
      return;
    }
    answer(
      "Tôi hỗ trợ tra số lượng và vị trí linh kiện, kiểm tra hàng sắp hết, hoặc đếm phiếu sửa đang mở. Bạn thử hỏi: “LG M31UII còn bao nhiêu cái?”",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    answer(text, "user");
    setBusy(true);
    try {
      await respond(text);
    } catch (reason) {
      const message = errorText(reason);
      answer(`Chưa thể lưu thông tin: ${message}`);
      toast.error(message);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {open ? (
        <section
          className="assistant-panel glass flex flex-col overflow-hidden rounded-card"
          role="dialog"
          aria-modal="false"
          aria-label="Trợ lý thông minh"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-pine-soft text-pine">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Trợ lý Vân An</p>
              <p className="text-xs text-muted">Tra cứu kho · hoạt động ngoại tuyến</p>
            </div>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-xl text-muted hover:bg-pine-soft hover:text-ink"
              onClick={() => setOpen(false)}
              aria-label="Đóng trợ lý"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <p
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-pine text-on-pine"
                      : "rounded-bl-md border border-line bg-bg/70 text-ink"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="mr-1 inline size-3.5 text-copper" />
                  ) : null}
                  {message.text}
                </p>
                {message.action === "confirmTeach" ? (
                  <div className="mt-2 flex gap-2 pl-1">
                    <button
                      type="button"
                      disabled={busy || !pendingConfirmation}
                      className="min-h-11 rounded-xl bg-pine px-3 text-sm font-semibold text-on-pine disabled:opacity-50"
                      onClick={() => void confirmTeach()}
                    >
                      Xác nhận thêm
                    </button>
                    <button
                      type="button"
                      disabled={busy || !pendingConfirmation}
                      className="min-h-11 rounded-xl border border-line px-3 text-sm text-ink disabled:opacity-50"
                      onClick={cancelTeach}
                    >
                      Hủy
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <textarea
              ref={inputRef}
              rows={1}
              className="max-h-24 min-h-11 flex-1 resize-y rounded-xl border border-line bg-bg/70 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-pine"
              placeholder={
                pendingConfirmation
                  ? "Xác nhận hoặc hủy ở phía trên…"
                  : pendingTeach
                    ? "Nhập thông tin để dạy trợ lý…"
                    : "Hỏi về kho linh kiện…"
              }
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              aria-label="Tin nhắn cho trợ lý"
            />
            <button
              type="submit"
              disabled={busy || pendingConfirmation !== null || !draft.trim()}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-on-pine disabled:opacity-50"
              aria-label="Gửi tin nhắn"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="assistant-launch glass grid size-14 place-items-center rounded-full text-pine shadow-lg transition hover:scale-105"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Đóng trợ lý" : "Mở trợ lý"}
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </>
  );
}
