"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { lockPeriod, lockMonth, removeLock } from "@/app/manager/locks/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDay } from "@/lib/dates";

type PeriodLockRow = {
  id: string;
  label: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  lockedByName: string;
  lockedAt: string;
};

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

export function LockPanel({ locks }: { locks: PeriodLockRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<"month" | "range" | null>(null);

  async function submit(
    kind: "month" | "range",
    formEl: HTMLFormElement,
    run: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string
  ) {
    setPending(kind);
    let result: Awaited<ReturnType<typeof run>>;
    try {
      result = await run();
    } catch {
      toast.error("Couldn't lock. Your session may have expired, so refresh the page.");
      return;
    } finally {
      setPending(null);
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(success);
    formEl.reset();
    router.refresh();
  }

  function handleLockMonth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const month = String(form.get("month") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!month) return;
    submit("month", formEl, () => lockMonth(month, reason || undefined), "Month locked");
  }

  function handleLockRange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");
    const label = String(form.get("label") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    if (!startDate || !endDate) return;
    submit(
      "range",
      formEl,
      () => lockPeriod({ startDate, endDate, label: label || undefined, reason: reason || undefined }),
      "Period locked"
    );
  }

  async function handleRemove(id: string) {
    let result: Awaited<ReturnType<typeof removeLock>>;
    try {
      result = await removeLock(id);
    } catch {
      toast.error("Couldn't unlock. Your session may have expired, so refresh the page.");
      return false;
    }
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Period unlocked");
    router.refresh();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col divide-y border-b lg:border-r lg:border-b-0">
        <form onSubmit={handleLockMonth} className="flex flex-col gap-3 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="size-4 text-primary" aria-hidden />
            Lock a month
          </h3>
          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="month">Month</Label>
              <Input id="month" name="month" type="month" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="month-reason">Reason {optional}</Label>
              <Input id="month-reason" name="reason" placeholder="e.g. Reviewed and sent to accounts" />
            </div>
          </div>
          <Button type="submit" disabled={pending !== null} className="self-start">
            {pending === "month" ? "Locking…" : "Lock month"}
          </Button>
        </form>

        <form onSubmit={handleLockRange} className="flex flex-col gap-3 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-primary" aria-hidden />
            Lock a custom range
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">From</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">To</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Label {optional}</Label>
              <Input id="label" name="label" placeholder="e.g. Q2 review" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="range-reason">Reason {optional}</Label>
              <Input id="range-reason" name="reason" />
            </div>
          </div>
          <Button type="submit" disabled={pending !== null} className="self-start">
            {pending === "range" ? "Locking…" : "Lock range"}
          </Button>
        </form>
      </div>

      <div className="flex flex-col">
        <h3 className="px-4 pt-4 pb-2 text-sm font-semibold sm:px-5 sm:pt-5">
          Locked periods <span className="font-normal text-muted-foreground">({locks.length})</span>
        </h3>
        {locks.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground sm:px-5">
            Nothing is locked yet, so employees can still edit every past entry.
          </p>
        ) : (
          <ul className="divide-y">
            {locks.map((l) => {
              const range = `${fmtDay(l.startDate)} – ${fmtDay(l.endDate)} ${l.endDate.slice(0, 4)}`;
              return (
                <li key={l.id} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{l.label || range}</p>
                    {l.label && <p className="text-muted-foreground">{range}</p>}
                    <p className="text-xs text-muted-foreground">
                      Locked by {l.lockedByName} on{" "}
                      {new Date(l.lockedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      })}
                      {l.reason ? ` · ${l.reason}` : ""}
                    </p>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="outline" className="shrink-0">
                        <LockOpen />
                        Unlock
                      </Button>
                    }
                    title="Unlock this period?"
                    description={`Employees will be able to edit and delete their entries from ${range} again.`}
                    confirmLabel="Unlock period"
                    onConfirm={() => handleRemove(l.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
