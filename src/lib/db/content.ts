import { and, eq, inArray, isNull, or, sql, asc, desc } from "drizzle-orm";
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
  artists?: string[];
  rssFeeds?: string[];
  rssMaxAgeDays?: number;
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
  limit?: number,
): Promise<FeedItem[]> {
  const rows =
    artists && artists.length > 0
      ? await getContentByType("artwork", { titles: artists, limit })
      : await getContentByType("artwork", { limit });
  return rows
    .map((row) => contentToFeedItem(row))
    .filter((item): item is FeedItem => item !== null);
}

export async function loadRssFeed(
  rssFeeds?: string[],
  maxAgeDays: number = DEFAULT_RSS_MAX_AGE_DAYS,
  limit?: number,
  order: "chronological" | "random" = "random",
): Promise<FeedItem[]> {
  const cutoffIso = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const rows = await getContentByType("rss", {
    feedUrls: rssFeeds && rssFeeds.length > 0 ? rssFeeds : undefined,
    minPublishedAt: cutoffIso,
    limit,
    rssOrder: order,
  });
  return rows
    .map((row) => contentToFeedItem(row))
    .filter((item): item is FeedItem => item !== null);
}

export async function loadBookFeed(
  titles?: string[],
  limit?: number,
): Promise<FeedItem[]> {
  const rows =
    titles && titles.length > 0
      ? await getContentByType("book", { titles, limit })
      : await getContentByType("book", { limit });
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
    loadArtworkFeed(filter.artists, limits?.artwork),
    loadRssFeed(filter.rssFeeds, filter.rssMaxAgeDays, limits?.rss),
    loadBookFeed(undefined, limits?.books),
  ]);
  return [...artworks, ...rss, ...books];
}

export async function getBookTitles(): Promise<string[]> {
  const rows = await db
    .select({ title: content.title })
    .from(content)
    .where(and(eq(content.type, "book"), isNull(content.userId)))
    .groupBy(content.title);
  return rows.map((row) => row.title).sort((a, b) => a.localeCompare(b));
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
    titles?: string[];
    feedUrls?: string[];
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
  if (options.userId === null) {
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
