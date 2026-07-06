"use server";

import { createHash } from "crypto";
import type { FeedItem, FeedOptions } from "@/lib/types";
import {
  loadArtworkFeed,
  loadBookFeed,
  loadContentFeed,
  loadHighlightFeed,
  loadRssFeed,
  getBookTitles,
  getGlobalArtists,
  getGlobalRssFeeds,
  type ContentFeedFilter,
  type ContentFeedLimits,
  type GlobalRssFeed,
} from "@/lib/db/content";
import { getUserData, getUserSession } from "@/lib/db/user";

type BucketKey = "highlight" | "rss" | "book" | "artwork" | "islam";
type IslamBucketKey = "quran" | "hadith" | "book";

const ISLAMIC_BOOKS = new Set(["The Quran", "Mishkat al-Masabih"]);

const ISLAM_FEED_TITLE_PATTERNS = [
  "the quran",
  "mishkat al masabih",
  "islam between east and west",
  "autobiography of malcom x",
  "autobiography of malcolm x",
  "islam in liberalism",
  "quran tafsir",
  "road to mecca",
  "sirah of the prophet muhammad",
  "the islamic secular",
  "the sealed nectar",
  "winning the modern world for islam",
];

const SOURCE_WEIGHTS: Record<BucketKey, number> = {
  highlight: 5,
  rss: 5,
  book: 4,
  artwork: 4,
  islam: 1,
};

const ISLAM_SOURCE_WEIGHTS: Record<IslamBucketKey, number> = {
  quran: 1,
  hadith: 1,
  book: 4,
};

const TOTAL_WEIGHT = Object.values(SOURCE_WEIGHTS).reduce((a, b) => a + b, 0);
const DEFAULT_TARGET = 300;
const BUCKET_MARGIN = 1.5;

function bucketLimitFor(key: BucketKey, target: number): number {
  return Math.ceil(((target * SOURCE_WEIGHTS[key]) / TOTAL_WEIGHT) * BUCKET_MARGIN);
}

function bucketFor(item: FeedItem): BucketKey {
  if (item.type === "book" && ISLAMIC_BOOKS.has(item.book)) return "islam";
  return item.type;
}

