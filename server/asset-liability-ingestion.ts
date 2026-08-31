import * as XLSX from "xlsx";
import { parse as parseCsv } from "csv-parse/sync";
import { completeIngestionClassification } from "./ai/provider";

export type Category = { parentCategory: string; category: string; description: string };
export type RawRow = Record<string, unknown>;
export type IngestionKind = "asset" | "liability";

const MAX_ROWS = 500;
const AI_BATCH_SIZE = 40;
const AI_PROMPT_CHARACTER_BUDGET = 25_000;
const AI_ROW_CHARACTER_BUDGET = 8_000;
const MAX_EXCEL_ARCHIVE_ENTRIES = 2_000;
const MAX_EXCEL_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;

function clean(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function toAiRow(row: RawRow, sourceIndex: number): RawRow {
  const prioritizedKeys = Object.keys(row).sort((left, right) => {
    const priority = /^(name|account|description|category|type|value|amount|balance|institution|text)$/i;
    return Number(priority.test(right)) - Number(priority.test(left));
  });
  const fields: RawRow = {};
  let remaining = AI_ROW_CHARACTER_BUDGET;
  for (const key of prioritizedKeys.slice(0, 40)) {
    if (key.toLowerCase() === "sourceindex") continue;
    if (remaining <= 0) break;
    const value = clean(row[key]);
    if (!value) continue;
    const bounded = value.slice(0, Math.min(4_000, remaining));
    fields[key] = bounded;
    remaining -= bounded.length;
  }
  return { sourceIndex, row: fields };
}

function trimmedLines(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines;
}

function parseDelimited(text: string, preferredDelimiter?: string): RawRow[] | null {
  const lines = trimmedLines(text);
  if (lines.length < 2 || lines[0].length > 20_000) return null;
  const delimiter = preferredDelimiter
    ?? (lines[0].includes("\t") ? "\t" : lines[0].includes(",") ? "," : null);
  if (!delimiter) return null;
  try {
    const records = parseCsv(text, {
      bom: true,
      delimiter,
      relax_column_count: false,
      relax_quotes: false,
      skip_empty_lines: false,
      trim: true,
      max_record_size: 20_000,
      to_line: MAX_ROWS + 2,
    }) as string[][];
    if (records.length < 2 || records.slice(1, 11).some((row) => row.every((cell) => !cell.trim()))) return null;
    const headers = records[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (!headers.some(Boolean)) return null;
    return records.slice(1, MAX_ROWS + 2).map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, cells[index] ?? ""])));
  } catch {
    return null;
  }
}

function isBoundedXlsxArchive(buffer: Buffer): boolean {
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocd = buffer.lastIndexOf(eocdSignature);
  if (eocd < 0 || eocd + 22 > buffer.length) return false;
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (!entryCount || entryCount > MAX_EXCEL_ARCHIVE_ENTRIES || centralOffset + centralSize > buffer.length) return false;

  let offset = centralOffset;
  let totalUncompressed = 0;
  for (let entry = 0; entry < entryCount; entry++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return false;
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) return false;
    if (!compressed && uncompressed) return false;
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_EXCEL_UNCOMPRESSED_BYTES) return false;
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return offset <= centralOffset + centralSize;
}

export function parseUpload(file: Express.Multer.File): RawRow[] | null {
  const extension = file.originalname.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  try {
    if (extension === "xls" || extension === "xlsx") {
      if (extension === "xlsx" && !isBoundedXlsxArchive(file.buffer)) return null;
      const workbook = XLSX.read(file.buffer, { type: "buffer", WTF: true, sheetRows: MAX_ROWS + 2 });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) return null;
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      });
      while (grid.length && grid[grid.length - 1].every((cell) => !clean(cell))) grid.pop();
      if (grid.length < 2 || grid.slice(0, 11).some((row) => row.every((cell) => !clean(cell)))) return null;
      const headers = grid[0].map((header, index) =>
        clean(header).toLowerCase().replace(/[^a-z0-9]/g, "") || `column${index + 1}`);
      return grid.slice(1, MAX_ROWS + 2).map((row) =>
        Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
    }
    if (!extension || !["csv", "tsv", "txt"].includes(extension)) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(file.buffer);
    if (!text.trim() || text.includes("\0") || hasSuspiciousControlCharacters(text)) return null;
    const delimited = parseDelimited(text, extension === "tsv" ? "\t" : undefined);
    if (delimited) return delimited;
    if (extension !== "txt") return null;
    const lines = trimmedLines(text);
    if (!lines.length || lines.slice(0, 10).some((line) => !line.trim())) return null;
    return lines.slice(0, MAX_ROWS + 1).map((line) => ({ text: line.trim() }));
  } catch {
    return null;
  }
}

