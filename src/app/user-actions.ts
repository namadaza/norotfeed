"use server";

import {
  addUserArtist,
  addUserRssFeed,
  getUserData,
  getUserSession,
  removeUserArtist,
  removeUserRssFeed,
} from "@/lib/db/user";
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
