"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const featuredArtwork = {
  title: "Gardens of the Generalife",
  artist: "Santiago Rusiñol",
  year: 1895,
  imageUrl:
    "https://veuua6kvxrbip1i0.public.blob.vercel-storage.com/better-twitter/artwork/images/wikiart/santiago-rusinol/Gardens_of_the_Generalife.jpg",
};

type AuthMode = "sign-up" | "sign-in";

export function SignUpPanel() {
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const authMutation = useMutation<unknown, Error>({
    mutationFn: async () => {
      const response =
        mode === "sign-up"
          ? await authClient.signUp.email({
              email,
              password,
              name,
              callbackURL: "/",
            })
          : await authClient.signIn.email({
              email,
              password,
              callbackURL: "/",
              rememberMe: true,
            });

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="font-serif text-sm uppercase tracking-[0.18em] text-muted-foreground">
          No Rot Feed
        </div>
        <h1 className="font-serif text-4xl leading-tight text-foreground md:text-6xl">
          Stop the rot.
        </h1>
        <p className="max-w-xl text-balance text-lg leading-8 text-foreground/80 md:text-xl">
          A feed made from the things you actually care about: books, RSS, artists, and highlights.
          Sign up to save your preferences and make it yours.
        </p>
        <div className="grid gap-3 text-sm leading-6 text-foreground/75">
          <p>Bring your own sources.</p>
          <p>Randomize the mix so the feed stays fresh.</p>
          <p>Dial it in later from Feed Options.</p>
        </div>

        <figure>
          <a
            href="https://www.wikiart.org/en/santiago-rusinol/gardens-of-the-generalife-1895"
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden border border-border bg-background/80 shadow-sm"
          >
            <img
              src={featuredArtwork.imageUrl}
              alt={featuredArtwork.title}
              className="h-80 w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </a>
          <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-foreground/75">
            <a
              href="https://www.wikiart.org/en/santiago-rusinol/gardens-of-the-generalife-1895"
              target="_blank"
              rel="noreferrer"
              className="hover:opacity-70"
            >
              {featuredArtwork.title} by {featuredArtwork.artist}
            </a>
            <span>{featuredArtwork.year}</span>
          </figcaption>
        </figure>
      </section>

      <section className="rounded-3xl border border-border bg-background/80 p-6 shadow-sm backdrop-blur-sm md:p-8">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "sign-up" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("sign-up")}
          >
            Sign Up
          </Button>
          <Button
            type="button"
            variant={mode === "sign-in" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("sign-in")}
          >
            Log In
          </Button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {mode === "sign-up" && (
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Name</span>
              <input
                className="h-11 rounded-md border border-border bg-background px-3 outline-none"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              className="h-11 rounded-md border border-border bg-background px-3 outline-none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="grid gap-2 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              className="h-11 rounded-md border border-border bg-background px-3 outline-none"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              minLength={8}
              required
            />
          </label>

          {authMutation.error && (
            <p className="text-sm text-destructive">{authMutation.error.message}</p>
          )}

          <Button type="submit" className="w-full rounded-full" disabled={authMutation.isPending}>
            {mode === "sign-up" ? "Create account" : "Log in"}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </section>
    </div>
  );
}
