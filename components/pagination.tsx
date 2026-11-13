import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Previous / "Page x of y" / Next footer for any list. Renders nothing when there is only one page.
 * `window` comes from pageWindow() or paginate(); `href` builds the link for a page number.
 */
export function Pagination({
  window: w,
  href,
  label,
  className,
}: {
  window: { page: number; pageCount: number; skip: number; total: number; size: number };
  href: (page: number) => string;
  /** What is being paged, for screen readers: "Activity pages". */
  label: string;
  className?: string;
}) {
  if (w.pageCount <= 1) return null;
  const last = Math.min(w.total, w.skip + w.size);
  return (
    <nav aria-label={label} className={cn("flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-5", className)}>
      <PageLink href={w.page > 1 ? href(w.page - 1) : null}>
        <ChevronLeft className="size-4" aria-hidden />
        Previous
      </PageLink>
      <p className="text-center text-sm text-muted-foreground tabular-nums">
        <span className="hidden sm:inline">
          {w.skip + 1}–{last} of {w.total} ·{" "}
        </span>
        Page <span className="font-medium text-foreground">{w.page}</span> of {w.pageCount}
      </p>
      <PageLink href={w.page < w.pageCount ? href(w.page + 1) : null}>
        Next
        <ChevronRight className="size-4" aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const cls = buttonVariants({ variant: "outline" });
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <span aria-disabled className={cn(cls, "pointer-events-none opacity-40")}>
      {children}
    </span>
  );
}
