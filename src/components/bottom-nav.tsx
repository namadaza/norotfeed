"use client";

import { useState } from "react";
import { BookOpenText, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { SettingsDialog, type SectionId } from "@/components/settings-dialog";
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
  const isAuthed = !!sessionQuery.data?.user;

  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SectionId>("feed");

  function openSettings(section: SectionId) {
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  function handleAccountClick() {
    if (isAuthed) {
      openSettings("account");
    } else {
      setAuthOpen(true);
    }
  }

  function handleRequestSignIn() {
    setSettingsOpen(false);
    setAuthOpen(true);
  }

  return (
    <>
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        initialSession={sessionQuery.data}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
        books={books}
        highlights={highlights}
        feedOptions={feedOptions}
        onFeedOptionsChange={onFeedOptionsChange}
        initialSession={sessionQuery.data}
        onRequestSignIn={handleRequestSignIn}
      />

      <div className="sticky bottom-0 z-10 border-t border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex items-center justify-between px-4 py-3">
          <div className="rounded-full border border-border p-2 text-foreground">
            <BookOpenText className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => openSettings("feed")}
            >
              <SlidersHorizontal className="size-4" />
              Feed Options
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={handleAccountClick}
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