function makeSeededRandom(seed: string): () => number {
  const hash = createHash("sha256").update(seed).digest();
  let state = hash.readUInt32LE(0) || 1;

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function normalizeForMatch(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesIslamTitle(title: string) {
  const normalized = normalizeForMatch(title);
  return ISLAM_FEED_TITLE_PATTERNS.some(
    (pattern) => normalized === pattern || normalized.includes(pattern),
  );
}

function isIslamFeedItem(item: FeedItem) {
  if (item.type === "rss" || item.type === "artwork") return false;
  if (item.type === "book") {
    return ISLAMIC_BOOKS.has(item.book) || matchesIslamTitle(item.book);
  }
  return matchesIslamTitle(item.title);
}

function islamBucketFor(item: FeedItem): IslamBucketKey {
  if (item.type === "book" && item.book === "The Quran") return "quran";
  if (item.type === "book" && item.book === "Mishkat al-Masabih") return "hadith";
  return "book";
}

function orderIslamFeed(items: FeedItem[], seed: string) {
  const buckets: Record<IslamBucketKey, FeedItem[]> = {
    quran: [],
    hadith: [],
    book: [],
  };

  for (const item of items.filter(isIslamFeedItem)) {
    buckets[islamBucketFor(item)].push(item);
  }

  for (const key of Object.keys(buckets) as IslamBucketKey[]) {
    buckets[key] = shuffleWithSeed(
      [...buckets[key]].sort((a, b) => a.id.localeCompare(b.id)),
      makeSeededRandom(`${seed}:islam:${key}`),
    );
  }

  const scheduler = makeSeededRandom(`${seed}:islam:scheduler`);
  const ordered: FeedItem[] = [];

  while (buckets.quran.length || buckets.hadith.length || buckets.book.length) {
    const available = (Object.keys(buckets) as IslamBucketKey[]).filter(
      (key) => buckets[key].length > 0,
    );
    const totalWeight = available.reduce((sum, key) => sum + ISLAM_SOURCE_WEIGHTS[key], 0);

    let roll = scheduler() * totalWeight;
    let selected = available[available.length - 1];

    for (const key of available) {
      roll -= ISLAM_SOURCE_WEIGHTS[key];
      if (roll < 0) {
        selected = key;
        break;
      }
    }

    const next = buckets[selected].pop();
    if (next) ordered.push(next);
  }

  return ordered;
}

function orderHighlights(
  items: FeedItem[],
  seed: string,
  options: Extract<FeedOptions, { contentType: "highlights" }>,
): FeedItem[] {
  const highlightItems = items.filter(
    (item): item is Extract<FeedItem, { type: "highlight" }> => item.type === "highlight",
  );
  const filtered = options.bookTitle
    ? highlightItems.filter((item) => item.title === options.bookTitle)
    : highlightItems;

  if (options.bookOrder === "random") {
    return shuffleWithSeed(
      [...filtered].sort((a, b) => a.id.localeCompare(b.id)),
      makeSeededRandom(`${seed}:highlights:${options.bookTitle ?? "all"}`),
    );
  }

  return filtered;
}

function orderDefaultFeed(items: FeedItem[], seed: string): FeedItem[] {
  const buckets: Record<BucketKey, FeedItem[]> = {
    highlight: [],
    rss: [],
    book: [],
    artwork: [],
    islam: [],
  };
  for (const item of items) buckets[bucketFor(item)].push(item);

  for (const key of Object.keys(buckets) as BucketKey[]) {
    const sorted = [...buckets[key]].sort((a, b) => a.id.localeCompare(b.id));
    buckets[key] = shuffleWithSeed(sorted, makeSeededRandom(`${seed}:${key}`));
  }

  const scheduler = makeSeededRandom(seed);
  const ordered: FeedItem[] = [];

  while (
    buckets.highlight.length ||
    buckets.rss.length ||
    buckets.book.length ||
    buckets.artwork.length ||
    buckets.islam.length
  ) {
    const available = (Object.keys(buckets) as BucketKey[]).filter(
      (key) => buckets[key].length > 0,
    );
    const totalWeight = available.reduce((sum, key) => sum + SOURCE_WEIGHTS[key], 0);

    let roll = scheduler() * totalWeight;
    let selected = available[available.length - 1];

    for (const key of available) {
      roll -= SOURCE_WEIGHTS[key];
      if (roll < 0) {
        selected = key;
        break;
      }
    }

    const next = buckets[selected].pop();
    if (next) ordered.push(next);
  }

  return ordered;
}

function orderRss(
  items: FeedItem[],
  seed: string,
  rssOrder: "chronological" | "random",
): FeedItem[] {
  const rssItems = items.filter(
    (item): item is Extract<FeedItem, { type: "rss" }> => item.type === "rss",
  );

  if (rssOrder === "chronological") {
    return [...rssItems].sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime || b.id.localeCompare(a.id);
    });
  }

  return shuffleWithSeed(
    [...rssItems].sort((a, b) => a.id.localeCompare(b.id)),
    makeSeededRandom(`${seed}:rss`),
  );
}

async function getUserFeedFilter(): Promise<ContentFeedFilter> {
  const session = await getUserSession();
  const id = session?.user?.id;
  if (!id) return {};
  const data = await getUserData({ id });
  return {
    userId: id,
    artists: data.artists,
    rssFeeds: data.rssFeeds,
    hiddenArtists: data.hiddenArtists,
    hiddenRssFeeds: data.hiddenRssFeeds,
    hiddenBooks: data.hiddenBooks,
    hiddenHighlights: data.hiddenHighlights,
  };
}

// Cache the raw (pre-order) content items per options + user filter so that
// pagination (getFeedItemsPage) does not re-query the content table on every
// loadMore. Ordering is deterministic by seed and is re-derived per call, so
// only the loaded items are cached. Entries are TTL-evicted and capped.
const ITEMS_CACHE = new Map<string, { items: FeedItem[]; target: number; expires: number }>();
const ITEMS_CACHE_TTL = 5 * 60 * 1000;
const ITEMS_CACHE_MAX = 16;
const INFLIGHT_LOADS = new Map<string, Promise<FeedItem[]>>();

function filterKey(filter: ContentFeedFilter): string {
  return [
    filter.userId ?? "",
    (filter.artists ?? []).join(","),
    (filter.rssFeeds ?? []).join(","),
    (filter.hiddenArtists ?? []).join(","),
    (filter.hiddenRssFeeds ?? []).join(","),
    (filter.hiddenBooks ?? []).join(","),
    (filter.hiddenHighlights ?? []).join(","),
  ].join("|");
}

function itemsCacheKey(options: FeedOptions | null | undefined, filter: ContentFeedFilter): string {
  const optionsJson = options ? JSON.stringify(options) : "default";
  return `${optionsJson}:${filterKey(filter)}`;
}

