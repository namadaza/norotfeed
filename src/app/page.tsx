import { randomUUID } from "crypto";
import { getFeedItemsPage } from "@/app/actions";
import { HomeFeed } from "@/components/home-feed";
import { getUserSession } from "@/lib/db/user";

// Force dynamic rendering to ensure fresh feed data on every page load.
export const dynamic = "force-dynamic";

export default async function Home() {
  const feedSeed = randomUUID();
  const [initialItems, initialSession] = await Promise.all([
    getFeedItemsPage(0, 30, feedSeed),
    getUserSession(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HomeFeed
        initialItems={initialItems}
        initialSeed={feedSeed}
        initialSession={initialSession}
      />

      {/* Mobile responsiveness: Add bottom padding for bottom nav */}
      <div className="h-16 md:h-0"></div>
    </div>
  );
}
