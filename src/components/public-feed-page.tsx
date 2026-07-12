import { randomUUID } from "crypto";

import { getFeedItemsPage } from "@/app/actions";
import { Feed } from "@/components/feed";
import { getWelcomeOnboardingItem, type OnboardingFeedItem } from "@/lib/onboarding";
import type { FeedOptions } from "@/lib/types";

type PublicFeedPageProps = {
  contentType: Extract<FeedOptions["contentType"], "art" | "islam">;
  welcomeVariant: Extract<FeedOptions["contentType"], "art" | "islam">;
};

export default async function PublicFeedPage({ contentType, welcomeVariant }: PublicFeedPageProps) {
  const feedSeed = randomUUID();
  const feedOptions: FeedOptions = { contentType };
  const welcomeOnboardingItem: OnboardingFeedItem = getWelcomeOnboardingItem(
    welcomeVariant,
    `/${contentType}`,
  );
  const initialItems = await getFeedItemsPage(0, 30, feedSeed, feedOptions, true);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Feed
        initialItems={initialItems}
        seed={feedSeed}
        options={feedOptions}
        showWelcomeOnboarding
        includeOnboarding
        welcomeOnboardingItem={welcomeOnboardingItem}
      />
    </div>
  );
}
