/**
 * Dựng giấy báo giá / phiếu / hóa đơn và xuất PDF (nhúng font Noto Sans)
 * hoặc ảnh PNG (canvas + Be Vietnam Pro). In trình duyệt dùng bản HTML.
 * pdf-lib chỉ được kéo vào khi bấm tải PDF.
 */

import boldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";
import regularUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import { formatDate, formatWhen, lineAmount, qtyText, sumLines, vnd, vndInWords } from "@/lib/format";
import type { LineItem, PaperDoc, Settings } from "@/lib/types";

export interface PaperSource {
  title: string;
  code: string;
  when: string;
  settings: Settings;
  customerName: string;
  phone: string;
  address: string;
  deviceName?: string;
  model?: string;
  serial?: string;
  symptom?: string;
  lines: LineItem[];
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  note?: string;
}

let regularBytes: Promise<ArrayBuffer> | null = null;
let boldBytes: Promise<ArrayBuffer> | null = null;

function loadFont(url: string): Promise<ArrayBuffer> {
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error("Không tải được font chữ để xuất PDF.");
    return response.arrayBuffer();
  });
}

/** Kéo font vào bộ nhớ sớm để lần xuất PDF đầu (và lúc mất mạng sau đó) vẫn có chữ Việt. */
export function warmFonts(): void {
  regularBytes ??= loadFont(regularUrl);
  boldBytes ??= loadFont(boldUrl);
  void regularBytes.catch(() => {
    regularBytes = null;
  });
  void boldBytes.catch(() => {
    boldBytes = null;
  });
}

export function buildPaper(source: PaperSource): PaperDoc {
  const shopMeta = [
    source.settings.phone ? `Điện thoại: ${source.settings.phone}` : "",
    source.settings.address ? source.settings.address : "",
    source.settings.taxCode ? `MST: ${source.settings.taxCode}` : "",
  ].filter(Boolean);
  const customerLines = [
    source.customerName || "Khách lẻ",
    source.phone ? `Điện thoại: ${source.phone}` : "",
    source.address ? source.address : "",
  ].filter(Boolean);
  const deviceLines = [
    source.deviceName ? `Thiết bị: ${source.deviceName}` : "",
    source.model ? `Model: ${source.model}` : "",
    source.serial ? `Serial: ${source.serial}` : "",
    source.symptom ? `Triệu chứng: ${source.symptom}` : "",
  ].filter(Boolean);
  const total = sumLines(source.lines);
  const warranty =
    source.warrantyStart && source.warrantyEnd
      ? `Bảo hành từ ${formatDate(source.warrantyStart)} đến ${formatDate(source.warrantyEnd)}.`
      : null;
  return {
    title: source.title,
    code: source.code,
    dateText: formatWhen(source.when),
    shopName: source.settings.shopName || "Xưởng điện lạnh",
    shopMeta,
    customerLines,
    deviceLines,
    lines: source.lines.map((line) => ({
      name: line.name,
      qty: qtyText(line.qty),
      unit: line.unit || "",
      price: vnd(line.unitPrice),
      amount: vnd(lineAmount(line)),
    })),
    total: vnd(total),
    totalNumber: total,
    totalWords: vndInWords(total),
    warranty,
    note: source.note?.trim() ?? "",
    footer: source.settings.invoiceNote.trim(),
    signer: source.settings.ownerName.trim(),
  };
}

type MeasureFont = { widthOfTextAtSize: (value: string, size: number) => number };

