import { put } from "@vercel/blob";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { content, type ArtworkContent } from "@/lib/db/schema";

const USER_AGENT =
  "norotfeed/ingest (https://norotfeed.vercel.app/; aman.s.azad@gmail.com)";
const WIKIART_BASE = "https://www.wikiart.org";
const WIKIART_IMAGE_FORMAT = "HD";

export function hasWikiArtEnv(): boolean {
  return Boolean(
    process.env.WIKIART_ACCESS_KEY && process.env.WIKIART_SECRET_KEY,
  );
}

export function hasBlobEnv(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeFileName(name: string) {
  return name.replace(/[\/\s]+/g, "_").replace(/[^a-zA-Z0-9_\-.,()]/g, "");
}

function sha256Hex(buf: Uint8Array) {
  return createHash("sha256").update(buf).digest("hex");
}

function paintingIdToContentId(paintingId: string, userId?: string | null): string {
  return userId ? `wikiart:${userId}:${paintingId}` : `wikiart:${paintingId}`;
}

async function wikiArtApi(
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${WIKIART_BASE}${pathname}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  url.searchParams.set("accessKey", process.env.WIKIART_ACCESS_KEY!);
  url.searchParams.set("secretKey", process.env.WIKIART_SECRET_KEY!);
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "X-Access-Key": process.env.WIKIART_ACCESS_KEY!,
    "X-Secret-Key": process.env.WIKIART_SECRET_KEY!,
  };
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`WikiArt API ${res.status} ${res.statusText}`);
  return res.json();
}

async function downloadBuffer(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`download failed ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function uploadToBlob(pathName: string, buffer: Buffer) {
  const res = await put(pathName, buffer, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });
  return res.url as string;
}

/**
 * Load all artwork rows from the DB, keyed by the WikiArt painting id
 * (`data.id` == `wikiart:<paintingId>`). Used to dedup across global and
 * user-scoped rows so we never re-download or re-upload an image we have.
 */
export async function getExistingArtwork(): Promise<{
  byPaintingId: Map<string, ArtworkContent>;
  fingerprints: Set<string>;
}> {
  const rows = await db
    .select({ data: content.data })
    .from(content)
    .where(eq(content.type, "artwork"));
  const byPaintingId = new Map<string, ArtworkContent>();
  const fingerprints = new Set<string>();
  for (const row of rows) {
    const data = row.data as ArtworkContent;
    if (data?.id) byPaintingId.set(data.id, data);
    if (data?.fingerprint_sha256) fingerprints.add(data.fingerprint_sha256);
  }
  return { byPaintingId, fingerprints };
}

type FetchOpts = {
  maxTotal: number;
  byPaintingId: Map<string, ArtworkContent>;
  fingerprints: Set<string>;
  /** When true, reused (already-in-DB) paintings are returned too, so the
   * caller can insert per-user copies. When false, only new paintings are
   * returned (used for the global default ingest). */
  includeExisting: boolean;
};

/**
 * Search WikiArt for one artist and return up to `maxTotal` artworks.
 * Paintings already in the DB are reused (no re-download/re-upload) when
 * `includeExisting` is set; brand-new paintings are downloaded and uploaded
 * to Vercel Blob. Newly fetched items are added to the provided maps so
 * subsequent calls within the same run reuse them.
 */
export async function fetchArtistArtwork(
  artistUrl: string,
  opts: FetchOpts,
): Promise<ArtworkContent[]> {
  const results: ArtworkContent[] = [];
  const term = artistUrl.replace(/-/g, " ");
  let paginationToken: string | undefined;

  try {
    do {
      const params: Record<string, string> = {
        term,
        imageFormat: WIKIART_IMAGE_FORMAT,
      };
      if (paginationToken) params.paginationToken = paginationToken;
      const resp = await wikiArtApi("/en/api/2/PaintingSearch", params);
      const data = resp?.data || [];
      paginationToken = resp?.paginationToken;
      shuffle(data);

      for (const p of data) {
        if (results.length >= opts.maxTotal) break;
        const artistMatch =
          (p.artistUrl && p.artistUrl === artistUrl) ||
          (p.artistName &&
            String(p.artistName).toLowerCase().includes(term.toLowerCase()));
        if (!artistMatch) continue;

        const paintingId = String(p.id);
        const candidateId = `wikiart:${paintingId}`;
        const existing = opts.byPaintingId.get(candidateId);
        if (existing) {
          if (opts.includeExisting) results.push(existing);
          continue;
        }

        try {
          const detail = await wikiArtApi("/en/api/2/Painting", {
            id: paintingId,
            imageFormat: WIKIART_IMAGE_FORMAT,
          });
          await sleep(300);
          const painting = detail?.data || detail || {};
          const imageUrl = painting.image || painting.imageUrl || null;
          if (!imageUrl) continue;

          const buffer = await downloadBuffer(imageUrl);
          const fingerprint = sha256Hex(buffer);
          if (opts.fingerprints.has(fingerprint)) continue;

          const safeName = sanitizeFileName(painting.title || paintingId);
          const ext = (imageUrl.split(".").pop() || "jpg").split("?")[0];
          const blobPath = `norotfeed/artwork/images/wikiart/${painting.artistUrl || artistUrl}/${safeName}.${ext}`;
          const blobUrl = await uploadToBlob(blobPath, buffer);

          const item: ArtworkContent = {
            id: candidateId,
            title: painting.title,
            artist: painting.artistName,
            year: painting.completitionYear || painting.year || null,
            genres: painting.genres || painting.styles || painting.tags || [],
            topic: artistUrl,
            blob_path: blobPath,
            thumbnail_url: blobUrl,
            full_image_url: imageUrl,
            source_file_page: `${WIKIART_BASE}/en/${painting.artistUrl}/${painting.url}`,
            license_name: "",
            license_url: "",
            fetched_at: new Date().toISOString(),
            fingerprint_sha256: fingerprint,
            raw_extmetadata: painting,
            width: painting.width || painting.sizeX || null,
            height: painting.height || painting.sizeY || null,
            mime: null,
          };
          results.push(item);
          opts.byPaintingId.set(candidateId, item);
          opts.fingerprints.add(fingerprint);
          await sleep(100);
        } catch (err) {
          console.warn(
            "WikiArt painting processing failed",
            (err as Error)?.message || err,
          );
        }
      }
      await sleep(300);
    } while (paginationToken && results.length < opts.maxTotal);
  } catch (err) {
    console.error(
      `Artist processing failed for ${artistUrl}`,
      (err as Error)?.message || err,
    );
  }
  return results;
}

/**
 * Insert artwork into the `content` table. When `userId` is set, the
 * `content.id` is scoped per-user (`wikiart:<userId>:<paintingId>`) while
 * `data.id` keeps the canonical WikiArt id. Idempotent on `content.id`.
 */
export async function insertArtworkItems(
  items: ArtworkContent[],
  userId: string | null,
): Promise<number> {
  if (items.length === 0) return 0;
  const rows = items
    .map((item) => {
      const paintingId = item.id?.replace(/^wikiart:/, "") ?? "";
      if (!paintingId || !item.id) return null;
      const title = (item.topic ?? item.artist ?? "").trim();
      if (!title) return null;
      return {
        id: paintingIdToContentId(paintingId, userId),
        type: "artwork" as const,
        title,
        data: item,
        userId,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

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
