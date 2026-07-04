import { pgTable, pgEnum, text, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";

export type UserData = {
  artists: string[];
  rssFeeds: string[];
  hiddenArtists: string[];
  hiddenRssFeeds: string[];
  hiddenBooks: string[];
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  data: jsonb("data").$type<UserData>().notNull().default({
    artists: [],
    rssFeeds: [],
    hiddenArtists: [],
    hiddenRssFeeds: [],
    hiddenBooks: [],
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  deletedAt: timestamp("deleted_at"),
});
export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export type ArtworkContent = {
  id?: string;
  title?: string;
  artist?: string;
  year?: number | string | null;
  license_name?: string;
  license_url?: string;
  thumbnail_url?: string;
  full_image_url?: string | null;
  source_file_page?: string;
  genres?: string[];
  doNotRender?: boolean;
  raw_extmetadata?: {
    completitionYear?: number | string | null;
    [key: string]: unknown;
  };
  topic?: string;
  blob_path?: string;
  fetched_at?: string;
  fingerprint_sha256?: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
};

export type RssContent = {
  title: string;
  url: string;
  publication: string;
  author?: string;
  excerpt?: string;
  publishedAt?: string;
  feedUrl?: string;
};

export type HighlightContent = {
  text: string;
};

export type BookContent = {
  format: "poem" | "prose";
  body: string;
  title?: string;
  author?: string;
  book: string;
  source?: string;
  reference?: string;
  url?: string;
  secondaryText?: string;
};

export type ContentData = ArtworkContent | RssContent | HighlightContent | BookContent;

export const contentTypeEnum = pgEnum("content_type", ["artwork", "rss", "highlight", "book"]);

export const content = pgTable(
  "content",
  {
    id: text("id").primaryKey(),
    type: contentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    data: jsonb("data").$type<ContentData>().notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("content_type_idx").on(table.type),
    index("content_userId_idx").on(table.userId),
    index("content_title_idx").on(table.title),
    index("content_type_title_idx").on(table.type, table.title),
  ],
);
export type Content = typeof content.$inferSelect;
export type ContentInsert = typeof content.$inferInsert;

