export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  user: {
    data: ["user", "data"] as const,
  },
  feed: {
    list: (seed: string, options: unknown, includeOnboarding = false) =>
      ["feed", seed, options ?? "default", includeOnboarding] as const,
    bookTitles: ["feed", "book-titles"] as const,
    globalRssFeeds: ["feed", "global-rss-feeds"] as const,
    globalArtists: ["feed", "global-artists"] as const,
  },
  highlights: {
    list: ["highlights", "list"] as const,
  },
} as const;
