#!/usr/bin/env node
// Trigger the refresh-feed workflow by calling the local API endpoint.
// Usage: pnpm run trigger:refresh-feed
// Override the target with REFRESH_FEED_URL (defaults to http://localhost:3000/api/refresh-feed).

import dotenv from "dotenv";
dotenv.config({ path: process.env.DOTENV_PATH || ".env.local" });

const URL =
  process.env.REFRESH_FEED_URL ?? "http://localhost:3000/api/refresh-feed";
const SECRET = process.env.CRON_SECRET;

async function main() {
  const headers: Record<string, string> = {};
  if (SECRET) headers.authorization = `Bearer ${SECRET}`;

  console.log(`POST ${URL}`);
  const res = await fetch(URL, { method: "POST", headers });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Failed: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }
  console.log(`OK ${res.status}: ${body}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