function wrapText(text: string, font: MeasureFont, size: number, maxWidth: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  const pushLong = (word: string) => {
    let chunk = "";
    for (const char of word) {
      const next = chunk + char;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) chunk = next;
      else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  };
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) current = word;
      else pushLong(word);
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function paperToPdf(doc: PaperDoc): Promise<Blob> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const fontkitMod = (await import("@pdf-lib/fontkit")) as { default?: unknown };
  const fontkit = fontkitMod.default ?? fontkitMod;
  warmFonts();
  const [regular, bold] = await Promise.all([regularBytes ?? loadFont(regularUrl), boldBytes ?? loadFont(boldUrl)]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(regular, { subset: true });
  const fontBold = await pdf.embedFont(bold, { subset: true });
  const pine = rgb(30 / 255, 77 / 255, 72 / 255);
  const copper = rgb(184 / 255, 90 / 255, 34 / 255);
  const ink = rgb(28 / 255, 25 / 255, 20 / 255);
  const muted = rgb(90 / 255, 84 / 255, 76 / 255);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = 36;

  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = 36;
    page.drawText(`${doc.code} · tiếp theo`, { x: margin, y: pageHeight - 28, size: 9, font, color: muted });
    y = 44;
  };
  const ensure = (height: number) => {
    if (y + height > pageHeight - margin) newPage();
  };
  const text = (value: string, x: number, size: number, used: typeof font, color = ink) => {
    page.drawText(value, { x, y: pageHeight - y - size, size, font: used, color });
  };

  page.drawRectangle({ x: 0, y: pageHeight - 78, width: pageWidth, height: 78, color: pine });
  page.drawText(doc.shopName, { x: margin, y: pageHeight - 34, size: 16, font: fontBold, color: rgb(1, 1, 1) });
  let metaY = 50;
  for (const line of doc.shopMeta.slice(0, 3)) {
    page.drawText(line, { x: margin, y: pageHeight - metaY, size: 9, font, color: rgb(0.9, 0.95, 0.93) });
    metaY += 12;
  }
  y = 96;
  text(doc.title, margin, 14, fontBold, copper);
  y += 22;
  text(`Số: ${doc.code}`, margin, 11, fontBold);
  text(doc.dateText, 360, 11, font, muted);
  y += 22;

  const block = (label: string, rows: string[]) => {
    if (rows.length === 0) return;
    ensure(18 + rows.length * 14);
    text(label, margin, 10, fontBold, pine);
    y += 16;
    for (const row of rows) {
      for (const piece of wrapText(row, font, 10, pageWidth - margin * 2)) {
        ensure(14);
        text(piece, margin, 10, font);
        y += 14;
      }
    }
    y += 6;
  };
  block("Khách hàng", doc.customerLines);
  block("Thiết bị", doc.deviceLines);

  ensure(28);
  const columns = [margin, 300, 360, 450];
  page.drawRectangle({ x: margin, y: pageHeight - y - 18, width: pageWidth - margin * 2, height: 18, color: rgb(0.93, 0.95, 0.94) });
  const headerY = y;
  page.drawText("Nội dung", { x: columns[0] + 4, y: pageHeight - headerY - 13, size: 9, font: fontBold, color: pine });
  page.drawText("SL", { x: columns[1], y: pageHeight - headerY - 13, size: 9, font: fontBold, color: pine });
  page.drawText("Đơn giá", { x: columns[2], y: pageHeight - headerY - 13, size: 9, font: fontBold, color: pine });
  page.drawText("Thành tiền", { x: columns[3], y: pageHeight - headerY - 13, size: 9, font: fontBold, color: pine });
  y += 24;

  doc.lines.forEach((line, index) => {
    const nameLines = wrapText(line.name, font, 10, 250);
    const height = Math.max(16, nameLines.length * 13);
    ensure(height + 6);
    if (index % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: pageHeight - y - height,
        width: pageWidth - margin * 2,
        height,
        color: rgb(0.98, 0.97, 0.95),
      });
    }
    nameLines.forEach((piece, pieceIndex) => {
      page.drawText(piece, { x: columns[0] + 4, y: pageHeight - y - 12 - pieceIndex * 13, size: 10, font, color: ink });
    });
    page.drawText(`${line.qty} ${line.unit}`.trim(), { x: columns[1], y: pageHeight - y - 12, size: 10, font, color: ink });
    page.drawText(line.price, { x: columns[2], y: pageHeight - y - 12, size: 10, font, color: ink });
    page.drawText(line.amount, { x: columns[3], y: pageHeight - y - 12, size: 10, font: fontBold, color: ink });
    y += height + 4;
  });

  y += 8;
  ensure(36);
  text(`Tổng cộng: ${doc.total}`, margin, 13, fontBold, copper);
  y += 18;
  for (const piece of wrapText(`Bằng chữ: ${doc.totalWords}`, font, 10, pageWidth - margin * 2)) {
    ensure(14);
    text(piece, margin, 10, font);
    y += 14;
  }
  if (doc.warranty) {
    y += 6;
    ensure(32);
    page.drawRectangle({ x: margin, y: pageHeight - y - 28, width: pageWidth - margin * 2, height: 28, color: rgb(0.9, 0.95, 0.94) });
    page.drawText(doc.warranty, { x: margin + 8, y: pageHeight - y - 18, size: 11, font: fontBold, color: pine });
    y += 40;
  }
  if (doc.note) {
    y += 4;
    for (const piece of wrapText(`Ghi chú: ${doc.note}`, font, 10, pageWidth - margin * 2)) {
      ensure(14);
      text(piece, margin, 10, font);
      y += 14;
    }
  }
  if (doc.footer) {
    y += 8;
    for (const piece of wrapText(doc.footer, font, 9, pageWidth - margin * 2)) {
      ensure(13);
      text(piece, margin, 9, font, muted);
      y += 12;
    }
  }
  y += 28;
  ensure(70);
  text("Khách hàng", margin, 11, fontBold);
  text("Người lập", 380, 11, fontBold);
  y += 48;
  text(doc.signer || "", 380, 11, font);

  const bytes = await pdf.save();
  return new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
}

function canvasWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const lines: string[] = [];
  let current = "";
  for (const word of clean.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function paperToPng(doc: PaperDoc): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("Chỉ xuất ảnh trong trình duyệt.");
  await document.fonts.load('700 48px "Be Vietnam Pro"');
  await document.fonts.load('400 28px "Be Vietnam Pro"');
  const width = 1080;
  const pad = 56;
  const height = 1100 + doc.lines.length * 80 + doc.deviceLines.length * 40 + doc.note.length;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(height, 1400);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không tạo được ảnh hóa đơn.");
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#1e4d48";
  ctx.fillRect(0, 0, width, 210);
  ctx.fillStyle = "#f3faf8";
  ctx.font = "700 48px Be Vietnam Pro";
  ctx.fillText(doc.shopName, pad, 78);
  ctx.font = "400 26px Be Vietnam Pro";
  doc.shopMeta.slice(0, 3).forEach((line, index) => ctx.fillText(line, pad, 124 + index * 32));
  let y = 270;
  ctx.fillStyle = "#b85a22";
  ctx.font = "700 36px Be Vietnam Pro";
  ctx.fillText(doc.title, pad, y);
  y += 48;
  ctx.fillStyle = "#1c1914";
  ctx.font = "700 28px Be Vietnam Pro";
  ctx.fillText(`Số: ${doc.code}`, pad, y);
  ctx.font = "400 26px Be Vietnam Pro";
  ctx.fillStyle = "#6e665c";
  ctx.fillText(doc.dateText, 620, y);
  y += 48;
  const section = (label: string, rows: string[]) => {
    if (rows.length === 0) return;
    ctx.fillStyle = "#1e4d48";
    ctx.font = "700 24px Be Vietnam Pro";
    ctx.fillText(label, pad, y);
    y += 36;
    ctx.fillStyle = "#1c1914";
    ctx.font = "400 28px Be Vietnam Pro";
    for (const row of rows) {
      for (const piece of canvasWrap(ctx, row, width - pad * 2)) {
        ctx.fillText(piece, pad, y);
        y += 36;
      }
    }
    y += 12;
  };
  section("Khách hàng", doc.customerLines);
  section("Thiết bị", doc.deviceLines);
  ctx.fillStyle = "#e7f2f0";
  ctx.fillRect(pad, y, width - pad * 2, 48);
  ctx.fillStyle = "#1e4d48";
  ctx.font = "700 24px Be Vietnam Pro";
  ctx.fillText("Nội dung", pad + 16, y + 32);
  ctx.fillText("SL", 620, y + 32);
  ctx.fillText("Thành tiền", 820, y + 32);
  y += 72;
  doc.lines.forEach((line, index) => {
    if (index % 2 === 1) {
      ctx.fillStyle = "#f6f1e8";
      ctx.fillRect(pad, y - 28, width - pad * 2, 64);
    }
    ctx.fillStyle = "#1c1914";
    ctx.font = "400 26px Be Vietnam Pro";
    const name = canvasWrap(ctx, line.name, 520)[0] ?? line.name;
    ctx.fillText(name, pad + 16, y);
    ctx.fillText(`${line.qty} ${line.unit}`.trim(), 620, y);
    ctx.font = "700 26px Be Vietnam Pro";
    ctx.fillText(line.amount, 820, y);
    ctx.font = "400 22px Be Vietnam Pro";
    ctx.fillStyle = "#6e665c";
    ctx.fillText(line.price, 620, y + 28);
    y += 72;
  });
  y += 12;
  ctx.fillStyle = "#b85a22";
  ctx.font = "700 34px Be Vietnam Pro";
  ctx.fillText(`Tổng cộng: ${doc.total}`, pad, y);
  y += 42;
  ctx.fillStyle = "#1c1914";
  ctx.font = "400 24px Be Vietnam Pro";
  for (const piece of canvasWrap(ctx, `Bằng chữ: ${doc.totalWords}`, width - pad * 2)) {
    ctx.fillText(piece, pad, y);
    y += 32;
  }
  if (doc.warranty) {
    y += 12;
    ctx.fillStyle = "#e7f2f0";
    ctx.fillRect(pad, y - 28, width - pad * 2, 64);
    ctx.fillStyle = "#1e4d48";
    ctx.font = "700 26px Be Vietnam Pro";
    ctx.fillText(doc.warranty, pad + 16, y + 8);
    y += 64;
  }
  if (doc.note) {
    y += 20;
    ctx.fillStyle = "#1c1914";
    ctx.font = "400 24px Be Vietnam Pro";
    for (const piece of canvasWrap(ctx, `Ghi chú: ${doc.note}`, width - pad * 2)) {
      ctx.fillText(piece, pad, y);
      y += 32;
    }
  }
  if (doc.footer) {
    y += 16;
    ctx.fillStyle = "#6e665c";
    ctx.font = "400 22px Be Vietnam Pro";
    for (const piece of canvasWrap(ctx, doc.footer, width - pad * 2)) {
      ctx.fillText(piece, pad, y);
      y += 30;
    }
  }
  y += 48;
  ctx.fillStyle = "#1c1914";
  ctx.font = "700 24px Be Vietnam Pro";
  ctx.fillText("Khách hàng", pad, y);
  ctx.fillText("Người lập", 700, y);
  if (doc.signer) {
    ctx.font = "400 24px Be Vietnam Pro";
    ctx.fillText(doc.signer, 700, y + 90);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Không tạo được file ảnh.");
  return blob;
}
