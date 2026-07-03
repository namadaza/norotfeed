"use client";

import { useState } from "react";
import { BookOpenText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { FeedOptionsDialog } from "@/components/feed-options-dialog";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/consts";
import type { getUserSession } from "@/lib/db/user";
import type { FeedItem, FeedOptions } from "@/lib/types";
import type { KoreaderBook } from "@/lib/sources/koreader-generated";

type Props = {
  books: KoreaderBook[];
  highlights: Extract<FeedItem, { type: "highlight" }>[];
  feedOptions: FeedOptions | null;
  onFeedOptionsChange: (options: FeedOptions | null) => void;
  initialSession: Awaited<ReturnType<typeof getUserSession>>;
};

export function BottomNav({
  books,
  highlights,
  feedOptions,
  onFeedOptionsChange,
  initialSession,
}: Props) {
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data ?? null;
    },
    initialData: initialSession,
  });
  const userName = sessionQuery.data?.user?.name ?? null;
  const initial = userName?.trim().charAt(0).toUpperCase() || null;
  const [open, setOpen] = useState(false);

  return (
    <>
      <AuthDialog
        open={open}
        onOpenChange={setOpen}
        initialSession={sessionQuery.data}
      />

      <div className="sticky bottom-0 z-10 border-t border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex items-center justify-between px-4 py-3">
          <div className="rounded-full border border-border p-2 text-foreground">
            <BookOpenText className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <FeedOptionsDialog
              books={books}
              highlights={highlights}
              feedOptions={feedOptions}
              onFeedOptionsChange={onFeedOptionsChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setOpen(true)}
            >
              <span className="block">
                {initial ?? "Sign Up"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
