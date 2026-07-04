#!/usr/bin/env node
// Backfill default books from src/lib/data/books into the `content` table as
// type='book' rows with no user_id (global default selection).
// Idempotent: re-running skips rows whose id already exists.
// Skips the 4 default books not present in the repo (Benjamin Franklin,
// Crime and Punishment, Physics of God, Skin in the Game) — add their source
// files first, then re-run.

import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { content, type BookContent } from "@/lib/db/schema";

const BOOKS_DIR = join(process.cwd(), "src", "lib", "data", "books");

// Tagore poetry = gitanjali + stray-birds + crescent-moon (all Tagore, all in repo).
const DEFAULT_BOOK_FILES = [
  "quran.json",
  "golden-treasury.json",
  "gitanjali.json",
  "stray-birds.json",
  "crescent-moon.json",
  "procrustes.json",
  "mishkat-al-masabih-feed.json",
  "koreader-generated/koreader-quran-tafsir-by-yusuf-ali-1b9657c2.json",
  "koreader-generated/koreader-infinite-jest-c5e818ca.json",
  "koreader-generated/koreader-encyclical-letter-of-his-holiness-leo-xiv-magnifica-humanitas-15-may-2026-90ef4efe.json",
  "koreader-generated/koreader-no-one-is-talking-about-this-3a15bbd7.json",
  "koreader-generated/koreader-the-cybernetic-hypothesis-fe853d3e.json",
  "koreader-generated/koreader-the-dip-d01c5b92.json",
];

type BookFile = {
  slug: string;
  title: string;
  author?: string;
  type: "poem" | "aphorism";
  fetchedAt?: string;
  items: Array<{
    title?: string;
    text?: string;
    body?: string;
    source?: string;
    reference?: string;
    url?: string;
    secondaryText?: string;
  }>;
};

function normalizeBookTitle(title: string) {
  return title
    .trim()
    .replace(/(?:,)?\s+by\s+[^:]+$/i, "")
    .replace(/\s*:\s*.*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[,;]\s*$/, "")
    .trim();
}

function itemId(slug: string, natural: string): string {
  return (
    slug +
    "-" +
    createHash("sha1").update(natural).digest("hex").slice(0, 12)
  );
}

function fanOut(book: BookFile) {
  const format: "poem" | "prose" = book.type === "poem" ? "poem" : "prose";
  const out: Array<{
    id: string;
    type: "book";
    title: string;
    data: BookContent;
    userId: null;
  }> = [];
  for (const raw of book.items) {
    const body = (raw.body ?? raw.text ?? "").trim();
    if (!body) continue;
    const itemTitle = raw.title?.trim() || undefined;
    const naturalKey = format === "poem" ? `${itemTitle ?? ""}\n${body}` : body;
    out.push({
      id: itemId(book.slug, naturalKey),
      type: "book",
      title: normalizeBookTitle(book.title),
      data: {
        format,
        body,
        title: itemTitle,
        author: book.author,
        book: book.title,
        source: raw.source?.trim() || undefined,
        reference: raw.reference?.trim() || undefined,
        url: raw.url?.trim() || undefined,
        secondaryText: raw.secondaryText?.trim() || undefined,
      },
      userId: null,
    });
  }
  return out;
}

const BATCH_SIZE = 100;

async function loadBookFile(path: string): Promise<BookFile | null> {
  const raw = await readFile(path, "utf-8");
  const book = JSON.parse(raw) as Partial<BookFile>;
  if (
    !book ||
    typeof book !== "object" ||
    typeof book.slug !== "string" ||
    typeof book.title !== "string" ||
    (book.type !== "poem" && book.type !== "aphorism") ||
    !Array.isArray(book.items)
  ) {
    return null;
  }
  return book as BookFile;
}

async function main() {
  const { db } = await import("@/lib/db/client");
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalItems = 0;
  const perBook: Array<{ file: string; title: string; items: number; inserted: number }> = [];

  for (const relPath of DEFAULT_BOOK_FILES) {
    const absPath = join(BOOKS_DIR, relPath);
    let book: BookFile | null;
    try {
      book = await loadBookFile(absPath);
    } catch (err) {
      console.error(`Could not load ${relPath}:`, (err as Error).message);
      continue;
    }
    if (!book) {
      console.warn(`Skipping ${relPath}: invalid book file shape.`);
      continue;
    }

    const rows = fanOut(book);
    totalItems += rows.length;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const returned = await db
        .insert(content)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: content.id });
      inserted += returned.length;
    }

    totalInserted += inserted;
    totalSkipped += rows.length - inserted;
    perBook.push({
      file: relPath,
      title: normalizeBookTitle(book.title),
      items: rows.length,
      inserted,
    });
  }

  console.log("\nPer book:");
  for (const b of perBook) {
    console.log(
      `  ${b.title.padEnd(40)} ${String(b.inserted).padStart(5)}/${String(b.items).padStart(5)}  (${b.file})`,
    );
  }
  console.log(
    `\nInserted ${totalInserted} book rows; skipped ${totalSkipped} (already present); ${totalItems} total items processed.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
