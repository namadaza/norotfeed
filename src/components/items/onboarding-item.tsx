import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { FeedItem } from "@/lib/types";
import { Button } from "../ui/button";
import { FEED_ITEM_BODY_TEXT_CLASSNAME } from "./styles";

type Props = { item: Extract<FeedItem, { type: "onboarding" }> };

export function OnboardingItem({ item }: Props) {
  return (
    <article className="px-4 py-8">
      <div className="mb-4 font-serif text-sm uppercase tracking-[0.18em] text-muted-foreground">
        {item.eyebrow}
      </div>
      <h2 className={`${FEED_ITEM_BODY_TEXT_CLASSNAME} whitespace-pre-wrap`}>{item.title}</h2>
      <p className={`mt-4 max-w-xl whitespace-pre-wrap ${FEED_ITEM_BODY_TEXT_CLASSNAME}`}>
        {item.body}
      </p>
      <div className="mt-5 font-serif text-sm text-muted-foreground">
        <Button asChild variant="link" className="h-auto !p-0 text-inherit underline-offset-4">
          <Link href={item.ctaHref}>
            {item.ctaLabel}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
