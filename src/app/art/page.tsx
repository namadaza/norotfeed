import type { Metadata } from "next";

import PublicFeedPage from "@/components/public-feed-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Art · No Rot Feed",
  description: "A public art feed built from WikiArt entries.",
};

export default function ArtPage() {
  return <PublicFeedPage contentType="art" welcomeVariant="art" />;
}
