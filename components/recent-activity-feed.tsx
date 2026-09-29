import { ChevronDown } from "lucide-react";
import { formatDuration, istStamp } from "@/lib/duration";

export function RecentActivityFeed({ events }: { events: { at: string; text: string }[] }) {
  return (
    <details className="group overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_31_64/0.04)]">
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 select-none hover:bg-muted/40 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
          Recent activity
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground tabular-nums">
            {events.length}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            {events[0] ? `Latest ${istStamp(new Date(events[0].at))}` : "No events yet"}
          </span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </span>
      </summary>
      <div className="border-t">
        {events.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
            New activities and ticket updates will appear here as they happen.
          </p>
        ) : (
          <ol className="relative px-4 py-4 sm:px-5">
            {events.map((e, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                <span
                  className="absolute top-3 bottom-0 left-[3px] w-px bg-border [li:last-child>&]:hidden"
                  aria-hidden
                />
                <span className="relative mt-1.5 size-[7px] shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm break-words">{e.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {istStamp(new Date(e.at))} · {formatDuration(Date.now() - Date.parse(e.at))} ago
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
