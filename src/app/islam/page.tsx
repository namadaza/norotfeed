import type { Metadata } from "next";

import PublicFeedPage from "@/components/public-feed-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Islam · No Rot Feed",
  description: "A public Islam feed with Quran, hadith, and book highlights.",
};

export default function IslamPage() {
  return <PublicFeedPage contentType="islam" welcomeVariant="islam" />;
}