export function extractJsonRows(value: unknown): RawRow[] | null {
  const candidate = Array.isArray(value)
    ? value
    : (value as any)?.entries ?? (value as any)?.rows ?? (value as any)?.data;
  if (typeof candidate === "string" || typeof (value as any)?.text === "string") {
    const text = typeof candidate === "string" ? candidate : (value as any).text;
    if (!text.trim() || text.includes("\0") || hasSuspiciousControlCharacters(text)) return null;
    return parseDelimited(text)
      ?? trimmedLines(text).slice(0, MAX_ROWS + 1).map((line) => ({ text: line.trim() }));
  }
  const rows = candidate;
  if (!Array.isArray(rows)) return null;
  return rows.slice(0, MAX_ROWS + 1).filter((row): row is RawRow => !!row && typeof row === "object" && !Array.isArray(row));
}

function normalizedRow(row: RawRow, category: string): RawRow {
  const find = (...keys: string[]) => {
    const entry = Object.entries(row).find(([key]) => keys.includes(key.toLowerCase().replace(/[^a-z0-9]/g, "")));
    return clean(entry?.[1]);
  };
  const rawText = find("text", "rawtext", "transaction");
  const suppliedAmount = find("value", "amount", "balance", "currentvalue", "currentbalance");
  const textFinancials = extractTextFinancials(rawText);
  const amount = normalizeNumber(suppliedAmount || textFinancials.primary);
  const name = find("name", "account", "accountname", "description", "item")
    || rawText
      .replace(/(?:[$£€]\s*)?\(?-?\d[\d,\s]*(?:\.\d{1,2})?\)?%?/g, " ")
      .replace(/[,;|\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  return {
    name,
    category,
    value: amount,
    balance: amount,
    interestRate: normalizeNumber(find("interestrate", "rate", "apr") || textFinancials.interestRate),
    minimumPayment: normalizeNumber(
      find("minimumpayment", "payment", "monthlypayment") || textFinancials.minimumPayment,
    ),
    institution: find("institution", "bank", "provider", "company"),
    notes: find("notes", "memo", "description"),
  };
}

function normalizeNumber(value: string): string {
  if (!value) return "";
  const parenthesized = /^\s*\(.*\)\s*$/.test(value);
  const normalized = value.replace(/[$£€,%\s(),]/g, "");
  if (!normalized || !Number.isFinite(Number(normalized))) return value.trim();
  return String(parenthesized ? -Math.abs(Number(normalized)) : Number(normalized));
}

function extractLabeledNumber(text: string, labels: string): string {
  const match = text.match(new RegExp(
    `(?:${labels})\\s*(?:is|of|:|=)?\\s*[$£€]?\\s*\\(?(-?\\d[\\d,]*(?:\\.\\d+)?)\\)?`,
    "i",
  ));
  return normalizeNumber(match?.[1] ?? "");
}

function extractTextFinancials(text: string): {
  primary: string;
  interestRate: string;
  minimumPayment: string;
} {
  const interestRate = extractLabeledNumber(text, "interest\\s*rate|apr|rate");
  const minimumPayment = extractLabeledNumber(
    text,
    "minimum\\s*(?:monthly\\s*)?payment|min\\.?\\s*payment|monthly\\s*payment",
  );
  const primary = extractLabeledNumber(
    text,
    "current\\s*balance|outstanding\\s*balance|balance|market\\s*value|current\\s*value|value|amount|worth|principal",
  );
  if (primary) return { primary, interestRate, minimumPayment };

  const withoutSecondaryNumbers = text
    .replace(/(?:interest\s*rate|apr|rate)\s*(?:is|of|:|=)?\s*[$£€]?\s*\(?-?\d[\d,]*(?:\.\d+)?\)?%?/gi, "")
    .replace(/(?:minimum\s*(?:monthly\s*)?payment|min\.?\s*payment|monthly\s*payment)\s*(?:is|of|:|=)?\s*[$£€]?\s*\(?-?\d[\d,]*(?:\.\d+)?\)?/gi, "");
  const candidates = Array.from(
    withoutSecondaryNumbers.matchAll(/(?:[$£€]\s*)?\(?-?\d[\d,]*(?:\.\d+)?\)?/g),
    (match) => normalizeNumber(match[0]),
  ).filter(Boolean);
  return {
    primary: candidates.length === 1 ? candidates[0] : "",
    interestRate,
    minimumPayment,
  };
}

function hasSuspiciousControlCharacters(text: string): boolean {
  const controls = Array.from(text).filter((character) => {
    const code = character.charCodeAt(0);
    return code < 32 && character !== "\n" && character !== "\r" && character !== "\t";
  }).length;
  return controls > Math.max(2, text.length * 0.01);
}

function score(text: string, category: Category): number {
  const haystack = text.toLowerCase();
  return [category.category, category.parentCategory, category.description].reduce((total, part) =>
    total + part.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && haystack.includes(word)).length, 0);
}

export function deterministicClassify(rows: RawRow[], categories: Category[]): RawRow[] {
  return rows.map((row) => {
    const text = Object.values(row).map(clean).join(" ");
    const direct = categories.find((item) => item.category.toLowerCase() === clean(row.category).toLowerCase());
    const scored = categories.map((item) => ({ item, score: score(text, item) }))
      .sort((a, b) => b.score - a.score || a.item.category.localeCompare(b.item.category));
    const generic = categories.find((item) => /\b(other|miscellaneous)\b/i.test(item.category));
    const best = direct ?? (scored[0]?.score > 0 ? scored[0].item : generic);
    return normalizedRow(row, best?.category ?? "");
  }).filter((row) => clean(row.category));
}

export async function aiClassify(
  kind: IngestionKind,
  rows: RawRow[],
  categories: Category[],
  timeoutMs = 12_000,
): Promise<RawRow[]> {
  const classified: RawRow[] = [];
  const safeCategories = categories.map((category) => ({
    parentCategory: category.parentCategory.slice(0, 200),
    category: category.category.slice(0, 200),
    description: category.description.slice(0, 500),
  }));
  const task = `Read these ${kind} records and return {"entries":[{"sourceIndex":0,"category":"an exact provided category"}]}. Each input record has a server-owned sourceIndex and its extracted source data inside row; inspect the nested row data. Include every clearly identifiable ${kind} with a monetary value or balance, including records whose fields are combined in free-form text. Account names, balance/value labels, APR, and payment labels are strong evidence; do not omit an otherwise clear record merely because it is terse. Each returned entry must contain only its numeric sourceIndex and one provided category copied verbatim; do not return or transform financial values. Return each sourceIndex at most once. If no valid ${kind}s are present or the text is unreadable, return {"entries":[]}.`;
  let offset = 0;
  while (offset < rows.length) {
    const batch: RawRow[] = [];
    const aiRows: RawRow[] = [];
    while (offset + batch.length < rows.length && batch.length < AI_BATCH_SIZE) {
      const source = rows[offset + batch.length];
      const aiRow = toAiRow(source, batch.length);
      const candidatePrompt = JSON.stringify({ task, categories: safeCategories, rows: [...aiRows, aiRow] });
      if (candidatePrompt.length > AI_PROMPT_CHARACTER_BUDGET && batch.length > 0) break;
      if (candidatePrompt.length > AI_PROMPT_CHARACTER_BUDGET) throw new Error("invalid model output");
      batch.push(source);
      aiRows.push(aiRow);
    }
    if (!batch.length) throw new Error("invalid model output");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const prompt = JSON.stringify({
      task,
      categories: safeCategories,
      rows: aiRows,
    });
    try {
      const content = await completeIngestionClassification(prompt, controller.signal);
      const parsed = JSON.parse(content);
      const output = extractJsonRows(parsed);
      if (!output?.length) throw new Error("invalid model output");
      const seen = new Set<number>();
      classified.push(...output.map((row) => {
        const requestedIndex = Number(row.sourceIndex);
        if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= batch.length || seen.has(requestedIndex)) {
          throw new Error("invalid model output");
        }
        seen.add(requestedIndex);
        return normalizedRow(batch[requestedIndex], clean(row.category));
      }));
    } finally {
      clearTimeout(timer);
    }
    offset += batch.length;
  }
  return classified;
}

export function isEmptySample(rows: RawRow[]): boolean {
  return !rows.length || rows.slice(0, 10).every((row) => Object.values(row).every((value) => !clean(value)));
}

export function hasRecognizableStructure(kind: IngestionKind, rows: RawRow[]): boolean {
  const keys = new Set(rows.slice(0, 10).flatMap((row) =>
    Object.keys(row).map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""))));
  const hasName = ["name", "account", "accountname", "description", "item"].some((key) => keys.has(key));
  const hasAmount = ["value", "amount", "balance", "currentvalue", "currentbalance"].some((key) => keys.has(key));
  if (hasName && hasAmount) return true;
  if (!keys.has("text")) return false;
  return rows.slice(0, 10).some((row) => {
    const text = clean(row.text);
    return /[a-z]{2,}/i.test(text) && /(?:[$£€]\s*)?\(?-?\d[\d,\s]*(?:\.\d{1,2})?\)?/.test(text);
  });
}