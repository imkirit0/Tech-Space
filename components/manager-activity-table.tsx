"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, SearchX } from "lucide-react";
import { deleteActivity } from "@/app/activities/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/section";
import { Button } from "@/components/ui/button";
import { StatusBadge, type ActivityStatus } from "@/components/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { fmtDay } from "@/lib/dates";
import { formatHours } from "@/lib/hours";

type Row = {
  id: string;
  date: string | null;
  employeeName: string;
  designation: string;
  activity: string;
  description: string | null;
  status: ActivityStatus;
  assignedBy: string;
  timeTaken: number;
  deadline: string | null;
};

export function ManagerActivityTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
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
      <EmptyState icon={<SearchX />} title="No activities match these filters">
        Widen the date range or clear the filters to see more.
      </EmptyState>
    );
  }

  const deleteButton = (row: Row) => (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={`Delete activity by ${row.employeeName}`}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      onClick={() => setDeleting(row)}
    >
      <Trash2 />
    </Button>
  );

  return (
    <>
      {/* Phones: one stacked row per entry */}
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{row.employeeName}</span>
                {row.designation && ` · ${row.designation}`} · {row.date ? fmtDay(row.date) : "—"}
              </p>
              <p className="mt-1 font-medium break-words">{row.activity}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StatusBadge status={row.status} />
                <span className="font-medium text-foreground tabular-nums">{formatHours(row.timeTaken)} h</span>
                <span>By {row.assignedBy}</span>
                {row.deadline && <span>Due {fmtDay(row.deadline)}</span>}
              </div>
            </div>
            {deleteButton(row)}
          </li>
        ))}
      </ul>

      {/* Desktop: full table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="pl-5">Date</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned by</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead className="w-12 pr-5">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="pl-5 whitespace-nowrap text-muted-foreground">
                  {row.date ? fmtDay(row.date) : "—"}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{row.employeeName}</p>
                  {row.designation && <p className="text-xs text-muted-foreground">{row.designation}</p>}
                </TableCell>
                <TableCell className="max-w-80">
                  <p className="truncate" title={row.description ?? row.activity}>
                    {row.activity}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{row.assignedBy}</TableCell>
                <TableCell className="text-right font-medium">{formatHours(row.timeTaken)}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {row.deadline ? fmtDay(row.deadline) : "—"}
                </TableCell>
                <TableCell className="pr-5 text-right">{deleteButton(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this activity?"
        description={
          deleting
            ? `${deleting.employeeName}'s entry “${deleting.activity}” will be removed for good. This also removes it from exports.`
            : ""
        }
        confirmLabel="Delete activity"
        onConfirm={() => handleDelete(deleting!.id)}
      />
    </>
  );
}
