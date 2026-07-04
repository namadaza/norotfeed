export const queryKeys = {
  auth: {
    session: ["auth", "session"] as const,
  },
  user: {
    data: ["user", "data"] as const,
  },
} as const;
