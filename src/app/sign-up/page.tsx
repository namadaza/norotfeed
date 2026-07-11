import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { SignUpPanel } from "@/components/sign-up-panel";

export const metadata: Metadata = {
  title: "Sign Up · No Rot Feed",
  description: "Create a No Rot Feed account.",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center bg-background text-foreground">
      <Link
        href="/"
        aria-label="Back to feed"
        className="fixed right-4 top-4 z-20 inline-flex size-12 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm backdrop-blur-sm transition hover:bg-accent md:right-6 md:top-6"
      >
        <X className="size-6" />
      </Link>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-16">
        <SignUpPanel />
      </div>
    </div>
  );
}
