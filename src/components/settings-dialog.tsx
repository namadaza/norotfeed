"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Menu,
  Palette,
  Plus,
  Rss,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/consts";
import { cn } from "@/lib/utils";
import type { getUserSession } from "@/lib/db/user";
import type { UserData } from "@/lib/db/schema";
import type { FeedOptions } from "@/lib/types";
import {
  addArtistAction,
  addRssFeedAction,
  fetchUserData,
  removeArtistAction,
  removeRssFeedAction,
} from "@/app/user-actions";
import { getBookTitlesAction, getGlobalArtistsAction, getGlobalRssFeedsAction } from "@/app/actions";

type Session = Awaited<ReturnType<typeof getUserSession>>;

type BookOption = {
  slug: string;
  title: string;
  author?: string;
};

export type SectionId = "feed" | "rss" | "artists" | "books" | "account";

type ContentType = "default" | FeedOptions["contentType"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SectionId;
  feedOptions: FeedOptions | null;
  onFeedOptionsChange: (options: FeedOptions | null) => void;
  initialSession: Session;
  onRequestSignIn: () => void;
};

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Rss }> = [
  { id: "feed", label: "Feed", icon: SlidersHorizontal },
  { id: "rss", label: "RSS", icon: Rss },
  { id: "artists", label: "Artists", icon: Palette },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "account", label: "Account", icon: UserRound },
];

