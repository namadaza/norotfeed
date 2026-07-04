import { and, eq, inArray, isNull, or, sql, asc, desc, notInArray } from "drizzle-orm";
import { db } from "./client";
import {
  content,
  type Content,
  type ContentInsert,
  type ArtworkContent,
  type RssContent,
  type HighlightContent,
  type BookContent,
} from "./schema";
import type { FeedItem } from "@/lib/types";

export type ContentDataFor<T extends Content["type"]> =
  T extends "artwork"
    ? ArtworkContent
    : T extends "rss"
      ? RssContent
      : T extends "highlight"
        ? HighlightContent
        : BookContent;

export type TypedContentRow<T extends Content["type"]> = {
  id: string;
  type: T;
  title: string;
  data: ContentDataFor<T>;
  userId: string | null;
  createdAt: Date;
};

export type AnyContentRow =
  | { id: string; type: "artwork"; title: string; data: ArtworkContent; userId: string | null; createdAt: Date }
  | { id: string; type: "rss"; title: string; data: RssContent; userId: string | null; createdAt: Date }
  | { id: string; type: "highlight"; title: string; data: HighlightContent; userId: string | null; createdAt: Date }
  | { id: string; type: "book"; title: string; data: BookContent; userId: string | null; createdAt: Date };

export type ContentFeedFilter = {
  userId?: string;
  artists?: string[];
  rssFeeds?: string[];
  rssMaxAgeDays?: number;
  hiddenArtists?: string[];
  hiddenRssFeeds?: string[];
  hiddenBooks?: string[];
};

const DEFAULT_RSS_MAX_AGE_DAYS = 7;

export function contentToFeedItem(row: AnyContentRow): FeedItem | null {
  switch (row.type) {
    case "artwork":
      return { type: "artwork", id: row.id, data: row.data };
    case "rss":
      return { type: "rss", id: row.id, ...row.data };
    case "book":
      return { type: "book", id: row.id, ...row.data };
    case "highlight":
      return { type: "highlight", id: row.id, title: row.title, text: row.data.text };
  }
}

export async function loadArtworkFeed(
  artists?: string[],
  hiddenArtists?: string[],
  limit?: number,
  includeUserId?: string,
): Promise<FeedItem[]> {
  const personal = artists ?? [];
  const hidden = hiddenArtists ?? [];
  const effectiveHidden = hidden.filter((slug) => !personal.includes(slug));
  // Fetch a pool larger than `limit` so we can balance across artists via
  // round-robin. ORDER BY id ASC alone over-represents whichever artist has
  // the most rows in the DB (e.g. Manet), starving the others.
  const poolLimit = limit ? Math.max(limit * 5, 100) : undefined;
  const rows = await getContentByType("artwork", {
    excludeTitles: effectiveHidden.length > 0 ? effectiveHidden : undefined,
    limit: poolLimit,
    ...(includeUserId ? { includeUserId } : { userId: null as string | null }),
  });
  const balanced = limit ? roundRobinByArtist(rows, limit) : rows;
  return balanced
    .map((row) => contentToFeedItem(row))
    .filter((item): item is FeedItem => item !== null);
}

/**
 * Pick `limit` artwork rows balanced across artists (grouped by
 * `content.title`, which holds the artist slug). Cycles through artists,
 * taking one row from each in turn, so no single artist can dominate the
 * result regardless of how many rows it has in the DB.
 */
function roundRobinByArtist<T extends TypedContentRow<"artwork">>(
  rows: T[],
  limit: number,
): T[] {
  if (rows.length === 0) return [];
  const byArtist = new Map<string, T[]>();
  for (const row of rows) {
    const list = byArtist.get(row.title);
    if (list) list.push(row);
    else byArtist.set(row.title, [row]);
  }
  const buckets = [...byArtist.keys()].sort().map((k) => byArtist.get(k)!);
  const result: T[] = [];
  let idx = 0;
  while (result.length < limit && buckets.some((b) => b.length > 0)) {
    const bucket = buckets[idx % buckets.length];
    if (bucket.length > 0) result.push(bucket.shift()!);
    idx++;
  }
  return result;
}

export async function loadRssFeed(
  rssFeeds?: string[],
  hiddenRssFeeds?: string[],
  maxAgeDays: number = DEFAULT_RSS_MAX_AGE_DAYS,
  limit?: number,
  order: "chronological" | "random" = "random",
  includeUserId?: string,
): Promise<FeedItem[]> {
  const cutoffIso = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const personal = rssFeeds ?? [];
  const hidden = hiddenRssFeeds ?? [];
  const effectiveHidden = hidden.filter((url) => !personal.includes(url));
  const rows = await getContentByType("rss", {
    minPublishedAt: cutoffIso,
    limit,
    rssOrder: order,
    excludeFeedUrls: effectiveHidden.length > 0 ? effectiveHidden : undefined,
    ...(includeUserId ? { includeUserId } : { userId: null as string | null }),
  });
  return rows
    .map((row) => contentToFeedItem(row))
    .filter((item): item is FeedItem => item !== null);
}

export async function loadBookFeed(
  titles?: string[],
  hiddenBooks?: string[],
  limit?: number,
): Promise<FeedItem[]> {
  // Explicit title selection (book-highlights feed mode) overrides hides.
  if (titles && titles.length > 0) {
    const rows = await getContentByType("book", { titles, limit });
    return rows
      .map((row) => contentToFeedItem(row))
      .filter((item): item is FeedItem => item !== null);
  }
  const hidden = hiddenBooks ?? [];
  const rows = await getContentByType("book", {
    excludeTitles: hidden.length > 0 ? hidden : undefined,
    limit,
  });
  return rows
    .map((row) => contentToFeedItem(row))
    .filter((item): item is FeedItem => item !== null);
}

