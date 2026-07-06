"use client";

import { useCallback, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { Feed } from "@/components/feed";
import type { getUserSession } from "@/lib/db/user";
import type { FeedItem, FeedOptions } from "@/lib/types";

type Props = {
  initialItems: FeedItem[];
  initialSeed: string;
  initialSession: Awaited<ReturnType<typeof getUserSession>>;
};

export function HomeFeed({ initialItems, initialSeed, initialSession }: Props) {
  const [feedOptions, setFeedOptions] = useState<FeedOptions | null>(null);
  const [seed, setSeed] = useState(initialSeed);

  const handleRefresh = useCallback(() => {
    setSeed(crypto.randomUUID());
    window.scrollTo(0, 0);
  }, []);

  const handleFeedOptionsChange = useCallback((options: FeedOptions | null) => {
    setFeedOptions(options);
    setSeed(crypto.randomUUID());
    window.scrollTo(0, 0);
  }, []);

  const isInitialSeed = seed === initialSeed;

  return (
    <>
      <Feed
        key={seed}
        initialItems={isInitialSeed ? initialItems : []}
        seed={seed}
        options={feedOptions}
      />
      <BottomNav
        feedOptions={feedOptions}
        onFeedOptionsChange={handleFeedOptionsChange}
        onRefresh={handleRefresh}
        initialSession={initialSession}
      />
    </>
  );
}
