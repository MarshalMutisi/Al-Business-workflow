import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterTab = { label: string; href: string; active: boolean };

/** Link-based tabs, so filters live in the URL and survive reloads. */
export function FilterTabs({ tabs, label }: { tabs: FilterTab[]; label: string }) {
  return (
    <nav aria-label={label} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
            tab.active && "bg-card font-medium text-primary shadow-sm",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
