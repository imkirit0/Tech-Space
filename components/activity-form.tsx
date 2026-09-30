"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUSES, statusLabel, LAMP, type ActivityStatus } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { ActivityInput } from "@/lib/validation";

const STATUS_LAMP = { NOT_STARTED: "slate", PENDING: "amber", IN_PROGRESS: "blue", COMPLETED: "green", ON_HOLD: "slate" } as const;

type ExistingActivity = {
  id: string;
  date: string; // ISO
  activity: string;
  description: string | null;
  assignedBy: string;
  status: ActivityStatus;
  deadline: string | null; // ISO
  timeTaken: number;
};

type Props = {
  action: (input: ActivityInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  maxDate: string;
  existing?: ExistingActivity;
  onSuccess?: () => void;
};

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

export function ActivityForm({ action, maxDate, existing, onSuccess }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const input: ActivityInput = {
      date: String(form.get("date") ?? ""),
      activity: String(form.get("activity") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      assignedBy: String(form.get("assignedBy") ?? ""),
      status: String(form.get("status") ?? "PENDING") as ActivityStatus,
      deadline: String(form.get("deadline") ?? "") || undefined,
      timeTaken: Number(form.get("timeTaken")),
    };

    setPending(true);
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action(input);
    } catch {
      toast.error("Couldn't save. Your session may have expired, so refresh the page and try again.");
      return;
    } finally {
      setPending(false);
    }

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(existing ? "Activity updated" : "Activity added");
    if (!existing) formEl.reset();
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="activity">What did you work on?</Label>
        <Input
          id="activity"
          name="activity"
          defaultValue={existing?.activity}
          placeholder="e.g. Prepared batch schedule for October"
          required
          autoFocus={!existing}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Details {optional}</Label>
        <Textarea id="description" name="description" defaultValue={existing?.description ?? ""} rows={2} />
      </div>

      <div className="grid grid-cols-[1fr_9rem] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignedBy">Assigned by</Label>
          <Input id="assignedBy" name="assignedBy" defaultValue={existing?.assignedBy} placeholder="Name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timeTaken">Hours {optional}</Label>
          <Input
            id="timeTaken"
            name="timeTaken"
            type="number"
            inputMode="decimal"
            step={0.25}
            min={0}
            max={24}
            defaultValue={existing?.timeTaken || undefined}
            placeholder="1.5"
            className="tabular-nums"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-none font-medium">Status</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {STATUSES.map((s) => (
            <label
              key={s}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm transition-colors",
                "hover:bg-muted has-checked:border-primary has-checked:bg-accent has-checked:font-medium has-checked:text-accent-foreground",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              )}
            >
              <input
                type="radio"
                name="status"
                value={s}
                defaultChecked={(existing?.status ?? "PENDING") === s}
                className="sr-only"
              />
              <span className={cn("size-2 shrink-0 rounded-full", LAMP[STATUS_LAMP[s]].dot)} aria-hidden />
              {statusLabel(s)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" max={maxDate} defaultValue={existing?.date ?? maxDate} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deadline">Deadline {optional}</Label>
          <Input id="deadline" name="deadline" type="date" defaultValue={existing?.deadline ?? ""} />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Saving…" : existing ? "Save changes" : "Add activity"}
      </Button>
    </form>
  );
}
