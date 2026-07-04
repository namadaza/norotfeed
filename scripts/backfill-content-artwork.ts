#!/usr/bin/env node
// Backfill WikiArt artworks from src/lib/data/wikiart_artworks.json into the
// `content` table as type='artwork' rows with no user_id (global default).
// Idempotent: re-running skips rows whose id already exists.

import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env.local" });

import { readFile } from "fs/promises";
import { join } from "path";
import { content, type ArtworkContent } from "@/lib/db/schema";

const IN_PATH = join(
  process.cwd(),
  "src",
  "lib",
  "data",
  "wikiart_artworks.json",
);

type Manifest = {
  items?: ArtworkContent[];
};

const BATCH_SIZE = 100;

async function main() {
  const { db } = await import("@/lib/db/client");
  const raw = await readFile(IN_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Manifest;
  const items = parsed.items ?? [];
  if (items.length === 0) {
    console.log("No artwork items found in manifest; exiting.");
    return;
  }

  console.log(`Loaded ${items.length} artwork items from ${IN_PATH}`);

  let inserted = 0;
  let skipped = 0;
  let missingTitle = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const rows = batch
      .map((item) => {
        const id = item.id;
        if (!id) return null;
        const title = (item.topic ?? item.artist ?? "").trim();
        if (!title) {
          missingTitle++;
          return null;
        }
        return {
          id,
          type: "artwork" as const,
          title,
          data: item,
          userId: null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) continue;

    const returned = await db
      .insert(content)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: content.id });
    inserted += returned.length;
    skipped += rows.length - returned.length;
  }

  console.log(
    `Inserted ${inserted} artwork rows; skipped ${skipped} (already present); ${missingTitle} had no title.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
