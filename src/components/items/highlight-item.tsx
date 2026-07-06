import type { FeedItem } from "@/lib/types";
import { Expandable } from "./expandable";
import { GoogleSearchLink } from "./google-search";
import { FEED_ITEM_BODY_TEXT_CLASSNAME } from "./styles";

type Props = { item: Extract<FeedItem, { type: "highlight" }> };

export function HighlightItem({ item }: Props) {
  const searchText = [item.title, item.text].filter(Boolean).join(" · ");
  const byline = item.author?.trim();
  const reference = item.reference?.trim();
  const url = item.url?.trim();
  const meta = [byline, reference].filter(Boolean).join(" · ");

  return (
    <article className="px-4 py-8">
      <div className="mb-4 font-serif text-sm uppercase tracking-[0.18em] text-muted-foreground">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </div>
      <Expandable collapsedMaxHeight={360}>
        <div
          className={`${FEED_ITEM_BODY_TEXT_CLASSNAME} whitespace-pre-wrap`}
        >
          {item.text}
        </div>
      </Expandable>
      <div className="mt-5 font-serif text-sm text-muted-foreground">
        <span>From Highlights</span>
        {meta && (
          <>
            <span className="mx-2">·</span>
            <span>{meta}</span>
          </>
        )}
        <span className="mx-2">·</span>
        <GoogleSearchLink text={searchText} />
      </div>
    </article>
  );
}
