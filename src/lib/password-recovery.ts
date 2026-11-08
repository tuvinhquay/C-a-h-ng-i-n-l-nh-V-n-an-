export const RECOVERY_QUESTIONS = [
  { id: "first_store", label: "Tên cửa hàng đầu tiên của bạn là gì?" },
  { id: "familiar_phone", label: "Số điện thoại quen thuộc nhất của bạn là gì?" },
  { id: "internal_code", label: "Mã cửa hàng nội bộ của bạn là gì?" },
  { id: "first_repair", label: "Thiết bị điện lạnh đầu tiên bạn sửa là gì?" },
  { id: "store_city", label: "Cửa hàng của bạn bắt đầu ở tỉnh/thành nào?" },
] as const;

export type RecoveryQuestionId = (typeof RECOVERY_QUESTIONS)[number]["id"];

export type RecoveryEntry = {
  questionId: RecoveryQuestionId;
  answer: string;
};

const questionIds = new Set<string>(RECOVERY_QUESTIONS.map((question) => question.id));

export function normalizeRecoveryAnswer(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function parseRecoveryEntries(value: unknown): RecoveryEntry[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2) return null;

  const entries: RecoveryEntry[] = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") return null;
    const { questionId, answer } = candidate as Record<string, unknown>;
    if (
      typeof questionId !== "string" ||
      !questionIds.has(questionId) ||
      typeof answer !== "string"
    ) {
      return null;
    }

    const normalized = normalizeRecoveryAnswer(answer);
    if (normalized.length < 3 || normalized.length > 160 || seen.has(questionId)) {
      return null;
    }
    seen.add(questionId);
    entries.push({ questionId: questionId as RecoveryQuestionId, answer: normalized });
  }

  return entries;
}
