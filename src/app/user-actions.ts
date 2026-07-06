"use server";

import {
  addUserArtist,
  addUserRssFeed,
  getUserData,
  getUserSession,
  hideUserArtist,
  hideUserBook,
  hideUserHighlight,
  hideUserRssFeed,
  removeUserArtist,
  removeUserRssFeed,
  softDeleteUser,
  unhideUserArtist,
  unhideUserBook,
  unhideUserHighlight,
  unhideUserRssFeed,
} from "@/lib/db/user";
import {
  deleteUserHighlight,
  deleteUserHighlightsByBook,
  getUserHighlights,
  upsertUserHighlights,
  type UserHighlightRow,
} from "@/lib/db/content";
import {
  parseHighlightUpload,
  type HighlightInput,
  type ParsedHighlight,
} from "@/lib/highlights";
import type { UserData } from "@/lib/db/schema";

async function requireUserId(): Promise<string> {
  const session = await getUserSession();
  const id = session?.user?.id;
  if (!id) throw new Error("You must be signed in to do that.");
  return id;
}

export async function fetchUserData(): Promise<UserData | null> {
  const session = await getUserSession();
  const id = session?.user?.id;
  if (!id) return null;
  return getUserData({ id });
}

export async function addRssFeedAction(url: string): Promise<UserData> {
  const id = await requireUserId();
  return addUserRssFeed({ id, url });
}

export async function removeRssFeedAction(url: string): Promise<UserData> {
  const id = await requireUserId();
  return removeUserRssFeed({ id, url });
}

export async function addArtistAction(slug: string): Promise<UserData> {
  const id = await requireUserId();
  return addUserArtist({ id, slug });
}

export async function removeArtistAction(slug: string): Promise<UserData> {
  const id = await requireUserId();
  return removeUserArtist({ id, slug });
}

export async function hideDefaultArtistAction(slug: string): Promise<UserData> {
  const id = await requireUserId();
  return hideUserArtist({ id, slug });
}

export async function unhideDefaultArtistAction(slug: string): Promise<UserData> {
  const id = await requireUserId();
  return unhideUserArtist({ id, slug });
}

export async function hideDefaultRssFeedAction(url: string): Promise<UserData> {
  const id = await requireUserId();
  return hideUserRssFeed({ id, url });
}

export async function unhideDefaultRssFeedAction(url: string): Promise<UserData> {
  const id = await requireUserId();
  return unhideUserRssFeed({ id, url });
}

export async function hideDefaultBookAction(title: string): Promise<UserData> {
  const id = await requireUserId();
  return hideUserBook({ id, title });
}

export async function unhideDefaultBookAction(title: string): Promise<UserData> {
  const id = await requireUserId();
  return unhideUserBook({ id, title });
}

export async function hideHighlightAction(title: string): Promise<UserData> {
  const id = await requireUserId();
  return hideUserHighlight({ id, title });
}

export async function unhideHighlightAction(title: string): Promise<UserData> {
  const id = await requireUserId();
  return unhideUserHighlight({ id, title });
}

export async function deleteAccountAction(): Promise<void> {
  const id = await requireUserId();
  await softDeleteUser({ id });
}

export async function getUserHighlightsAction(): Promise<UserHighlightRow[]> {
  const id = await requireUserId();
  return getUserHighlights(id);
}

export type UploadHighlightsResult = {
  inserted: number;
  updated: number;
  total: number;
  skipped: number;
  errors: string[];
};

/**
 * Parse and upsert a JSON upload of highlights for the signed-in user.
 * Accepts the flexible shape defined by `HighlightUpload`. Returns counts
 * and any parse errors so the UI can surface them.
 */
export async function uploadHighlightsAction(
  rawJson: string,
): Promise<UploadHighlightsResult> {
  const id = await requireUserId();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { inserted: 0, updated: 0, total: 0, skipped: 0, errors: ["Invalid JSON."] };
  }
  const result = parseHighlightUpload(parsed);
  if (result.highlights.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      total: 0,
      skipped: result.skipped,
      errors: result.errors,
    };
  }
  const upserted = await upsertUserHighlights(id, result.highlights);
  return {
    inserted: upserted.inserted,
    updated: upserted.updated,
    total: upserted.total,
    skipped: result.skipped,
    errors: result.errors,
  };
}

export async function addQuickHighlightAction(
  text: string,
  title?: string,
  url?: string,
  author?: string,
  reference?: string,
): Promise<UploadHighlightsResult> {
  const id = await requireUserId();
  const trimmed = text.trim();
  if (!trimmed) {
    return { inserted: 0, updated: 0, total: 0, skipped: 0, errors: ["Highlight text is required."] };
  }
  const parsed: ParsedHighlight[] = [
    {
      title: (title?.trim() || "Highlight"),
      data: {
        text: trimmed,
        url: url?.trim() || undefined,
        author: author?.trim() || undefined,
        reference: reference?.trim() || undefined,
      },
    },
  ];
  const upserted = await upsertUserHighlights(id, parsed);
  return {
    inserted: upserted.inserted,
    updated: upserted.updated,
    total: upserted.total,
    skipped: 0,
    errors: [],
  };
}

export async function deleteHighlightAction(id: string): Promise<boolean> {
  const userId = await requireUserId();
  return deleteUserHighlight(userId, id);
}

export async function deleteHighlightsByBookAction(title: string): Promise<number> {
  const userId = await requireUserId();
  return deleteUserHighlightsByBook(userId, title);
}

export type { HighlightInput };
