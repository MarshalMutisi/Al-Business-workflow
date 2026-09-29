import Link from "next/link";
import { LogOut, Workflow } from "lucide-react";

import { logout } from "@/app/actions";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Workflow className="size-4.5" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">Workflow</span>
              <span className="block text-xs text-muted-foreground">Admin console</span>
            </span>
          </Link>
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <Nav />
          </div>
          <form action={logout} className="ml-auto sm:ml-0">
            <Button
              type="submit"
              variant="outline"
              className="h-9 gap-2 px-3 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  );
}
