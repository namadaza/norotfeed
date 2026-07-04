#!/usr/bin/env node
// Backfill RSS items from src/lib/data/external-feed.json into the `content`
// table as type='rss' rows with no user_id (global default).
// Derives `feedUrl` by matching each item's host against scripts/rss-follows.ts.
// Idempotent: re-running skips rows whose id already exists.
// NOTE: scripts/ingest.ts is the canonical writer (it captures the exact
// feedUrl at fetch time). This backfill is a one-time seed from the existing
// JSON snapshot so the feed can move to the DB without a live ingest run.

import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import { RSS_FOLLOWS } from "./rss-follows";
import { content } from "@/lib/db/schema";

const IN_PATH = join(
  process.cwd(),
  "src",
  "lib",
  "data",
  "external-feed.json",
);

type RssItem = {
  id: string;
  title: string;
  url: string;
  publication: string;
  author?: string;
  excerpt?: string;
  publishedAt?: string;
};

type ExternalFeedFile = {
  fetchedAt: string | null;
  items: RssItem[];
};

function hostname(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const SOURCE_BY_HOST = new Map<string, string>();
for (const source of RSS_FOLLOWS) {
  const h = hostname(source);
  if (h) SOURCE_BY_HOST.set(h, source);
}

function deriveFeedUrl(item: RssItem): string | undefined {
  const h = hostname(item.url);
  return SOURCE_BY_HOST.get(h);
}

const BATCH_SIZE = 100;

async function main() {
  const { db } = await import("@/lib/db/client");
  const raw = await readFile(IN_PATH, "utf-8");
  const parsed = JSON.parse(raw) as ExternalFeedFile;
  const items = parsed.items ?? [];
  if (items.length === 0) {
    console.log("No RSS items found in external-feed.json; exiting.");
    return;
  }
  console.log(`Loaded ${items.length} RSS items from ${IN_PATH}`);

  let withFeedUrl = 0;
  const rows = items.map((item) => {
    const feedUrl = deriveFeedUrl(item);
    if (feedUrl) withFeedUrl++;
    return {
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
        feedUrl,
      },
      userId: null,
    };
  });

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

  console.log(
    `Inserted ${inserted} rss rows; ${rows.length - inserted} already present; ${withFeedUrl}/${rows.length} had a derived feedUrl.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
