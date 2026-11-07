import type { Part } from "@/lib/types";

export type AssistantIntent = "stock" | "low-stock" | "repair" | "help";

const STOP_WORDS = new Set([
  "tu",
  "lanh",
  "may",
  "bao",
  "nhieu",
  "con",
  "cai",
  "chiec",
  "ton",
  "kho",
  "so",
  "luong",
  "san",
  "pham",
  "hang",
  "linh",
  "kien",
  "nao",
  "gi",
  "co",
  "khong",
  "la",
  "o",
  "dau",
  "hien",
  "tai",
  "giup",
  "toi",
  "cho",
  "biet",
  "mau",
  "vi",
  "tri",
  "mot",
  "cua",
  "shop",
]);
const BRANDS = [
  "Mitsubishi",
  "Panasonic",
  "Electrolux",
  "Samsung",
  "Toshiba",
  "Daikin",
  "Aqua",
  "Casper",
  "Sharp",
  "LG",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function identifyIntent(text: string): AssistantIntent {
  const value = normalize(text);
  if (/(phieu sua|dang sua|dang cho|chua sua)/.test(value)) return "repair";
  if (/(sap het|ton thap|gan het|hang het|het hang|duoi muc)/.test(value)) return "low-stock";
  if (/(ton kho|so luong|bao nhieu|con may|con bao|o dau|vi tri|tim san pham)/.test(value))
    return "stock";
  return "help";
}

export function isGreeting(text: string): boolean {
  return /(xin chao|chao|hello|hi|cam on)/.test(normalize(text));
}

function usefulTerms(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

export function findPart(text: string, parts: Part[]): { part: Part | null; ambiguous: Part[] } {
  const terms = usefulTerms(text);
  const scored = parts
    .map((part) => {
      const searchable = normalize(
        `${part.sku} ${part.name} ${part.brand} ${part.machineType} ${part.color} ${part.location}`,
      );
      const score = terms.filter((term) => searchable.split(" ").includes(term)).length;
      return { part, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { part: null, ambiguous: [] };
  const best = scored[0]?.score ?? 0;
  const matches = scored.filter((entry) => entry.score === best).map((entry) => entry.part);
  const enough = terms.length === 1 ? matches.length === 1 : best >= Math.min(terms.length, 2);
  if (!enough) return { part: null, ambiguous: [] };
  if (matches.length > 1) return { part: null, ambiguous: matches.slice(0, 4) };
  return { part: matches[0] ?? null, ambiguous: [] };
}

function quantityFrom(text: string): number | null {
  const value = normalize(text);
  const match =
    value.match(/(?:so luong(?: con)?|con)\s*(\d+(?:[.,]\d+)?)/) ??
    value.match(/(\d+(?:[.,]\d+)?)\s*(?:cai|chiec|bo|cuon|met|kg|lit)/);
  if (!match?.[1]) return null;
  const number = Number(match[1].replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export interface TaughtPartDetails {
  quantity: number | null;
  brand: string;
  name: string;
  machineType: string;
  color: string;
  location: string;
}

export function parseTaughtPart(text: string, question: string): TaughtPartDetails {
  const markers = [
    /(?:^|\s)màu\s+/i,
    /(?:^|\s)số lượng\b/i,
    /(?:^|\s)còn\s+\d/i,
    /(?:^|\s)vị trí\b/i,
    /(?:^|\s)đang để\s+/i,
    /(?:^|\s)nằm ở\s+/i,
  ];
  const prefix = markers
    .map((marker) => {
      const index = text.search(marker);
      return index < 0 ? text.length : index;
    })
    .reduce((first, index) => Math.min(first, index), text.length);
  const rawName = text
    .slice(0, prefix)
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, "");
  const fallbackTerms = (question.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((term) => {
      const normalized = normalize(term);
      return (
        normalized.length > 1 &&
        !STOP_WORDS.has(normalized) &&
        !BRANDS.some((brand) => normalize(brand) === normalized)
      );
    })
    .join(" ");
  const identity = rawName || fallbackTerms || text.trim();
  const normalizedIdentity = normalize(identity);
  const brand =
    BRANDS.find((item) => normalizedIdentity.split(" ").includes(normalize(item))) ?? "";
  const productName =
    identity
      .split(/\s+/)
      .filter((word) => !brand || normalize(word) !== normalize(brand))
      .join(" ")
      .trim() || identity;
  const normalizedQuestion = normalize(question);
  const resolvedBrand =
    brand || BRANDS.find((item) => normalizedQuestion.split(" ").includes(normalize(item))) || "";
  const machineType = /(tu lanh|ngan dong|ngan mat)/.test(normalizedQuestion)
    ? "Tủ lạnh"
    : /(may lanh|dieu hoa|air conditioner)/.test(normalizedQuestion)
      ? "Máy lạnh"
      : "";
  const colorMatch = text.match(
    /màu\s+(.+?)(?=\s+số lượng\b|\s+còn\s+\d|\s+vị trí\b|\s+đang để\b|[.!?]|$)/i,
  );
  const locationMatch = text.match(
    /(?:vị trí|địa điểm|đang để|nằm ở)\s*(?:đang\s*)?(?:để\s*)?(.+?)(?:[.!?]|$)/i,
  );
  return {
    quantity: quantityFrom(text),
    brand: resolvedBrand,
    name: productName,
    machineType,
    color: colorMatch?.[1]?.trim() ?? "",
    location: locationMatch?.[1]?.trim().replace(/^(?:đang\s+)?để\s+/i, "") ?? "",
  };
}
