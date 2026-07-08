"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ProfileCropModal } from "@/components/profile-crop-modal";
import type { CroppedImageResult } from "@/lib/crop-image";

import {
  BookOpen,
  Braces,
  ChevronDown,
  ClipboardCopy,
  Eye,
  EyeOff,
  Highlighter,
  Info,
  Lightbulb,
  Link as LinkIcon,
  Menu,
  Palette,
  Plus,
  Rss,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { uploadProfilePicture } from "@/app/profile-actions";
import { queryKeys } from "@/lib/consts";
import { HIGHLIGHTS_AI_PROMPT, HIGHLIGHTS_JSON_EXAMPLE } from "@/lib/highlights-prompt";
import { cn } from "@/lib/utils";
import type { getUserSession } from "@/lib/db/user";
import type { UserData } from "@/lib/db/schema";
import type { FeedOptions } from "@/lib/types";
import {
  addArtistAction,
  addRssFeedAction,
  addQuickHighlightAction,
  deleteAccountAction,
  deleteHighlightAction,
  deleteHighlightsByBookAction,
  fetchUserData,
  getUserHighlightsAction,
  hideDefaultArtistAction,
  hideDefaultBookAction,
  hideDefaultRssFeedAction,
  hideHighlightAction,
  removeArtistAction,
  removeRssFeedAction,
  unhideDefaultArtistAction,
  unhideDefaultBookAction,
  unhideDefaultRssFeedAction,
  unhideHighlightAction,
  uploadHighlightsAction,
} from "@/app/user-actions";
import {
  getBookTitlesAction,
  getGlobalArtistsAction,
  getGlobalRssFeedsAction,
} from "@/app/actions";

type Session = Awaited<ReturnType<typeof getUserSession>>;

type BookOption = {
  slug: string;
  title: string;
  author?: string;
};

export type SectionId = "feed" | "rss" | "artists" | "books" | "highlights" | "account" | "about";

type ContentType = "default" | FeedOptions["contentType"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: SectionId;
  feedOptions: FeedOptions | null;
  onFeedOptionsChange: (options: FeedOptions | null) => void;
  onFeedRefresh: () => void;
  initialSession: Session;
  onRequestSignIn: () => void;
};

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Rss }> = [
  { id: "feed", label: "Feed", icon: SlidersHorizontal },
  { id: "rss", label: "RSS", icon: Rss },
  { id: "artists", label: "Artists", icon: Palette },
  { id: "books", label: "Books", icon: BookOpen },
  { id: "highlights", label: "Highlights", icon: Highlighter },
  { id: "account", label: "Account", icon: UserRound },
  { id: "about", label: "About", icon: Info },
];

