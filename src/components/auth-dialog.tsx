"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { queryKeys } from "@/lib/consts";
import type { getUserSession } from "@/lib/db/user";

type AuthMode = "sign-in" | "sign-up";

type Session = Awaited<ReturnType<typeof getUserSession>>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSession: Session;
};

export function AuthDialog({ open, onOpenChange, initialSession }: Props) {
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
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("sign-up");
    setEmail(user?.email ?? "");
    setName(user?.name ?? "");
    setPassword("");
  }, [open, user]);

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      handleOpenChange(false);
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      authMutation.reset();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[min(90vw,28rem)] sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="font-serif">Log in or sign up</DialogTitle>
          <DialogDescription>Use your email and password to continue.</DialogDescription>
        </DialogHeader>

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

        <form className="space-y-4" onSubmit={handleSubmit}>
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

          <div className="flex justify-end">
            <Button type="submit" disabled={authMutation.isPending}>
              {mode === "sign-up" ? "Create account" : "Log in"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
