import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import Parser from "rss-parser";
import { RSS_FOLLOWS } from "./rss-follows";

type RssItem = {
  type: "rss";
  id: string;
  title: string;
  url: string;
  publication: string;
  author?: string;
  excerpt?: string;
  publishedAt?: string;
  feedUrl: string;
};

type ExternalFeedFile = {
  fetchedAt: string;
  items: RssItem[];
};

const OUT_PATH = join(process.cwd(), "src", "lib", "data", "external-feed.json");

const EXCERPT_LIMIT = 320;
const MAX_AGE_DAYS = 7;
const MAX_ITEMS = 500;

const parser = new Parser({
  timeout: 15_000,
  headers: {
    "User-Agent": "norotfeed-ingest/1.0 (+https://github.com/namadaza/norotfeed)",
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

function idFor(url: string): string {
  return "rss-" + createHash("sha1").update(url).digest("hex").slice(0, 12);
}

function feedUrlFor(source: string): string {
  const normalized = source.replace(/\/$/, "");
  return normalized.endsWith("/feed") || normalized.endsWith("/rss")
    ? normalized
    : `${normalized}/feed`;
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

async function fetchPublication(source: string): Promise<RssItem[]> {
  const feedUrl = feedUrlFor(source);
  const feed = await withTimeout(parser.parseURL(feedUrl), PER_FEED_TIMEOUT_MS, source);
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
      type: "rss",
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

async function loadExisting(): Promise<RssItem[]> {
  try {
    const raw = await readFile(OUT_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<ExternalFeedFile>;
    return Array.isArray(parsed.items)
      ? parsed.items.map((item) => ({
          ...item,
          type: "rss" as const,
          id: item.id?.replace(/^substack-/, "rss-") ?? item.id,
        }))
      : [];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  await mkdir(join(process.cwd(), "src", "lib", "data"), { recursive: true });
  const now = Date.now();
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  if (RSS_FOLLOWS.length === 0) {
    console.warn("No publications configured in scripts/rss-follows.ts; writing empty feed.");
  }

  const results = await Promise.allSettled(RSS_FOLLOWS.map((u) => fetchPublication(u)));

  const fresh: RssItem[] = [];
  results.forEach((r, i) => {
    const pub = RSS_FOLLOWS[i];
    if (r.status === "fulfilled") {
      console.log(`[${pub}] ${r.value.length} items`);
      fresh.push(...r.value);
    } else {
      console.error(`[${pub}] failed:`, r.reason);
    }
  });

  const freshRecent = fresh.filter((item) => {
    if (!item.publishedAt) return false;
    const published = Date.parse(item.publishedAt);
    return Number.isFinite(published) && published >= cutoff;
  });

  // Write fresh recent items to the `content` table (DB is the feed's source of truth).
  try {
    const { db } = await import("@/lib/db/client");
    const { content } = await import("@/lib/db/schema");
    const rows = freshRecent.map((item) => ({
      id: item.id,
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
      userId: null,
    }));
    let dbInserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const returned = await db
        .insert(content)
        .values(batch)
        .onConflictDoNothing()
        .returning({ id: content.id });
      dbInserted += returned.length;
    }
    console.log(`Inserted ${dbInserted} rss rows into content table`);
  } catch (err) {
    console.error("DB insert failed:", (err as Error).message);
  }

  const existing = await loadExisting();
  const merged = new Map<string, RssItem>();
  for (const it of existing) merged.set(it.id, it);
  for (const it of fresh) merged.set(it.id, it);

  const items = [...merged.values()]
    .filter((item) => {
      if (!item.publishedAt) return false;
      const published = Date.parse(item.publishedAt);
      return Number.isFinite(published) && published >= cutoff;
    })
    .sort((a, b) => {
      const ad = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bd = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bd - ad;
    });

  const trimmed = items.slice(0, MAX_ITEMS);

  const output: ExternalFeedFile = {
    fetchedAt: new Date().toISOString(),
    items: trimmed,
  };

  await writeFile(OUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${trimmed.length} items → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
