"use server";

import {
  addUserArtist,
  addUserRssFeed,
  getUserData,
  getUserSession,
  hideUserArtist,
  hideUserBook,
  hideUserRssFeed,
  removeUserArtist,
  removeUserRssFeed,
  softDeleteUser,
  unhideUserArtist,
  unhideUserBook,
  unhideUserRssFeed,
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

export async function deleteAccountAction(): Promise<void> {
  const id = await requireUserId();
  await softDeleteUser({ id });
}
