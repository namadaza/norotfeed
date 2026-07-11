"use client";

import { useCallback, useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { FeedItem, FeedOptions } from "@/lib/types";
import { getFeedItemsPage } from "@/app/actions";
import { queryKeys } from "@/lib/consts";
import { HighlightItem } from "./items/highlight-item";
import { BookItem } from "./items/book-item";
import { RssItem } from "./items/rss-item";
import { ArtworkItem } from "./items/artwork-item";
import { OnboardingItem } from "./items/onboarding-item";
import { getWelcomeOnboardingItem, ONBOARDING_WELCOME_ID } from "@/lib/onboarding";

interface FeedProps {
  initialItems: FeedItem[];
  seed: string;
  options?: FeedOptions | null;
  showWelcomeOnboarding?: boolean;
}

const PAGE_SIZE = 30;

function renderItem(item: FeedItem) {
  switch (item.type) {
    case "highlight":
      return <HighlightItem item={item} />;
    case "book":
      return <BookItem item={item} />;
    case "rss":
      return <RssItem item={item} />;
    case "artwork":
      return <ArtworkItem art={item.data} />;
    case "onboarding":
      return <OnboardingItem item={item} />;
  }
}

export function Feed({ initialItems, seed, options, showWelcomeOnboarding }: FeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: queryKeys.feed.list(seed, options),
    queryFn: ({ pageParam }) =>
      getFeedItemsPage(pageParam, PAGE_SIZE, seed, options),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPageParam + PAGE_SIZE,
    initialData:
      initialItems.length > 0
        ? { pages: [initialItems], pageParams: [0] }
        : undefined,
  });

  const items = data?.pages.flat() ?? [];
  const visibleItems = showWelcomeOnboarding
    ? items.filter((item) => item.type !== "onboarding" || item.id !== ONBOARDING_WELCOME_ID)
    : items;

  const loadMore = useCallback(() => {
    if (isFetchingNextPage || !hasNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 1000
      ) {
        loadMore();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadMore]);

  const showInitialSpinner = isLoading && items.length === 0;

  return (
    <div className="max-w-2xl mx-auto pt-8 pb-24">
      {showWelcomeOnboarding && <OnboardingItem item={getWelcomeOnboardingItem()} />}
      {showInitialSpinner && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      )}
      {!showInitialSpinner && visibleItems.length === 0 && (
        <div className="px-4 py-16 text-center font-serif text-muted-foreground">
          No items yet.
        </div>
      )}
      {visibleItems.map((item, index) => (
        <div key={item.type === "onboarding" ? item.key : item.id}>
          {renderItem(item)}
          {index < visibleItems.length - 1 && (
            <div className="mx-4 border-t border-border/50" />
          )}
        </div>
      ))}
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
      )}
    </div>
  );
}