const contentTypeDescriptions: Record<ContentType, string> = {
  default: "Show the normal mixed feed with the existing weighted ordering.",
  "book-highlights": "Show highlights from one selected book.",
  rss: "Show RSS items in chronological or random order.",
  art: "Show a randomized feed of WikiArt entries.",
  islam: "Show a randomized feed of Quran, hadith, and selected Islamic book highlights.",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettifySlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection = "feed",
  feedOptions,
  onFeedOptionsChange,
  initialSession,
  onRequestSignIn,
}: Props) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data ?? null;
    },
    initialData: initialSession,
  });
  const user = sessionQuery.data?.user ?? null;

  const userDataQuery = useQuery({
    queryKey: queryKeys.user.data,
    queryFn: () => fetchUserData(),
    enabled: !!user && open,
  });
  const userData: UserData | null = userDataQuery.data ?? null;

  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [contentType, setContentType] = useState<ContentType>(
    feedOptions?.contentType ?? "default",
  );
  const [selectedBookTitle, setSelectedBookTitle] = useState(
    feedOptions?.contentType === "book-highlights" ? feedOptions.bookTitle : "",
  );
  const [bookOrder, setBookOrder] = useState<"random" | "in-order">(
    feedOptions?.contentType === "book-highlights" ? feedOptions.bookOrder : "random",
  );
  const [rssOrder, setRssOrder] = useState<"chronological" | "random">(
    feedOptions?.contentType === "rss" ? feedOptions.rssOrder : "chronological",
  );

  const bookTitlesQuery = useQuery({
    queryKey: queryKeys.feed.bookTitles,
    queryFn: getBookTitlesAction,
  });

  const allBooks = useMemo<BookOption[]>(() => {
    const titles = bookTitlesQuery.data ?? [];
    return titles
      .map((entry) => ({ slug: slugify(entry.title), title: entry.title, author: entry.author }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [bookTitlesQuery.data]);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
    setMobileNavOpen(false);
    setContentType(feedOptions?.contentType ?? "default");
    setSelectedBookTitle(
      feedOptions?.contentType === "book-highlights" ? feedOptions.bookTitle : "",
    );
    setBookOrder(feedOptions?.contentType === "book-highlights" ? feedOptions.bookOrder : "random");
    setRssOrder(feedOptions?.contentType === "rss" ? feedOptions.rssOrder : "chronological");
  }, [feedOptions, initialSection, open]);

  useEffect(() => {
    if (allBooks.length > 0 && !allBooks.some((book) => book.title === selectedBookTitle)) {
      setSelectedBookTitle(allBooks[0].title);
    }
  }, [allBooks, selectedBookTitle]);

  function selectSection(section: SectionId) {
    setActiveSection(section);
    setMobileNavOpen(false);
  }

  function applyFeedOptions() {
    if (contentType === "default") {
      onFeedOptionsChange(null);
      onOpenChange(false);
      return;
    }

    if (contentType === "rss") {
      onFeedOptionsChange({ contentType, rssOrder });
      onOpenChange(false);
      return;
    }

    if (contentType === "art") {
      onFeedOptionsChange({ contentType });
      onOpenChange(false);
      return;
    }

    if (contentType === "islam") {
      onFeedOptionsChange({ contentType });
      onOpenChange(false);
      return;
    }

    if (!selectedBookTitle) return;
    onFeedOptionsChange({
      contentType,
      bookTitle: selectedBookTitle,
      bookOrder,
    });
    onOpenChange(false);
  }

  const activeLabel = SECTIONS.find((section) => section.id === activeSection)?.label ?? "Settings";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex gap-0 overflow-hidden p-0 sm:max-w-2xl max-h-[90vh] w-[min(90vw,48rem)]"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your feed, RSS subscriptions, artists, books, and account.
        </DialogDescription>

        <div className="flex min-h-[26rem] w-full flex-col sm:flex-row">
          <aside
            className={cn(
              "shrink-0 border-border sm:w-52 sm:border-r",
              mobileNavOpen ? "block border-b" : "hidden sm:block",
            )}
          >
            <nav className="flex flex-col gap-1 p-3">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => selectSection(section.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-left transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-border p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="sm:hidden"
                  onClick={() => setMobileNavOpen((value) => !value)}
                  aria-label="Toggle settings menu"
                >
                  <Menu className="size-4" />
                </Button>
                <span className="font-serif text-base">{activeLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden"
                aria-label="Close settings"
              >
                <span className="sr-only">Close</span>
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {activeSection === "feed" && (
                <FeedSection
                  allBooks={allBooks}
                  contentType={contentType}
                  selectedBookTitle={selectedBookTitle}
                  bookOrder={bookOrder}
                  rssOrder={rssOrder}
                  onContentTypeChange={setContentType}
                  onSelectedBookTitleChange={setSelectedBookTitle}
                  onBookOrderChange={setBookOrder}
                  onRssOrderChange={setRssOrder}
                  onApply={applyFeedOptions}
                />
              )}

              {activeSection === "rss" && (
                <RssSection
                  userData={userData}
                  isLoading={userDataQuery.isLoading}
                  isAuthed={!!user}
                  onRequestSignIn={onRequestSignIn}
                />
              )}

              {activeSection === "artists" && (
                <ArtistsSection
                  userData={userData}
                  isLoading={userDataQuery.isLoading}
                  isAuthed={!!user}
                  onRequestSignIn={onRequestSignIn}
                />
              )}

              {activeSection === "books" && (
                <BooksSection
                  allBooks={allBooks}
                  isLoading={bookTitlesQuery.isLoading}
                  onRequestSignIn={onRequestSignIn}
                />
              )}

              {activeSection === "account" && (
                <AccountSection
                  user={user}
                  isAuthed={!!user}
                  onRequestSignIn={onRequestSignIn}
                  onSignedOut={() => {
                    void queryClient.invalidateQueries({
                      queryKey: queryKeys.user.data,
                    });
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FeedSectionProps = {
  allBooks: BookOption[];
  contentType: ContentType;
  selectedBookTitle: string;
  bookOrder: "random" | "in-order";
  rssOrder: "chronological" | "random";
  onContentTypeChange: (value: ContentType) => void;
  onSelectedBookTitleChange: (value: string) => void;
  onBookOrderChange: (value: "random" | "in-order") => void;
  onRssOrderChange: (value: "chronological" | "random") => void;
  onApply: () => void;
};

function FeedSection({
  allBooks,
  contentType,
  selectedBookTitle,
  bookOrder,
  rssOrder,
  onContentTypeChange,
  onSelectedBookTitleChange,
  onBookOrderChange,
  onRssOrderChange,
  onApply,
}: FeedSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Feed</h3>
        <p className="text-sm text-muted-foreground">
          Choose what kind of content should appear in the feed.
        </p>
      </div>

      <label className="grid min-w-0 gap-2 text-base">
        <span className="font-medium">Content type</span>
        <p className="text-sm text-muted-foreground pb-1">{contentTypeDescriptions[contentType]}</p>
        <select
          className="h-11 w-full min-w-0 max-w-full rounded-md border border-border bg-background px-3 text-base outline-none"
          value={contentType}
          onChange={(event) => onContentTypeChange(event.target.value as ContentType)}
        >
          <option value="default">Default</option>
          <option value="book-highlights">Book Highlights</option>
          <option value="rss">RSS</option>
          <option value="art">Art</option>
          <option value="islam">Islam</option>
        </select>
      </label>

      {contentType === "book-highlights" && (
        <>
          <label className="grid min-w-0 gap-2 text-base">
            <span className="font-medium">Book</span>
            <select
              className="h-11 w-full min-w-0 max-w-full rounded-md border border-border bg-background px-3 text-base outline-none"
              value={selectedBookTitle}
              onChange={(event) => onSelectedBookTitleChange(event.target.value)}
              disabled={allBooks.length === 0}
            >
              {allBooks.map((book) => (
                <option key={book.slug} value={book.title}>
                  {book.title}
                  {book.author ? ` · ${book.author}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-2 text-base">
            <span className="font-medium">Order</span>
            <select
              className="h-11 w-full min-w-0 max-w-full rounded-md border border-border bg-background px-3 text-base outline-none"
              value={bookOrder}
              onChange={(event) => onBookOrderChange(event.target.value as "random" | "in-order")}
            >
              <option value="random">Random</option>
              <option value="in-order">In Order</option>
            </select>
          </label>
        </>
      )}

      {contentType === "rss" && (
        <label className="grid min-w-0 gap-2 text-base">
          <span className="font-medium">Order</span>
          <select
            className="h-11 w-full min-w-0 max-w-full rounded-md border border-border bg-background px-3 text-base outline-none"
            value={rssOrder}
            onChange={(event) => onRssOrderChange(event.target.value as "chronological" | "random")}
          >
            <option value="chronological">Chronological</option>
            <option value="random">Random Order</option>
          </select>
        </label>
      )}

      <div className="grid min-w-0 gap-2 text-base">
        <span className="font-medium">Theme</span>
        <ThemeToggle />
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onApply}
          disabled={contentType === "book-highlights" && allBooks.length === 0}
        >
          Apply to Feed
        </Button>
      </div>
    </div>
  );
}

type AuthGateProps = {
  isAuthed: boolean;
  isLoading: boolean;
  onRequestSignIn: () => void;
};

function SignInPrompt({
  message,
  onRequestSignIn,
}: {
  message: string;
  onRequestSignIn: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRequestSignIn}>Sign in</Button>
    </div>
  );
}

function RssSection({
  userData,
  isLoading,
  isAuthed,
  onRequestSignIn,
}: AuthGateProps & { userData: UserData | null }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");

  const globalFeedsQuery = useQuery({
    queryKey: queryKeys.feed.globalRssFeeds,
    queryFn: getGlobalRssFeedsAction,
    enabled: !isAuthed,
  });

  const addMutation = useMutation({
    mutationFn: (value: string) => addRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      setUrl("");
    },
  });
  const removeMutation = useMutation({
    mutationFn: (value: string) => removeRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  if (!isAuthed) {
    const feeds = globalFeedsQuery.data ?? [];
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-serif text-lg">RSS feeds</h3>
          <p className="text-sm text-muted-foreground">
            These default feeds appear in your feed. Sign in to customize.
          </p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {globalFeedsQuery.isLoading && feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading feeds…</p>
          ) : feeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default RSS feeds.</p>
          ) : (
            feeds.map((feed) => (
              <div
                key={feed.feedUrl}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <a
                  className="min-w-0 truncate text-sm underline hover:text-foreground"
                  href={feed.feedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {feed.publication}
                  <span className="ml-2 text-xs text-muted-foreground">{feed.feedUrl}</span>
                </a>
              </div>
            ))
          )}
        </div>

        <Button onClick={onRequestSignIn}>Sign in to customize</Button>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  }

  const feeds = userData?.rssFeeds ?? [];
  const error = addMutation.error ?? removeMutation.error;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">RSS feeds</h3>
        <p className="text-sm text-muted-foreground">
          Add a publication URL or a direct feed URL. The ingest script will append{" "}
          <code>/feed</code> when needed.
        </p>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
        <input
          type="url"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 outline-none"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com"
          required
        />
        <Button type="submit" disabled={addMutation.isPending}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
      )}

      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {isLoading && feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading feeds…</p>
        ) : feeds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No RSS feeds yet. Add one above.</p>
        ) : (
          feeds.map((feed) => (
            <div
              key={feed}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <a
                className="min-w-0 truncate text-sm underline hover:text-foreground"
                href={feed}
                target="_blank"
                rel="noopener noreferrer"
              >
                {feed}
              </a>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${feed}`}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(feed)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ArtistsSection({
  userData,
  isLoading,
  isAuthed,
  onRequestSignIn,
}: AuthGateProps & { userData: UserData | null }) {
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState("");

  const globalArtistsQuery = useQuery({
    queryKey: queryKeys.feed.globalArtists,
    queryFn: getGlobalArtistsAction,
    enabled: !isAuthed,
  });

  const addMutation = useMutation({
    mutationFn: (value: string) => addArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      setSlug("");
    },
  });
  const removeMutation = useMutation({
    mutationFn: (value: string) => removeArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  if (!isAuthed) {
    const artists = globalArtistsQuery.data ?? [];
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-serif text-lg">Artists</h3>
          <p className="text-sm text-muted-foreground">
            These default artists appear in your feed. Sign in to customize.
          </p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {globalArtistsQuery.isLoading && artists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading artists…</p>
          ) : artists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default artists.</p>
          ) : (
            artists.map((artist) => (
              <div
                key={artist}
                className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
              >
                <a
                  className="min-w-0 truncate text-sm underline hover:text-foreground"
                  href={`https://www.wikiart.org/en/${artist}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {prettifySlug(artist)}
                  <span className="ml-2 text-xs text-muted-foreground">{artist}</span>
                </a>
              </div>
            ))
          )}
        </div>

        <Button onClick={onRequestSignIn}>Sign in to customize</Button>
      </div>
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = slug.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  }

  const artists = userData?.artists ?? [];
  const error = addMutation.error ?? removeMutation.error;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Artists</h3>
        <p className="text-sm text-muted-foreground">
          Add a WikiArt artist slug (for example, <code>claude-monet</code>, view all artists{" "}
          <a
            className="underline inline-block pr-0.5"
            href="https://www.wikiart.org/en/artists-by-art-movement"
            target="_blank"
          >
            here
            <span className="inline-block pl-0.5">
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
          ).
        </p>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
        <input
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 outline-none"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="claude-monet"
          required
        />
        <Button type="submit" disabled={addMutation.isPending}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
      )}

      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {isLoading && artists.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading artists…</p>
        ) : artists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No artists yet. Add one above.</p>
        ) : (
          artists.map((artist) => (
            <div
              key={artist}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <a
                className="min-w-0 truncate text-sm underline hover:text-foreground"
                href={`https://www.wikiart.org/en/${artist}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {prettifySlug(artist)}
                <span className="ml-2 text-xs text-muted-foreground">{artist}</span>
              </a>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${artist}`}
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(artist)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BooksSection({
  allBooks,
  isLoading,
  onRequestSignIn,
}: {
  allBooks: BookOption[];
  isLoading: boolean;
  onRequestSignIn: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Books</h3>
        <p className="text-sm text-muted-foreground">
          These default books appear in your feed. Sign in to customize.
        </p>
      </div>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto">
        {isLoading && allBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading books…</p>
        ) : allBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No default books.</p>
        ) : (
          allBooks.map((book) => (
            <div
              key={book.slug}
              className="flex items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm">
                {book.title}
                {book.author ? (
                  <span className="ml-2 text-xs text-muted-foreground">{book.author}</span>
                ) : null}
              </span>
            </div>
          ))
        )}
      </div>

      <Button onClick={onRequestSignIn}>Sign in to customize</Button>
    </div>
  );
}

function AccountSection({
  user,
  isAuthed,
  onRequestSignIn,
  onSignedOut,
}: {
  user: NonNullable<Session>["user"] | null;
  isAuthed: boolean;
  onRequestSignIn: () => void;
  onSignedOut: () => void;
}) {
  const queryClient = useQueryClient();
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const response = await authClient.signOut();
      if (response.error) throw new Error(response.error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      onSignedOut();
    },
  });

  if (!isAuthed) {
    return (
      <SignInPrompt message="Sign in to manage your account." onRequestSignIn={onRequestSignIn} />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Account</h3>
        <p className="text-sm text-muted-foreground">You are signed in.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <div>
          <div className="font-medium">Name</div>
          <div className="text-muted-foreground">{user?.name || "Not set"}</div>
        </div>
        <div>
          <div className="font-medium">Email</div>
          <div className="text-muted-foreground">{user?.email}</div>
        </div>
      </div>

      {signOutMutation.error && (
        <p className="text-sm text-destructive">
          {signOutMutation.error instanceof Error
            ? signOutMutation.error.message
            : "Something went wrong."}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => signOutMutation.mutate()}
          disabled={signOutMutation.isPending}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}