const contentTypeDescriptions: Record<ContentType, string> = {
  default: "Show the normal mixed feed with the existing weighted ordering.",
  highlights: "Show your custom highlights, optionally filtered by source.",
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
  onFeedRefresh,
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

  useEffect(() => {
    if (open && user) {
      void userDataQuery.refetch();
    }
  }, [open, user, userDataQuery]);

  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [contentType, setContentType] = useState<ContentType>(
    feedOptions?.contentType ?? "default",
  );
  const [selectedHighlightTitle, setSelectedHighlightTitle] = useState(
    feedOptions?.contentType === "highlights" ? (feedOptions.bookTitle ?? "") : "",
  );
  const [bookOrder, setBookOrder] = useState<"random" | "in-order">(
    feedOptions?.contentType === "highlights" ? feedOptions.bookOrder : "random",
  );
  const [rssOrder, setRssOrder] = useState<"chronological" | "random">(
    feedOptions?.contentType === "rss" ? feedOptions.rssOrder : "chronological",
  );

  const bookTitlesQuery = useQuery({
    queryKey: queryKeys.feed.bookTitles,
    queryFn: getBookTitlesAction,
  });

  const highlightsQuery = useQuery({
    queryKey: queryKeys.highlights.list,
    queryFn: getUserHighlightsAction,
    enabled: !!user,
  });

  const allBooks = useMemo<BookOption[]>(() => {
    const titles = bookTitlesQuery.data ?? [];
    return titles
      .map((entry) => ({ slug: slugify(entry.title), title: entry.title, author: entry.author }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [bookTitlesQuery.data]);

  const highlightTitles = useMemo<string[]>(() => {
    const rows = highlightsQuery.data ?? [];
    return Array.from(new Set(rows.map((row) => row.title))).sort((a, b) => a.localeCompare(b));
  }, [highlightsQuery.data]);

  useEffect(() => {
    if (!open) return;
    setActiveSection(initialSection);
    setMobileNavOpen(false);
    setContentType(feedOptions?.contentType ?? "default");
    setSelectedHighlightTitle(
      feedOptions?.contentType === "highlights" ? (feedOptions.bookTitle ?? "") : "",
    );
    setBookOrder(feedOptions?.contentType === "highlights" ? feedOptions.bookOrder : "random");
    setRssOrder(feedOptions?.contentType === "rss" ? feedOptions.rssOrder : "chronological");
  }, [feedOptions, initialSection, open]);

  useEffect(() => {
    if (
      highlightTitles.length > 0 &&
      selectedHighlightTitle &&
      !highlightTitles.includes(selectedHighlightTitle)
    ) {
      setSelectedHighlightTitle("");
    }
  }, [highlightTitles, selectedHighlightTitle]);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
    }
    prevOpenRef.current = open;
  }, [open, queryClient]);

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

    if (contentType === "highlights") {
      onFeedOptionsChange({
        contentType,
        bookTitle: selectedHighlightTitle || undefined,
        bookOrder,
      });
      onOpenChange(false);
      return;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex gap-0 overflow-hidden p-0 sm:max-w-2xl h-[min(90vh,38rem)] w-[min(90vw,48rem)]"
      >
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your feed, RSS subscriptions, artists, books, and account.
        </DialogDescription>

        <div className="flex h-full w-full flex-col sm:flex-row">
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="sm:hidden"
                  onClick={() => setMobileNavOpen((value) => !value)}
                  aria-label="Toggle settings menu"
                >
                  <Menu className="size-4" />
                </Button>
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

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {activeSection === "feed" && (
                <FeedSection
                  highlightTitles={highlightTitles}
                  highlightsLoading={highlightsQuery.isLoading}
                  isAuthed={!!user}
                  contentType={contentType}
                  selectedHighlightTitle={selectedHighlightTitle}
                  bookOrder={bookOrder}
                  rssOrder={rssOrder}
                  onContentTypeChange={setContentType}
                  onSelectedHighlightTitleChange={setSelectedHighlightTitle}
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
                  isAuthed={!!user}
                  userData={userData}
                  onRequestSignIn={onRequestSignIn}
                />
              )}

              {activeSection === "highlights" && (
                <HighlightsSection
                  userData={userData}
                  isAuthed={!!user}
                  onRequestSignIn={onRequestSignIn}
                  onFeedRefresh={() => {
                    onFeedRefresh();
                    onOpenChange(false);
                  }}
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

              {activeSection === "about" && <AboutSection />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type FeedSectionProps = {
  highlightTitles: string[];
  highlightsLoading: boolean;
  isAuthed: boolean;
  contentType: ContentType;
  selectedHighlightTitle: string;
  bookOrder: "random" | "in-order";
  rssOrder: "chronological" | "random";
  onContentTypeChange: (value: ContentType) => void;
  onSelectedHighlightTitleChange: (value: string) => void;
  onBookOrderChange: (value: "random" | "in-order") => void;
  onRssOrderChange: (value: "chronological" | "random") => void;
  onApply: () => void;
};

function FeedSection({
  highlightTitles,
  highlightsLoading,
  isAuthed,
  contentType,
  selectedHighlightTitle,
  bookOrder,
  rssOrder,
  onContentTypeChange,
  onSelectedHighlightTitleChange,
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
          <option value="highlights">Highlights</option>
          <option value="rss">RSS</option>
          <option value="art">Art</option>
          <option value="islam">Islam</option>
        </select>
      </label>

      {contentType === "highlights" && (
        <>
          <label className="grid min-w-0 gap-2 text-base">
            <span className="font-medium">Source</span>
            <select
              className="h-11 w-full min-w-0 max-w-full rounded-md border border-border bg-background px-3 text-base outline-none"
              value={selectedHighlightTitle}
              onChange={(event) => onSelectedHighlightTitleChange(event.target.value)}
              disabled={highlightTitles.length === 0}
            >
              <option value="">All highlights</option>
              {highlightTitles.map((title) => (
                <option key={title} value={title}>
                  {title}
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

          {!isAuthed ? (
            <p className="text-sm text-muted-foreground">Sign in to use your custom highlights.</p>
          ) : highlightsLoading && highlightTitles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading highlights…</p>
          ) : isAuthed && highlightTitles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No highlights yet. Add some in the Highlights tab.
            </p>
          ) : null}
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
        <Button onClick={onApply} disabled={contentType === "highlights" && !isAuthed}>
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
  heading = "Account",
  onRequestSignIn,
}: {
  message: string;
  heading?: string;
  onRequestSignIn: () => void;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-serif text-lg">{heading}</h3>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRequestSignIn}>Sign in</Button>
    </div>
  );
}

function HideToggleButton({
  hidden,
  hideLabel,
  showLabel,
  pending,
  onToggle,
}: {
  hidden: boolean;
  hideLabel: string;
  showLabel: string;
  pending: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={hidden ? showLabel : hideLabel}
      disabled={pending}
      onClick={onToggle}
    >
      {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  );
}

function DefaultsHeader() {
  return (
    <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground pb-2">
      Defaults
    </h4>
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
  });

  const addMutation = useMutation({
    mutationFn: (value: string) => addRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      setUrl("");
    },
  });
  const removeMutation = useMutation({
    mutationFn: (value: string) => removeRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });
  const hideMutation = useMutation({
    mutationFn: (value: string) => hideDefaultRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });
  const unhideMutation = useMutation({
    mutationFn: (value: string) => unhideDefaultRssFeedAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });

  const globalFeeds = globalFeedsQuery.data ?? [];
  const hiddenFeeds = userData?.hiddenRssFeeds ?? [];
  const togglePending = hideMutation.isPending || unhideMutation.isPending;

  if (!isAuthed) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-serif text-lg">RSS feeds</h3>
          <p className="text-sm text-muted-foreground">
            These default feeds appear in your feed. Sign up to customize.
          </p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {globalFeedsQuery.isLoading && globalFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading feeds…</p>
          ) : globalFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default RSS feeds.</p>
          ) : (
            globalFeeds.map((feed) => (
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

        <Button onClick={onRequestSignIn}>Sign up to customize</Button>
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

      <div className="max-h-[40vh] space-y-2 overflow-y-auto">
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

      <div className="border-t border-border pt-4">
        <DefaultsHeader />
        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
          {globalFeedsQuery.isLoading && globalFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading feeds…</p>
          ) : globalFeeds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default RSS feeds.</p>
          ) : (
            globalFeeds.map((feed) => {
              const hidden = hiddenFeeds.includes(feed.feedUrl);
              return (
                <div
                  key={feed.feedUrl}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2",
                    hidden && "opacity-50",
                  )}
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
                  <HideToggleButton
                    hidden={hidden}
                    hideLabel={`Hide ${feed.publication}`}
                    showLabel={`Show ${feed.publication}`}
                    pending={togglePending}
                    onToggle={() =>
                      hidden
                        ? unhideMutation.mutate(feed.feedUrl)
                        : hideMutation.mutate(feed.feedUrl)
                    }
                  />
                </div>
              );
            })
          )}
        </div>
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
  });

  const addMutation = useMutation({
    mutationFn: (value: string) => addArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      setSlug("");
    },
  });
  const removeMutation = useMutation({
    mutationFn: (value: string) => removeArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });
  const hideMutation = useMutation({
    mutationFn: (value: string) => hideDefaultArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });
  const unhideMutation = useMutation({
    mutationFn: (value: string) => unhideDefaultArtistAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });

  const globalArtists = globalArtistsQuery.data ?? [];
  const hiddenArtists = userData?.hiddenArtists ?? [];
  const togglePending = hideMutation.isPending || unhideMutation.isPending;

  if (!isAuthed) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-serif text-lg">Artists</h3>
          <p className="text-sm text-muted-foreground">
            These default artists appear in your feed. Sign up to customize.
          </p>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {globalArtistsQuery.isLoading && globalArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading artists…</p>
          ) : globalArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default artists.</p>
          ) : (
            globalArtists.map((artist) => (
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

        <Button onClick={onRequestSignIn}>Sign up to customize</Button>
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

      <div className="max-h-[40vh] space-y-2 overflow-y-auto">
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

      <div className="border-t border-border pt-4">
        <DefaultsHeader />
        <div className="max-h-[40vh] space-y-2 overflow-y-auto">
          {globalArtistsQuery.isLoading && globalArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading artists…</p>
          ) : globalArtists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No default artists.</p>
          ) : (
            globalArtists.map((artist) => {
              const hidden = hiddenArtists.includes(artist);
              return (
                <div
                  key={artist}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2",
                    hidden && "opacity-50",
                  )}
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
                  <HideToggleButton
                    hidden={hidden}
                    hideLabel={`Hide ${prettifySlug(artist)}`}
                    showLabel={`Show ${prettifySlug(artist)}`}
                    pending={togglePending}
                    onToggle={() =>
                      hidden ? unhideMutation.mutate(artist) : hideMutation.mutate(artist)
                    }
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function BooksSection({
  allBooks,
  isLoading,
  isAuthed,
  userData,
  onRequestSignIn,
}: {
  allBooks: BookOption[];
  isLoading: boolean;
  isAuthed: boolean;
  userData: UserData | null;
  onRequestSignIn: () => void;
}) {
  const queryClient = useQueryClient();
  const hideMutation = useMutation({
    mutationFn: (value: string) => hideDefaultBookAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });
  const unhideMutation = useMutation({
    mutationFn: (value: string) => unhideDefaultBookAction(value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
    },
  });

  const hiddenBooks = userData?.hiddenBooks ?? [];
  const togglePending = hideMutation.isPending || unhideMutation.isPending;

  if (!isAuthed) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-serif text-lg">Books</h3>
          <p className="text-sm text-muted-foreground">
            These default books appear in your feed. Sign up to customize.
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

        <Button onClick={onRequestSignIn}>Sign up to customize</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Books</h3>
        <p className="text-sm text-muted-foreground">
          Hide any default books you don&apos;t want in your feed.
        </p>
      </div>

      <DefaultsHeader />
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {isLoading && allBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading books…</p>
        ) : allBooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No default books.</p>
        ) : (
          allBooks.map((book) => {
            const hidden = hiddenBooks.includes(book.title);
            return (
              <div
                key={book.slug}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2",
                  hidden && "opacity-50",
                )}
              >
                <span className="min-w-0 truncate text-sm">
                  {book.title}
                  {book.author ? (
                    <span className="ml-2 text-xs text-muted-foreground">{book.author}</span>
                  ) : null}
                </span>
                <HideToggleButton
                  hidden={hidden}
                  hideLabel={`Hide ${book.title}`}
                  showLabel={`Show ${book.title}`}
                  pending={togglePending}
                  onToggle={() =>
                    hidden ? unhideMutation.mutate(book.title) : hideMutation.mutate(book.title)
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type HighlightGroup = {
  title: string;
  items: Array<{
    id: string;
    title: string;
    data: { text: string; author?: string; reference?: string; source?: string; url?: string };
    createdAt: Date;
  }>;
};

function groupHighlightsByBook(
  rows: Array<{
    id: string;
    title: string;
    data: { text: string; author?: string; reference?: string; source?: string; url?: string };
    createdAt: Date;
  }>,
): HighlightGroup[] {
  const map = new Map<string, HighlightGroup>();
  for (const row of rows) {
    const group = map.get(row.title) ?? { title: row.title, items: [] };
    group.items.push(row);
    map.set(row.title, group);
  }
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
}

function HighlightsSection({
  userData,
  isAuthed,
  onRequestSignIn,
  onFeedRefresh,
}: {
  userData: UserData | null;
  isAuthed: boolean;
  onRequestSignIn: () => void;
  onFeedRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [quickText, setQuickText] = useState("");
  const [quickTitle, setQuickTitle] = useState("");
  const [quickUrl, setQuickUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [showJsonShape, setShowJsonShape] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(title: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }

  const highlightsQuery = useQuery({
    queryKey: queryKeys.highlights.list,
    queryFn: getUserHighlightsAction,
    enabled: isAuthed,
  });

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.highlights.list });
    void queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  function invalidateUserData() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
  }

  function refreshFeed() {
    invalidateAll();
    onFeedRefresh();
  }

  const uploadMutation = useMutation({
    mutationFn: (rawJson: string) => uploadHighlightsAction(rawJson),
    onSuccess: (result) => {
      invalidateUserData();
      refreshFeed();
      const parts: string[] = [];
      if (result.total > 0) parts.push(`${result.total} processed`);
      if (result.inserted) parts.push(`${result.inserted} new`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      setStatus(parts.length > 0 ? `Saved: ${parts.join(" · ")}` : "No new highlights.");
      setError(result.errors.length > 0 ? result.errors.join(" ") : null);
    },
    onError: (err) => {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    },
  });

  const quickMutation = useMutation({
    mutationFn: ({ text, title, url }: { text: string; title?: string; url?: string }) =>
      addQuickHighlightAction(text, title, url),
    onSuccess: (result) => {
      invalidateUserData();
      refreshFeed();
      setQuickText("");
      setQuickTitle("");
      setQuickUrl("");
      setStatus(result.inserted ? "Highlight added." : "Highlight updated.");
      setError(result.errors.length > 0 ? result.errors.join(" ") : null);
    },
    onError: (err) => {
      setStatus(null);
      setError(err instanceof Error ? err.message : "Could not add highlight.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHighlightAction(id),
    onSuccess: () => {
      invalidateUserData();
      refreshFeed();
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: (title: string) => deleteHighlightsByBookAction(title),
    onSuccess: () => {
      invalidateUserData();
      refreshFeed();
    },
  });

  const hideMutation = useMutation({
    mutationFn: (title: string) => hideHighlightAction(title),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user.data, data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not hide highlight.");
      setStatus(null);
    },
  });

  const unhideMutation = useMutation({
    mutationFn: (title: string) => unhideHighlightAction(title),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.user.data, data);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Could not unhide highlight.");
      setStatus(null);
    },
  });

  function handleQuickSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = quickText.trim();
    if (!trimmed) return;
    quickMutation.mutate({
      text: trimmed,
      title: quickTitle.trim() || undefined,
      url: quickUrl.trim() || undefined,
    });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setStatus("Uploading…");
      setError(null);
      uploadMutation.mutate(text);
    } catch {
      setError("Could not read file.");
      setStatus(null);
    } finally {
      event.target.value = "";
    }
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(HIGHLIGHTS_AI_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  if (!isAuthed) {
    return (
      <SignInPrompt
        heading="Highlights"
        message="Sign in to upload and manage your own highlights."
        onRequestSignIn={onRequestSignIn}
      />
    );
  }

  const groups = groupHighlightsByBook(highlightsQuery.data ?? []);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const hiddenHighlights = userData?.hiddenHighlights ?? [];
  const togglePending = hideMutation.isPending || unhideMutation.isPending;
  const pending =
    uploadMutation.isPending ||
    quickMutation.isPending ||
    deleteMutation.isPending ||
    deleteBookMutation.isPending ||
    togglePending;

  const existingTitles = groups.map((g) => g.title);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-serif text-lg">Highlights</h3>
        <p className="text-sm text-muted-foreground">
          Upload highlights as JSON or add one on the fly. They appear in your feed and the
          &ldquo;Highlights&rdquo; feed option.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-4 items-start">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
            className="w-full"
          >
            <Upload className="size-4" />
            Upload JSON
          </Button>
          <div className="flex flex-row w-full">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowJsonShape((v) => !v)}
            >
              Expected format
              <Braces className="size-4" />
              <ChevronDown
                className={cn("size-3.5 transition-transform", showJsonShape && "rotate-180")}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyPrompt}
              disabled={pending}
            >
              <ClipboardCopy className="size-4" />
              {copied ? "Copied!" : "Copy AI Prompt"}
            </Button>
          </div>
        </div>

        {showJsonShape && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Also accepts <code>{"{ books: [{ title, author, highlights: [...] }] }"}</code>, a
              JSON array, or a single highlight object. Use the AI prompt with any assistant to
              transform raw notes into this shape.
            </p>
            <pre className="overflow-x-auto rounded bg-background/60 p-3 text-xs leading-relaxed">
              <code>{HIGHLIGHTS_JSON_EXAMPLE}</code>
            </pre>
          </div>
        )}
      </div>

      <form className="space-y-2 border-t border-border pt-4" onSubmit={handleQuickSubmit}>
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-muted-foreground" />
          <span className="font-medium">Quick add</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="quick-title" className="text-xs text-muted-foreground">
              Title
            </label>
            <input
              id="quick-title"
              className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm outline-none"
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="Book or source title"
              list="highlight-titles"
            />
            <datalist id="highlight-titles">
              {existingTitles.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="quick-url" className="text-xs text-muted-foreground">
              URL (optional)
            </label>
            <div className="relative">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="quick-url"
                type="url"
                className="h-11 w-full min-w-0 rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none"
                value={quickUrl}
                onChange={(event) => setQuickUrl(event.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
        </div>
        <textarea
          className="min-h-[5rem] w-full min-w-0 resize-y rounded-md border border-border bg-background p-3 text-sm outline-none"
          value={quickText}
          onChange={(event) => setQuickText(event.target.value)}
          placeholder="Paste a single highlight…"
          required
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={pending || !quickText.trim()}>
            <Plus className="size-4" />
            Add highlight
          </Button>
        </div>
      </form>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between pb-2">
          <span className="font-medium">Your highlights</span>
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "highlight" : "highlights"}
          </span>
        </div>
        <div className="max-h-[40vh] space-y-3 overflow-y-auto">
          {highlightsQuery.isLoading && groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading highlights…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No highlights yet. Upload a file or add one above.
            </p>
          ) : (
            groups.map((group) => {
              const hidden = hiddenHighlights.includes(group.title);
              const expanded = expandedGroups.has(group.title);
              return (
                <div
                  key={group.title}
                  className={cn(
                    "rounded-md border border-border bg-muted/40",
                    hidden && "opacity-50",
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2",
                      expanded && "border-b border-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.title)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      aria-expanded={expanded}
                      aria-label={expanded ? `Collapse ${group.title}` : `Expand ${group.title}`}
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          !expanded && "-rotate-90",
                        )}
                      />
                      <span className="min-w-0 truncate text-sm font-medium">
                        {group.title}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {group.items.length}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <HideToggleButton
                        hidden={hidden}
                        hideLabel={`Hide ${group.title} from feed`}
                        showLabel={`Show ${group.title} in feed`}
                        pending={togglePending}
                        onToggle={() =>
                          hidden
                            ? unhideMutation.mutate(group.title)
                            : hideMutation.mutate(group.title)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete all highlights from ${group.title}`}
                        disabled={pending}
                        onClick={() => deleteBookMutation.mutate(group.title)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <ul className="divide-y divide-border">
                      {group.items.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start justify-between gap-3 px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 text-sm text-muted-foreground line-clamp-3">
                            {row.data.text}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete highlight"
                            disabled={pending}
                            onClick={() => deleteMutation.mutate(row.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Hidden file picker, used only when there's no existing photo to edit.
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The photo currently loaded into the reposition modal, whether it's
  // the existing avatar (fetched) or a freshly picked file.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // True while we're fetching the current avatar to open "Edit."
  const [loadingCurrent, setLoadingCurrent] = useState(false);

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

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteAccountAction(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      void queryClient.invalidateQueries({ queryKey: queryKeys.user.data });
      void queryClient.invalidateQueries({ queryKey: ["feed"] });
      setConfirmDelete(false);
      onSignedOut();
    },
  });

  const uploadMutation = useMutation<unknown, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const url = await uploadProfilePicture(formData);
      const response = await authClient.updateUser({ image: url });
      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      setUploadError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
    onError: () => {
      setUploadError("Something went wrong while uploading. Please try a different image.");
    },
  });

  // Clears the avatar so the user falls back to their initial.
  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await authClient.updateUser({ image: null });
      if (response.error) {
        throw new Error(response.error.message);
      }
    },
    onSuccess: () => {
      setUploadError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
    },
    onError: () => {
      setUploadError("Something went wrong while removing your photo. Please try again.");
    },
  });

  // Fetches the current avatar image and turns it into a File, so the
  // reposition modal can treat it exactly like a freshly picked photo.
  async function loadCurrentAvatarAsFile(url: string): Promise<File> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Could not load your current photo.");
    }
    const blob = await response.blob();
    const extension = blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `current-avatar.${extension}`, { type: blob.type });
  }

  // "Edit" entry point. If there's already a photo, open the modal on it.
  // If not, fall back to the file picker so first-time users can upload.
  async function handleEditClick() {
    setUploadError(null);
    if (!user?.image) {
      fileInputRef.current?.click();
      return;
    }
    setLoadingCurrent(true);
    try {
      const file = await loadCurrentAvatarAsFile(user.image);
      setPendingFile(file);
      setCropOpen(true);
    } catch {
      setUploadError("Could not load your current photo. Please try again.");
    } finally {
      setLoadingCurrent(false);
    }
  }

  // First-time upload path: validate the picked file, then open the modal
  // so the user can frame it before it's saved.
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("That file is not an image. Please choose a JPG, PNG, GIF, or WebP.");
      return;
    }

    const maxBytes = 4 * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`That image is ${sizeMb}MB. Please choose one under 4MB.`);
      return;
    }

    setUploadError(null);
    setPendingFile(file);
    setCropOpen(true);
  }

  // The modal hands back the framed square. Upload it through the same
  // mutation as before, then release the local preview URL.
  function handleCropped(result: CroppedImageResult) {
    uploadMutation.mutate(result.file);
    URL.revokeObjectURL(result.previewUrl);
    setPendingFile(null);
  }

  // Closing the modal (Cancel or backdrop) clears the picked file.
  function handleCropOpenChange(next: boolean) {
    setCropOpen(next);
    if (!next) setPendingFile(null);
  }

  if (!isAuthed) {
    return (
      <SignInPrompt message="Sign in to manage your account." onRequestSignIn={onRequestSignIn} />
    );
  }

  const deleteError = deleteAccountMutation.error;
  const busy = uploadMutation.isPending || loadingCurrent || removeMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">Account</h3>
        <p className="text-sm text-muted-foreground">You are signed in.</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleEditClick}
          disabled={busy}
          className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted"
        >
          {user?.image ? (
            <img src={user.image} alt="Profile" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-serif text-xl">
              {user?.name?.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </button>
        <div className="text-sm">
          <div className="font-medium">
            {uploadMutation.isPending
              ? "Uploading..."
              : removeMutation.isPending
                ? "Removing..."
                : loadingCurrent
                  ? "Loading..."
                  : "Profile picture"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEditClick}
              disabled={busy}
              className="text-muted-foreground underline"
            >
              Edit
            </button>
            {user?.image && (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate()}
                  disabled={busy}
                  className="text-muted-foreground underline"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}

      {/* The reposition modal. Shows the current avatar when opened via
          "Edit," or a freshly picked photo (first upload or in-modal swap). */}
      <ProfileCropModal
        file={pendingFile}
        open={cropOpen}
        onOpenChange={handleCropOpenChange}
        onCropped={handleCropped}
        onFileReplaced={setPendingFile}
      />

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
          disabled={signOutMutation.isPending || deleteAccountMutation.isPending}
        >
          Log out
        </Button>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div>
          <h4 className="font-medium text-destructive">Delete account</h4>
          <p className="text-sm text-muted-foreground">
            Permanently remove your account and saved preferences. You can sign up again with the
            same email to start fresh.
          </p>
        </div>

        {deleteError && (
          <p className="text-sm text-destructive">
            {deleteError instanceof Error ? deleteError.message : "Something went wrong."}
          </p>
        )}

        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteAccountMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? "Deleting…" : "Confirm delete"}
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={signOutMutation.isPending}
            >
              Delete account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg">About</h3>
        <p className="text-sm text-muted-foreground pt-4">A break from the noise.</p>
      </div>

      <p className="text-sm text-muted-foreground">
        By{" "}
        <a
          className="underline hover:text-foreground"
          href="https://www.linkedin.com/in/amansazad/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Aman Azad
        </a>{" "}
        and{" "}
        <a
          className="underline hover:text-foreground"
          href="https://www.linkedin.com/in/zayed-hannan808/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Zayed Hannan
        </a>
        .
      </p>
    </div>
  );
}

