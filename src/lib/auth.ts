import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db/client";
import { account, session, user, verification } from "./db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account,
      session,
      user,
      verification,
    },
  }),
  baseURL: {
    allowedHosts: [
      "www.norotfeed.com",
      "norotfeed.com",
      "*.vercel.app",
      "localhost:3000",
      "localhost:3001",
    ],
    protocol: process.env.VERCEL_ENV === "development" ? "http" : "https",
  },
  emailAndPassword: {
    enabled: true,
  },
});
