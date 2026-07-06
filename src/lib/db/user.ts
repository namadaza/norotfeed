import { and, eq, isNull } from 'drizzle-orm'
import { db } from './client'
import {
  session as sessionTable,
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
    .where(and(eq(user.id, id), isNull(user.deletedAt)))
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
    hiddenArtists: Array.isArray(data?.hiddenArtists) ? data!.hiddenArtists : [],
    hiddenRssFeeds: Array.isArray(data?.hiddenRssFeeds) ? data!.hiddenRssFeeds : [],
    hiddenBooks: Array.isArray(data?.hiddenBooks) ? data!.hiddenBooks : [],
    hiddenHighlights: Array.isArray(data?.hiddenHighlights) ? data!.hiddenHighlights : [],
  }
}

export async function getUserData({ id }: { id: string }): Promise<UserData> {
  const row = await getUser({ id })
  return normalizeUserData(row?.data)
}

export type UserSubscriptions = {
  id: string
  artists: string[]
  rssFeeds: string[]
}

/**
 * Return every (non-deleted) user's id plus their subscribed artists and RSS
 * feeds. Used by the refresh-feed workflow to ingest user-specific content.
 */
export async function getAllUserSubscriptions(): Promise<UserSubscriptions[]> {
  const rows = await db
    .select({ id: user.id, data: user.data })
    .from(user)
    .where(isNull(user.deletedAt))
  return rows.map((r) => {
    const data = normalizeUserData(r.data)
    return { id: r.id, artists: data.artists, rssFeeds: data.rssFeeds }
  })
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

export async function hideUserArtist({
  id,
  slug,
}: {
  id: string
  slug: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return current
  if (current.hiddenArtists.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    hiddenArtists: [...current.hiddenArtists, normalized],
  })
}

export async function unhideUserArtist({
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
    hiddenArtists: current.hiddenArtists.filter((artist) => artist !== normalized),
  })
}

export async function hideUserRssFeed({
  id,
  url,
}: {
  id: string
  url: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = url.trim()
  if (!normalized) return current
  if (current.hiddenRssFeeds.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    hiddenRssFeeds: [...current.hiddenRssFeeds, normalized],
  })
}

export async function unhideUserRssFeed({
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
    hiddenRssFeeds: current.hiddenRssFeeds.filter((feed) => feed !== normalized),
  })
}

export async function hideUserBook({
  id,
  title,
}: {
  id: string
  title: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = title.trim()
  if (!normalized) return current
  if (current.hiddenBooks.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    hiddenBooks: [...current.hiddenBooks, normalized],
  })
}

export async function unhideUserBook({
  id,
  title,
}: {
  id: string
  title: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = title.trim()
  return writeUserData(id, {
    ...current,
    hiddenBooks: current.hiddenBooks.filter((book) => book !== normalized),
  })
}

export async function hideUserHighlight({
  id,
  title,
}: {
  id: string
  title: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = title.trim()
  if (!normalized) return current
  if (current.hiddenHighlights.includes(normalized)) return current
  return writeUserData(id, {
    ...current,
    hiddenHighlights: [...current.hiddenHighlights, normalized],
  })
}

export async function unhideUserHighlight({
  id,
  title,
}: {
  id: string
  title: string
}): Promise<UserData> {
  const current = await getUserData({ id })
  const normalized = title.trim()
  return writeUserData(id, {
    ...current,
    hiddenHighlights: current.hiddenHighlights.filter(
      (highlight) => highlight !== normalized,
    ),
  })
}

export async function softDeleteUser({ id }: { id: string }): Promise<void> {
  const row = await getUser({ id })
  if (!row) return
  const freedEmail = `${row.email}.__deleted__.${id}`
  await db.delete(sessionTable).where(eq(sessionTable.userId, id))
  await db
    .update(user)
    .set({ deletedAt: new Date(), email: freedEmail })
    .where(eq(user.id, id))
}