function getCachedItems(key: string, target: number): FeedItem[] | null {
  const entry = ITEMS_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    ITEMS_CACHE.delete(key);
    return null;
  }
  if (entry.target < target) return null;
  return entry.items;
}

function setCachedItems(key: string, items: FeedItem[], target: number) {
  const existing = ITEMS_CACHE.get(key);
  if (existing && existing.target >= target) return;
  ITEMS_CACHE.set(key, { items, target, expires: Date.now() + ITEMS_CACHE_TTL });
  while (ITEMS_CACHE.size > ITEMS_CACHE_MAX) {
    const first = ITEMS_CACHE.keys().next().value;
    if (first === undefined) break;
    ITEMS_CACHE.delete(first);
  }
}

function defaultLimits(target: number): ContentFeedLimits {
  return {
    artwork: bucketLimitFor("artwork", target),
    rss: bucketLimitFor("rss", target),
    books: bucketLimitFor("book", target) + bucketLimitFor("islam", target),
    highlights: bucketLimitFor("highlight", target),
  };
}

async function loadItemsFor(
  options: FeedOptions | null | undefined,
  filter: ContentFeedFilter,
  target: number,
): Promise<FeedItem[]> {
  if (!options) return loadContentFeed(filter, defaultLimits(target));
  if (options.contentType === "art")
    return loadArtworkFeed(filter.artists, filter.hiddenArtists, target, filter.userId);
  if (options.contentType === "rss") {
    return loadRssFeed(
      filter.rssFeeds,
      filter.hiddenRssFeeds,
      filter.rssMaxAgeDays,
      target,
      options.rssOrder,
      filter.userId,
    );
  }
  if (options.contentType === "islam")
    return loadBookFeed(undefined, filter.hiddenBooks, target);
  if (options.contentType === "highlights") {
    if (!filter.userId) return [];
    const explicitTitle = options.bookTitle;
    return loadHighlightFeed(
      filter.userId,
      target,
      explicitTitle ? undefined : filter.hiddenHighlights,
      explicitTitle ? [explicitTitle] : undefined,
    );
  }
  return loadContentFeed(filter, defaultLimits(target));
}

function orderItems(
  items: FeedItem[],
  seed: string,
  options: FeedOptions | null | undefined,
): FeedItem[] {
  if (!options) return orderDefaultFeed(items, seed);
  if (options.contentType === "art") {
    return shuffleWithSeed(
      [...items].sort((a, b) => a.id.localeCompare(b.id)),
      makeSeededRandom(`${seed}:art`),
    );
  }
  if (options.contentType === "rss") return orderRss(items, seed, options.rssOrder);
  if (options.contentType === "islam") return orderIslamFeed(items, seed);
  if (options.contentType === "highlights") return orderHighlights(items, seed, options);
  return orderDefaultFeed(items, seed);
}

export async function getFeedItems(
  seed: string = "default",
  options?: FeedOptions | null,
  target: number = DEFAULT_TARGET,
): Promise<FeedItem[]> {
  const filter = await getUserFeedFilter();
  const cacheKey = itemsCacheKey(options, filter);
  let items = getCachedItems(cacheKey, target);
  if (items) return orderItems(items, seed, options);

  const inflightKey = `${cacheKey}:t${target}`;
  let load = INFLIGHT_LOADS.get(inflightKey);
  if (!load) {
    load = loadItemsFor(options, filter, target)
      .then((loaded) => {
        setCachedItems(cacheKey, loaded, target);
        return loaded;
      })
      .finally(() => {
        INFLIGHT_LOADS.delete(inflightKey);
      });
    INFLIGHT_LOADS.set(inflightKey, load);
  }
  items = await load;
  return orderItems(items, seed, options);
}

export async function getFeedItemsPage(
  offset: number = 0,
  count: number = 50,
  seed: string = "default",
  options?: FeedOptions | null,
): Promise<FeedItem[]> {
  const target = Math.max(offset + count, DEFAULT_TARGET);
  const all = await getFeedItems(seed, options, target);
  return all.slice(offset, offset + count);
}

export async function getBookTitlesAction(): Promise<{ title: string; author?: string }[]> {
  return getBookTitles();
}

export async function getGlobalArtistsAction(): Promise<string[]> {
  return getGlobalArtists();
}

export async function getGlobalRssFeedsAction(): Promise<GlobalRssFeed[]> {
  return getGlobalRssFeeds();
}
