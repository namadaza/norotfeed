#!/usr/bin/env node
// Fetch images from the WikiArt API, upload to Vercel Blob, and emit a JSON manifest.
// Simplified, wikiart-only version (Commons logic deprecated).

import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env.local" });

import fs from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import crypto from "crypto";
import { ARTIST_PAGES } from "@/lib/ingest/feeds";

type PutBodyLocal =
  | string
  | Uint8Array
  | Buffer
  | Blob
  | ReadableStream<any>
  | File;

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
if (!BLOB_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is required");
  process.exit(1);
}

const USER_AGENT =
  "norotfeed/ingest (https://norotfeed.vercel.app/; aman.s.azad@gmail.com)";
const MAX_TOTAL = 15;
const OUT_PATH = path.resolve("src/lib/data/wikiart_artworks.json");

const WIKIART_ACCESS = process.env.WIKIART_ACCESS_KEY;
const WIKIART_SECRET = process.env.WIKIART_SECRET_KEY;
if (!WIKIART_ACCESS || !WIKIART_SECRET) {
  console.error(
    "WIKIART_ACCESS_KEY and WIKIART_SECRET_KEY are required for this script",
  );
  process.exit(1);
}

const WIKIART_IMAGE_FORMAT = "HD";
const WIKIART_BASE = "https://www.wikiart.org";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffle<T>(a: T[]) {
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
  return crypto.createHash("sha256").update(buf).digest("hex");
}

async function wikiArtApi(
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${WIKIART_BASE}${pathname}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  // WIKIART_ACCESS and WIKIART_SECRET are validated at startup; assert non-null for TS
  url.searchParams.set("accessKey", WIKIART_ACCESS!);
  url.searchParams.set("secretKey", WIKIART_SECRET!);
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    "X-Access-Key": WIKIART_ACCESS!,
    "X-Secret-Key": WIKIART_SECRET!,
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

async function uploadToBlob(pathName: string, buffer: PutBodyLocal) {
  // @ts-ignore - allow passing our PutBodyLocal to put()
  const res = await put(pathName, buffer, {
    access: "public",
    token: BLOB_TOKEN,
  });
  return res.url as string;
}

async function run() {
  console.log("Starting fetch-wikiart-images run");
  // Allow selecting a specific artist via env or CLI:
  // - env: ARTIST or WIKIART_ARTIST
  // - cli: --artist=slug or --artist slug or positional first arg
  const rawArtistArg = (() => {
    if (process.env.ARTIST) return process.env.ARTIST;
    if (process.env.WIKIART_ARTIST) return process.env.WIKIART_ARTIST;
    const argv = process.argv.slice(2);
    let artist: string | undefined;
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a.startsWith("--artist=")) {
        artist = a.split("=")[1];
        break;
      }
      if (a === "--artist") {
        artist = argv[i + 1];
        break;
      }
      // treat first non-flag arg as artist
      if (!a.startsWith("-")) {
        artist = a;
        break;
      }
    }
    return artist;
  })();

  const artistArg = rawArtistArg ? String(rawArtistArg).trim() : undefined;
  if (artistArg) console.log(`Using artist argument: ${artistArg}`);
  const results: any[] = [];

  // Load previous manifest if exists to dedupe
  const previousFingerprints = new Set<string>();
  const previousIds = new Set<string>();
  let existingItems: any[] = [];
  try {
    const prev = await fs.readFile(OUT_PATH, "utf8");
    const parsed = JSON.parse(prev);
    existingItems = parsed.items || [];
    for (const it of existingItems) {
      if (it.fingerprint_sha256)
        previousFingerprints.add(it.fingerprint_sha256);
      if (it.id) previousIds.add(it.id);
    }
  } catch (e) {
    // ignore
  }

  // Always use WikiArt for this script. If an artistArg is provided prefer it.
  // Accept either slugs like "claude-monet" or human names like "Claude Monet".
  const artists = (() => {
    if (!artistArg) return shuffle(ARTIST_PAGES.slice());
    // convert human name to slug-ish form if necessary
    let slug = String(artistArg).toLowerCase().trim();
    // if contains spaces, convert to dashed slug
    if (slug.includes(" ")) slug = slug.replace(/[\s]+/g, "-");
    // remove leading/trailing slashes
    slug = slug.replace(/^\/+|\/+$/g, "");
    return [slug];
  })();
  for (const artistUrl of artists) {
    if (results.length >= MAX_TOTAL) break;
    console.log(`Processing artist ${artistUrl}`);
    let paginationToken: string | undefined = undefined;
    try {
      const term = artistUrl.replace(/-/g, " ");
      do {
        const params: any = { term, imageFormat: WIKIART_IMAGE_FORMAT };
        if (paginationToken) params.paginationToken = paginationToken;
        const resp = await wikiArtApi("/en/api/2/PaintingSearch", params);
        const data = resp?.data || [];
        console.log(
          `PaintingSearch returned ${data.length} items for artist term "${term}"`,
        );
        paginationToken = resp?.paginationToken;
        shuffle(data);
        for (const p of data) {
          if (results.length >= MAX_TOTAL) break;
          const artistMatch =
            (p.artistUrl && p.artistUrl === artistUrl) ||
            (p.artistName &&
              String(p.artistName).toLowerCase().includes(term.toLowerCase()));
          if (!artistMatch) continue;
          const paintingId = String(p.id);
          const candidateId = `wikiart:${paintingId}`;
          if (previousIds.has(candidateId)) continue;
          try {
            const detail = await wikiArtApi("/en/api/2/Painting", {
              id: paintingId,
              imageFormat: WIKIART_IMAGE_FORMAT,
            });
            await sleep(300);
            const painting = detail?.data || detail || {};
            const imageUrl = painting.image || painting.imageUrl || null;
            if (!imageUrl) continue;
            console.log(
              `Downloading WikiArt image ${painting.title} from ${imageUrl}`,
            );
            const buffer = await downloadBuffer(imageUrl);
            const fingerprint = sha256Hex(buffer);
            if (previousFingerprints.has(fingerprint)) continue;
            const safeName = sanitizeFileName(painting.title || paintingId);
            const ext = (imageUrl.split(".").pop() || "jpg").split("?")[0];
            const blobPath = `norotfeed/artwork/images/wikiart/${painting.artistUrl || artistUrl}/${safeName}.${ext}`;
            console.log(
              `Uploading WikiArt painting ${painting.title} -> ${blobPath}`,
            );
            const blobUrl = await uploadToBlob(blobPath, buffer);
            const item = {
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
            previousIds.add(candidateId);
            previousFingerprints.add(fingerprint);
            await sleep(100);
          } catch (err: any) {
            console.warn(
              "WikiArt painting processing failed",
              err.message || err,
            );
          }
        }
        await sleep(300);
      } while (paginationToken && results.length < MAX_TOTAL);
    } catch (err: any) {
      console.error(
        `Artist processing failed for ${artistUrl}`,
        err.message || err,
      );
    }
  }

  if (results.length === 0) {
    console.log("No new paintings found. Exiting.");
    return;
  }

  const newItems = results.slice(0, MAX_TOTAL);
  const combined = [...existingItems, ...newItems];
  const byId = new Map<string, any>();
  for (const it of combined) {
    if (it && it.id) byId.set(it.id, it);
  }
  const finalItems = Array.from(byId.values());
  const manifest = {
    generated_at: new Date().toISOString(),
    source: "wikiart",
    count: finalItems.length,
    items: finalItems,
  };
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `Appended ${newItems.length} new items; manifest now has ${finalItems.length} items at ${OUT_PATH}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
