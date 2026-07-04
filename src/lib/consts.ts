export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  user: {
    data: ["user", "data"] as const,
  },
  feed: {
    list: (seed: string, options: unknown) =>
      ["feed", seed, options ?? "default"] as const,
    bookTitles: ["feed", "book-titles"] as const,
  },
} as const;
