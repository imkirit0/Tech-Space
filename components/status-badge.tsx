import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export const STATUSES = ["NOT_STARTED", "PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"] as const;
export type ActivityStatus = (typeof STATUSES)[number];

export function statusLabel(status: ActivityStatus): string {
  return { NOT_STARTED: "Not started", PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed", ON_HOLD: "On hold" }[status];
}

/*
 * One state vocabulary for the whole app: a lamp plus a word.
 * amber = waiting, navy = in hand, green = done, slate = parked,
 * violet = with someone else, red = urgent / brand only.
 */
export const LAMP = {
  amber: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-900" },
  blue: { dot: "bg-primary", chip: "bg-accent text-accent-foreground" },
  green: { dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-900" },
  slate: { dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  violet: { dot: "bg-violet-600", chip: "bg-violet-50 text-violet-900" },
  red: { dot: "bg-red-600", chip: "bg-red-50 text-red-800" },
} as const;
export type Lamp = keyof typeof LAMP;

export function LampBadge({ lamp, children, className }: { lamp: Lamp; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        LAMP[lamp].chip,
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", LAMP[lamp].dot)} aria-hidden />
      {children}
    </span>
  );
}

const STATUS_LAMP: Record<ActivityStatus, Lamp> = {
  NOT_STARTED: "slate",
  PENDING: "amber",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  ON_HOLD: "slate",
};

export function StatusBadge({ status, className }: { status: ActivityStatus; className?: string }) {
  return (
    <LampBadge lamp={STATUS_LAMP[status]} className={className}>
      {statusLabel(status)}
    </LampBadge>
  );
}

export function LockedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-slate-700",
        className
      )}
      title="This reporting period is locked by a manager"
    >
      <Lock className="size-3" aria-hidden />
      Locked
    </span>
  );
}
