# AGENTS.md

- Use `pnpm` scripts here. The repo scripts are defined in `package.json`.
- For local development, run `pnpm dev`.
- To inspect workflow runs, run `pnpm workflows`.
- Main app code lives under `src/app`, `src/components`, and `src/lib`; ingest and regeneration scripts live under `scripts`.
- Treat `src/lib/data/**` as generated output. Do not hand-edit `external-feed.json`, `wikiart_artworks.json`, or `books/koreader-generated/*.json`.
- Regenerate data with the matching script: `pnpm run ingest` fetches RSS and writes rows into the `content` table (type=`rss`) and also refreshes `src/lib/data/external-feed.json` as a snapshot; `pnpm run ingest:wikiart` rewrites `src/lib/data/wikiart_artworks.json` and needs `BLOB_READ_WRITE_TOKEN`, `WIKIART_ACCESS_KEY`, and `WIKIART_SECRET_KEY`.
- Feed content (artwork, books, rss, highlights) lives in the `content` table (`src/lib/db/schema.ts`); query and insert helpers are in `src/lib/db/content.ts`. Backfill from the JSON sources into the DB with `pnpm run backfill:artwork` (from `wikiart_artworks.json`), `pnpm run backfill:books` (default books under `src/lib/data/books`), and `pnpm run backfill:rss` (from `external-feed.json`, deriving `feedUrl` from `scripts/rss-follows.ts`). All are idempotent (`on conflict do nothing` on `content.id`).
- `src/app/page.tsx` is `force-dynamic`, so homepage changes can depend on fresh data on every request.
- The feed renders from the `content` table. Server actions in `src/app/actions.ts` query the DB (via `src/lib/db/content.ts`), apply the seeded weighted ordering, and cache loaded items per user filter and options. The client (`src/components/feed.tsx`) paginates with `useInfiniteQuery`.
- Prefer React Query for client-side auth and other server-state: use `useQuery` for reads, `useMutation` for writes, and add shared query key objects in `src/lib/consts.ts`.
- For focused checks, use `pnpm test -- <file>` for one test file, `pnpm lint`, and `pnpm exec tsc --noEmit`.
- Do not run `pnpm build` unless the user explicitly asks.
- Do not start a local dev server unless the user asks; UI changes should be reviewed in the already-running app via `agent-browser`.

## Architecture Snapshot

- Next.js App Router frontend with server actions for feed loading and user state.
- Drizzle-backed Postgres schema for users, sessions, and feed content.
- Generated content snapshots under `src/lib/data/**`, with scripts that ingest and backfill them into the database.
