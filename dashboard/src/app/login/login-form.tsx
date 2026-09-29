"use client";

import { useActionState } from "react";

import { login, type FormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, { error: null });
  const message = state.error ?? notice;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="key">Admin API key</Label>
        <Input
          id="key"
          name="key"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          aria-invalid={state.error ? true : undefined}
          aria-describedby={message ? "login-message" : undefined}
        />
      </div>
      {message && (
        <p id="login-message" role="alert" className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </Button>
    </form>
  );
}
