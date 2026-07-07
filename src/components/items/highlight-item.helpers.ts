import type { FeedItem } from "@/lib/types";

type HighlightItem = Extract<FeedItem, { type: "highlight" }>;

export function buildHighlightSearchText(item: HighlightItem): string {
  const title = item.title.trim();
  const text = item.text.trim();
  const author = item.author?.trim();
  const source = item.source?.trim();
  const reference = item.reference?.trim();

  return [
    title,
    text,
    author ? `Author: ${author}` : null,
    source ? `Source: ${source}` : null,
    reference ? `Location: ${reference}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default null;
