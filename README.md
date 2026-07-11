# No Rot Feed

![Gardens of the Generalife by Santiago Rusiñol](https://veuua6kvxrbip1i0.public.blob.vercel-storage.com/better-twitter/artwork/images/wikiart/santiago-rusinol/Gardens_of_the_Generalife.jpg)

No Rot Feed is a Next.js feed app that mixes artwork, books, RSS, and user highlights from a shared database-backed content model.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

To inspect workflow runs, run:

```bash
pnpm workflows
```

## Scripts

- `pnpm dev` - start the app locally
- `pnpm workflows` - open the workflow viewer
- `pnpm lint` - run linting
- `pnpm test` - run the test suite
- `pnpm exec tsc --noEmit` - typecheck
- `pnpm run ingest` - fetch RSS and refresh the RSS snapshot
- `pnpm run ingest:wikiart` - refresh wikiart artwork data
- `pnpm run backfill:artwork` - load artwork rows into the database
- `pnpm run backfill:books` - load book rows into the database
- `pnpm run backfill:rss` - load RSS rows into the database

## Workflows

The refresh workflow updates feed content in the `content` table.

- Run `pnpm workflows` to open the workflow viewer and inspect runs.
- Use `pnpm run trigger:refresh-feed` to manually trigger the refresh workflow against a local app.
- The workflow is also exposed at `/api/refresh-feed` and can be called by an external scheduler or cron job.
- If `CRON_SECRET` is set, the refresh endpoint requires `Authorization: Bearer <secret>`.
- On each run, the workflow ingests default RSS and WikiArt content, then refreshes per-user RSS feeds and artist subscriptions from the `user` table.

## Architecture

- The app uses the Next.js App Router.
- `src/app/page.tsx` renders the homepage dynamically and fetches the first feed page plus the current session.
- `src/app/actions.ts` is the main server-side feed layer: it loads content, applies ordering, and serves paginated results.
- `src/components/feed.tsx` is the client feed view and uses React Query for infinite scrolling.
- `src/lib/db/content.ts` contains the database helpers for loading and inserting feed content.
- `src/lib/db/schema.ts` defines the Drizzle schema for `user`, `session`, `account`, `verification`, and `content`.
- Auth uses Better Auth with the Drizzle adapter in `src/lib/auth.ts`; the client helper lives in `src/lib/auth-client.ts`.
- `src/lib/data/**` contains generated content snapshots and should not be edited by hand.

## Environment

The app expects a database connection via `DATABASE_URL`.

Some ingest scripts also require:

- `BLOB_READ_WRITE_TOKEN`
- `WIKIART_ACCESS_KEY`
- `WIKIART_SECRET_KEY`
