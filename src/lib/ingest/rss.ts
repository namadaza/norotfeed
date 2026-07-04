import { createHash } from "crypto";
import Parser from "rss-parser";
import { content } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

export type RssItem = {
  id: string;
  title: string;
  url: string;
  publication: string;
  author?: string;
  excerpt?: string;
  publishedAt?: string;
  feedUrl: string;
};

const EXCERPT_LIMIT = 320;
export const MAX_AGE_DAYS = 7;

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent":
      "norotfeed-ingest/1.0 (+https://github.com/namadaza/norotfeed)",
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

function publicationName(feedTitle: string | undefined, url: string): string {
  if (feedTitle && feedTitle.trim()) return feedTitle.trim();
  try {
    const host = new URL(url).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function feedUrlFor(source: string): string {
  const normalized = source.replace(/\/$/, "");
  return normalized.endsWith("/feed") || normalized.endsWith("/rss")
    ? normalized
    : `${normalized}/feed`;
}

/** Normalize an RSS source URL for dedup comparison (strip trailing slash and
 *  /feed or /rss suffix, lowercased). */
export function normalizeRssSource(source: string): string {
  let s = source.trim().toLowerCase().replace(/\/$/, "");
  s = s.replace(/\/feed$/, "").replace(/\/rss$/, "");
  return s;
}

export function hashFor(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 12);
}

export function idFor(url: string, userId?: string | null): string {
  return userId ? `rss:${userId}:${hashFor(url)}` : `rss-${hashFor(url)}`;
}

const PER_FEED_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function isWithinMaxAge(publishedAt: string | undefined): boolean {
  if (!publishedAt) return false;
  const published = Date.parse(publishedAt);
  if (!Number.isFinite(published)) return false;
  return published >= Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Fetch and parse a single RSS source. Items are returned with global-style
 * ids (`rss-<hash>`); scope them per-user at insert time via `insertRssItems`.
 */
export async function fetchRssItems(source: string): Promise<RssItem[]> {
  const feedUrl = feedUrlFor(source);
  const feed = await withTimeout(
    parser.parseURL(feedUrl),
    PER_FEED_TIMEOUT_MS,
    source,
  );
  const publication = publicationName(feed.title, source);
  const items: RssItem[] = [];

  for (const entry of feed.items ?? []) {
    const link = entry.link?.trim();
    const title = entry.title?.trim();
    if (!link || !title) continue;

    const rawExcerpt =
      entry.contentSnippet ||
      (entry.summary ? stripHtml(entry.summary) : "") ||
      (entry.content ? stripHtml(entry.content) : "");
    const excerpt = rawExcerpt ? truncate(rawExcerpt, EXCERPT_LIMIT) : undefined;

    items.push({
      id: idFor(link),
      title,
      url: link,
      publication,
      author: entry.creator?.trim() || undefined,
      excerpt,
      publishedAt: entry.isoDate || entry.pubDate || undefined,
      feedUrl: source,
    });
  }
  return items;
}

/**
 * Insert RSS items into the `content` table. When `userId` is set, ids are
 * scoped per-user so a user's custom feed never collides with global rows.
 * Idempotent via `on conflict do nothing` on `content.id`.
 */
export async function insertRssItems(
  items: RssItem[],
  userId: string | null,
): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items
    .filter((item) => isWithinMaxAge(item.publishedAt))
    .map((item) => ({
      id: userId ? `rss:${userId}:${hashFor(item.url)}` : item.id,
      type: "rss" as const,
      title: item.publication,
      data: {
        title: item.title,
        url: item.url,
        publication: item.publication,
        author: item.author,
        excerpt: item.excerpt,
        publishedAt: item.publishedAt,
        feedUrl: item.feedUrl,
      },
      userId,
    }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const returned = await db
      .insert(content)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: content.id });
    inserted += returned.length;
  }
  return inserted;
}
