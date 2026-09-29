"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ActivityForm } from "@/components/activity-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { updateActivity, deleteActivity } from "@/app/activities/actions";
import { Button } from "@/components/ui/button";
import { StatusBadge, LockedBadge, type ActivityStatus } from "@/components/status-badge";
import { EmptyState } from "@/components/section";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDay, fmtDayLong } from "@/lib/dates";
import { formatHours, WORKDAY_HOURS } from "@/lib/hours";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  date: string;
  activity: string;
  description: string | null;
  assignedBy: string;
  status: ActivityStatus;
  deadline: string | null;
  timeTaken: number;
  locked: boolean;
};

export function ActivityHistory({ rows, maxDate }: { rows: Row[]; maxDate: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  async function handleDelete(id: string) {
    let result: Awaited<ReturnType<typeof deleteActivity>>;
    try {
      result = await deleteActivity(id);
    } catch {
      toast.error("Couldn't delete. Your session may have expired, so refresh the page.");
      return false;
    }
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Activity deleted");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState icon={<History />} title="No activities yet">
        Use “Add activity” above to log your first piece of work.
      </EmptyState>
    );
  }

  // Rows arrive newest first; group them into days.
  const days: { date: string; rows: Row[]; hours: number }[] = [];
  for (const r of rows) {
    const day = days.at(-1);
    if (day && day.date === r.date) {
      day.rows.push(r);
      day.hours += r.timeTaken;
    } else {
      days.push({ date: r.date, rows: [r], hours: r.timeTaken });
    }
  }

  return (
    <>
      <div className="divide-y">
        {days.map((day) => (
          <section key={day.date} aria-label={fmtDayLong(day.date)}>
            <div className="flex items-baseline justify-between gap-4 bg-muted/60 px-4 py-2 sm:px-5">
              <h3 className="text-sm font-semibold">{fmtDayLong(day.date)}</h3>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  day.hours >= WORKDAY_HOURS ? "text-emerald-700" : "text-muted-foreground"
                )}
              >
                {formatHours(day.hours)} / {WORKDAY_HOURS} h
              </p>
            </div>
            <ul className="divide-y">
              {day.rows.map((row) => (
                <li key={row.id} className="flex items-start gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{row.activity}</p>
                    {row.description && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <StatusBadge status={row.status} />
                      <span>Assigned by {row.assignedBy}</span>
                      {row.deadline && <span>Due {fmtDay(row.deadline)}</span>}
                      {row.locked && <LockedBadge />}
                    </div>
                  </div>
                  <p className="w-14 shrink-0 pt-px text-right font-medium tabular-nums">{formatHours(row.timeTaken)} h</p>
                  {row.locked ? (
                    <span className="size-8 shrink-0" aria-hidden />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon-sm" className="-mt-1 shrink-0" />}
                        aria-label={`Actions for ${row.activity}`}
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setEditing(row)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(row)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          {editing && (
            <ActivityForm
              action={(input) => updateActivity(editing.id, input)}
              maxDate={maxDate}
              existing={editing}
              onSuccess={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this activity?"
        description={deleting ? `“${deleting.activity}” on ${fmtDay(deleting.date)} will be removed for good.` : ""}
        confirmLabel="Delete activity"
        onConfirm={() => handleDelete(deleting!.id)}
      />
    </>
  );
}
