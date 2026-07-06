import { createHash } from "crypto";
import type { HighlightContent } from "@/lib/db/schema";

/**
 * Input shape accepted from uploaded JSON files or quick-add. Flexible so
 * AI tools and highlight exporters can produce a few variants without us
 * rejecting the upload.
 */
export type HighlightInput = {
  title?: string;
  author?: string;
  text?: string;
  body?: string;
  reference?: string;
  source?: string;
  url?: string;
};

export type HighlightUpload =
  | { highlights: HighlightInput[] }
  | { books?: Array<{ title?: string; author?: string; highlights?: HighlightInput[] }> }
  | HighlightInput[]
  | HighlightInput;

export type ParsedHighlight = {
  title: string;
  data: HighlightContent;
};

export type ParseResult = {
  highlights: ParsedHighlight[];
  skipped: number;
  errors: string[];
};

export const UNTITLED_HIGHLIGHT_TITLE = "Highlight";

export function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

export function normalizeMultiline(value: string): string {
  return value
    .split(/\r?\n/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    .join("\n");
}

export function cleanOptional(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(String(value));
  return cleaned || undefined;
}

/**
 * Normalize the highlight body text for dedup keying. Lowercases and
 * collapses all whitespace so trivial formatting differences between
 * re-exports don't create duplicate rows.
 */
export function normalizeTextForDedup(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a book/source title for dedup keying. Strips subtitles and
 * "by Author" suffixes so re-uploads with slightly different title
 * formatting still hit the same dedup key.
 */
export function normalizeTitleForDedup(value: string): string {
  return value
    .trim()
    .replace(/(?:,)?\s+by\s+[^:]+$/i, "")
    .replace(/\s*:\s*.*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[,;]\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic id for a user's highlight. Derived from userId + title +
 * body text so re-uploading the same highlight (even with enriched
 * metadata) collides and upserts instead of duplicating.
 */
export function highlightId(userId: string, title: string, text: string): string {
  const key = `${userId}|${normalizeTitleForDedup(title)}|${normalizeTextForDedup(text)}`;
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 12);
  return `uh-${hash}`;
}

function pickBody(input: HighlightInput): string | undefined {
  const raw = input.body ?? input.text;
  if (raw == null) return undefined;
  const text = normalizeMultiline(String(raw));
  return text || undefined;
}

function titleFromInput(input: HighlightInput, fallback?: string): string {
  const fromInput = cleanOptional(input.title);
  if (fromInput) return fromInput;
  if (fallback) return fallback;
  return UNTITLED_HIGHLIGHT_TITLE;
}

function toParsed(input: HighlightInput, fallbackTitle?: string): ParsedHighlight | null {
  const body = pickBody(input);
  if (!body) return null;
  const title = titleFromInput(input, fallbackTitle);
  const data: HighlightContent = {
    text: body,
    author: cleanOptional(input.author),
    reference: cleanOptional(input.reference),
    source: cleanOptional(input.source),
    url: cleanOptional(input.url),
  };
  return { title, data };
}

/**
 * Parse a flexible JSON upload into a normalized list of highlights.
 * Accepts `{ highlights: [...] }`, `{ books: [{ title, author, highlights }] }`,
 * a bare array, or a single highlight object. Returns errors for malformed
 * input rather than throwing, so the UI can surface them.
 */
export function parseHighlightUpload(raw: unknown): ParseResult {
  const errors: string[] = [];
  const out: ParsedHighlight[] = [];
  let skipped = 0;

  if (raw == null || typeof raw !== "object") {
    return { highlights: [], skipped: 0, errors: ["Upload must be a JSON object or array."] };
  }

  const collect = (input: HighlightInput, fallbackTitle?: string) => {
    const parsed = toParsed(input, fallbackTitle);
    if (!parsed) {
      skipped++;
      return;
    }
    out.push(parsed);
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        skipped++;
        continue;
      }
      collect(entry as HighlightInput);
    }
    return { highlights: out, skipped, errors };
  }

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.highlights)) {
    for (const entry of obj.highlights) {
      if (!entry || typeof entry !== "object") {
        skipped++;
        continue;
      }
      collect(entry as HighlightInput);
    }
    return { highlights: out, skipped, errors };
  }

  if (Array.isArray(obj.books)) {
    for (const book of obj.books) {
      if (!book || typeof book !== "object") {
        skipped++;
        continue;
      }
      const bookTitle = cleanOptional((book as HighlightInput).title);
      const bookAuthor = cleanOptional((book as HighlightInput).author);
      const entries = (book as { highlights?: unknown }).highlights;
      if (!Array.isArray(entries)) {
        skipped++;
        continue;
      }
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") {
          skipped++;
          continue;
        }
        const merged: HighlightInput = {
          ...(entry as HighlightInput),
          title: (entry as HighlightInput).title ?? bookTitle,
          author: (entry as HighlightInput).author ?? bookAuthor,
        };
        collect(merged, bookTitle);
      }
    }
    return { highlights: out, skipped, errors };
  }

  // Single highlight object at the root.
  if (typeof obj.text === "string" || typeof obj.body === "string") {
    collect(obj as HighlightInput);
    return { highlights: out, skipped, errors };
  }

  return {
    highlights: [],
    skipped: 0,
    errors: [
      'Unrecognized JSON shape. Expected { highlights: [...] }, { books: [{ highlights: [...] }] }, an array, or a single highlight.',
    ],
  };
}

/**
 * Collapse duplicate parsed highlights by their dedup key, keeping the
 * entry with the richer metadata (more non-empty optional fields).
 */
export function dedupParsedHighlights(userId: string, rows: ParsedHighlight[]): ParsedHighlight[] {
  const map = new Map<string, ParsedHighlight>();
  for (const row of rows) {
    const id = highlightId(userId, row.title, row.data.text);
    const prev = map.get(id);
    if (!prev) {
      map.set(id, row);
      continue;
    }
    if (richerThan(row.data, prev.data)) {
      map.set(id, row);
    }
  }
  return [...map.values()];
}

function richerThan(next: HighlightContent, prev: HighlightContent): boolean {
  const score = (d: HighlightContent) =>
    [d.author, d.reference, d.source, d.url].filter(Boolean).length;
  return score(next) > score(prev);
}
