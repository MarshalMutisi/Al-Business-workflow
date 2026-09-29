"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Mail, Siren, Ticket, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/escalations", label: "Escalations", icon: Siren },
  { href: "/customers", label: "Customers", icon: Users },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