export type ContentFeedLimits = {
  artwork?: number;
  rss?: number;
  books?: number;
};

export async function loadContentFeed(
  filter: ContentFeedFilter = {},
  limits?: ContentFeedLimits,
): Promise<FeedItem[]> {
  const [artworks, rss, books] = await Promise.all([
    loadArtworkFeed(filter.artists, filter.hiddenArtists, limits?.artwork, filter.userId),
    loadRssFeed(
      filter.rssFeeds,
      filter.hiddenRssFeeds,
      filter.rssMaxAgeDays,
      limits?.rss,
      "random",
      filter.userId,
    ),
    loadBookFeed(undefined, filter.hiddenBooks, limits?.books),
  ]);
  return [...artworks, ...rss, ...books];
}

export async function getBookTitles(): Promise<{ title: string; author?: string }[]> {
  const rows = await db
    .select({
      title: content.title,
      author: sql<string | null>`MAX(${content.data}->>'author')`,
    })
    .from(content)
    .where(and(eq(content.type, "book"), isNull(content.userId)))
    .groupBy(content.title);
  return rows
    .map((row) => ({ title: row.title, author: row.author ?? undefined }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getGlobalArtists(): Promise<string[]> {
  const rows = await db
    .select({ title: content.title })
    .from(content)
    .where(and(eq(content.type, "artwork"), isNull(content.userId)))
    .groupBy(content.title);
  return rows.map((row) => row.title).sort((a, b) => a.localeCompare(b));
}

export type GlobalRssFeed = { feedUrl: string; publication: string };

export async function getGlobalRssFeeds(): Promise<GlobalRssFeed[]> {
  const rows = await db
    .select({
      feedUrl: sql<string>`${content.data}->>'feedUrl'`,
      publication: sql<string>`${content.data}->>'publication'`,
    })
    .from(content)
    .where(and(eq(content.type, "rss"), isNull(content.userId)));
  const map = new Map<string, string>();
  for (const row of rows) {
    const feedUrl = row.feedUrl;
    if (!feedUrl || map.has(feedUrl)) continue;
    map.set(feedUrl, row.publication || feedUrl);
  }
  return [...map.entries()]
    .map(([feedUrl, publication]) => ({ feedUrl, publication }))
    .sort((a, b) => a.publication.localeCompare(b.publication));
}

export async function insertContent(
  rows: ContentInsert[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(content)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: content.id });
  return inserted.length;
}

export async function insertOne(row: ContentInsert): Promise<boolean> {
  const inserted = await db
    .insert(content)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: content.id });
  return inserted.length > 0;
}

export async function getContentByType<T extends Content["type"]>(
  type: T,
  options: {
    userId?: string | null;
    includeUserId?: string;
    titles?: string[];
    feedUrls?: string[];
    excludeTitles?: string[];
    excludeFeedUrls?: string[];
    minPublishedAt?: string;
    limit?: number;
    rssOrder?: "chronological" | "random";
  } = {},
): Promise<TypedContentRow<T>[]> {
  const conditions: (ReturnType<typeof eq> | undefined)[] = [
    eq(content.type, type),
  ];
  if (options.titles && options.titles.length > 0) {
    conditions.push(inArray(content.title, options.titles));
  }
  if (options.excludeTitles && options.excludeTitles.length > 0) {
    conditions.push(notInArray(content.title, options.excludeTitles));
  }
  if (options.includeUserId) {
    conditions.push(
      or(isNull(content.userId), eq(content.userId, options.includeUserId)),
    );
  } else if (options.userId === null) {
    conditions.push(isNull(content.userId));
  } else if (options.userId) {
    conditions.push(eq(content.userId, options.userId));
  }
  if (options.feedUrls && options.feedUrls.length > 0) {
    conditions.push(
      sql`${content.data}->>'feedUrl' IN (${sql.join(
        options.feedUrls.map((url) => sql`${url}`),
        sql`, `,
      )})`,
    );
  }
  if (options.excludeFeedUrls && options.excludeFeedUrls.length > 0) {
    conditions.push(
      sql`${content.data}->>'feedUrl' NOT IN (${sql.join(
        options.excludeFeedUrls.map((url) => sql`${url}`),
        sql`, `,
      )})`,
    );
  }
  if (options.minPublishedAt) {
    const ageCondition = or(
      sql`${content.data}->>'publishedAt' IS NULL`,
      sql`${content.data}->>'publishedAt' = ''`,
      sql`${content.data}->>'publishedAt' >= ${options.minPublishedAt}`,
    );
    if (ageCondition) conditions.push(ageCondition);
  }

  const orderBy =
    type === "rss" && options.rssOrder === "chronological"
      ? [sql`(${content.data}->>'publishedAt') DESC NULLS LAST`, desc(content.id)]
      : [asc(content.id)];

  const baseQuery = db
    .select()
    .from(content)
    .where(and(...conditions))
    .orderBy(...orderBy);
  const rows = options.limit
    ? await baseQuery.limit(options.limit)
    : await baseQuery;
  return rows as unknown as TypedContentRow<T>[];
}

export async function countContentByType(
  type: Content["type"],
): Promise<number> {
  const rows = await db
    .select({ id: content.id })
    .from(content)
    .where(eq(content.type, type));
  return rows.length;
}
