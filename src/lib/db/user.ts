import { eq } from 'drizzle-orm'
import { db } from './client'
import {
  user,
  type User,
  type UserData,
} from './schema'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export async function getUser({ id }: { id: string }): Promise<User | null> {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return row ?? null
}

export const getUserSession = async () => {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  return session ?? null
}

function normalizeUserData(data: UserData | null | undefined): UserData {
  return {
    artists: Array.isArray(data?.artists) ? data!.artists : [],
    rssFeeds: Array.isArray(data?.rssFeeds) ? data!.rssFeeds : [],
  }
}

export async function getUserData({ id }: { id: string }): Promise<UserData> {
  const row = await getUser({ id })
  return normalizeUserData(row?.data)
}

async function writeUserData(
  id: string,
  next: UserData,
): Promise<UserData> {
  const [row] = await db
    .update(user)
    .set({ data: next })
    .where(eq(user.id, id))
    .returning({ data: user.data })
  return normalizeUserData(row?.data)
}

export async function addUserArtist({
  id,
  slug,
}: {
  id: string
  slug: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return current
  if (current.artists.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    artists: [...current.artists, normalized],
  })
}

export async function removeUserArtist({
  id,
  slug,
}: {
  id: string
  slug: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = slug.trim().toLowerCase()
  return writeUserData(id, {
    ...current,
    artists: current.artists.filter((artist) => artist !== normalized),
  })
}

export async function addUserRssFeed({
  id,
  url,
}: {
  id: string
  url: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = url.trim()
  if (!normalized) return current
  if (current.rssFeeds.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    rssFeeds: [...current.rssFeeds, normalized],
  })
}

export async function removeUserRssFeed({
  id,
  url,
}: {
  id: string
  url: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = url.trim()
  return writeUserData(id, {
    ...current,
    rssFeeds: current.rssFeeds.filter((feed) => feed !== normalized),
  })
}
