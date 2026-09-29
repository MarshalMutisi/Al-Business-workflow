import type { Metadata } from "next";
import { Workflow } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/format";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, expired } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_60%)] px-4 py-12">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Workflow className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-lg">Workflow admin</CardTitle>
          <CardDescription>Sign in with the ADMIN_API_KEY from the API&apos;s .env file.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm
            next={safeRedirectPath(next)}
            notice={expired ? "Your session is no longer valid. Sign in again." : null}
          />
        </CardContent>
      </Card>
    </main>
  );
}
