"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLinks({
  links,
  className,
}: {
  links: { href: string; label: string; badge?: number }[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("items-stretch gap-1 self-stretch", className)}>
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-11 items-center px-3 text-sm font-medium transition-colors focus-visible:bg-white/10 focus-visible:outline-none",
              "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors",
              active
                ? "text-white after:bg-brand-red"
                : "text-board-muted after:bg-transparent hover:text-white"
            )}
          >
            {l.label}
            {!!l.badge && (
              <span className="ml-1.5 min-w-5 rounded-full bg-brand-red px-1.5 py-px text-center text-[11px] font-bold text-white tabular-nums">
                {l.badge}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
