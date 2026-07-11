import type { ThemeName } from "./db/schema";

export type FeedItem =
  | {
      type: "highlight";
      id: string;
      title: string;
      text: string;
      author?: string;
      reference?: string;
      source?: string;
      url?: string;
    }
  | {
      type: "rss";
      id: string;
      title: string;
      url: string;
      publication: string;
      author?: string;
      excerpt?: string;
      publishedAt?: string;
      feedUrl?: string;
    }
  | {
      type: "book";
      id: string;
      format: "poem" | "prose";
      body: string;
      title?: string;
      author?: string;
      book: string;
      source?: string;
      reference?: string;
      url?: string;
      secondaryText?: string;
    }
  | {
      type: "artwork";
      id: string;
      data: import("@/lib/db/schema").ArtworkContent;
    };

export type Theme = "light" | "dark" | "system";

export type FeedOptions =
  | {
      contentType: "highlights";
      bookTitle?: string;
      bookOrder: "random" | "in-order";
    }
  | {
      contentType: "rss";
      rssOrder: "chronological" | "random";
    }
  | {
      contentType: "art";
    }
  | {
      contentType: "islam";
    };

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  initialColorTheme?: ThemeName;
}