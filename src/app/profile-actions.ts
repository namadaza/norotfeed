"use server";

import { put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function uploadProfilePicture(formData: FormData) {
  // 1. Make sure a real signed-in user is doing this.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("You must be signed in to upload a picture.");
  }

  // 2. Pull the file out of the submitted form data.
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file was provided.");
  }

  // 3. Basic guardrails: images only, and under 4MB.
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Image must be smaller than 4MB.");
  }

  // 4. Upload to Vercel Blob under a per-user path.
  const result = await put(`avatars/${session.user.id}`, file, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
  });

  // 5. Hand the public URL back to the browser.
  return result.url;
}