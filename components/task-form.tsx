"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Choice } from "@/components/ticket-form";
import { TICKET_PRIORITIES, type TicketPriority } from "@/components/ticket-badges";
import type { TaskInput } from "@/lib/validation";
import { setWhatsAppNumber } from "@/app/profile/actions";
import { cn } from "@/lib/utils";

export type Person = { id: string; name: string; designation: string | null; phone: string | null };

export type TaskSaved = { id?: string; num?: number; input: TaskInput; phone: string | null };

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

export function TaskForm({
  people,
  existing,
  action,
  onSuccess,
  minDate,
  isManager,
  meId,
}: {
  /** Managers get the full person picker; staff only choose "open" or "me". */
  people: Person[];
  existing?: {
    title: string;
    description: string | null;
    assigneeId: string | null;
    shared: boolean;
    priority: TicketPriority;
    dueDate: string | null;
  };
  action: (input: TaskInput) => Promise<{ ok: true; id?: string; num?: number } | { ok: false; error: string }>;
  onSuccess?: (saved: TaskSaved) => void;
  minDate: string;
  isManager: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? "");
  const [shared, setShared] = useState(existing?.shared ?? false);
  const chosen = people.find((p) => p.id === assigneeId);
  // Staff edit the words only; who's doing it changes by take up / release.
  const showWho = isManager || !existing;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const input: TaskInput = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      assigneeId: assigneeId || undefined,
      shared: !assigneeId || shared,
      priority: String(form.get("priority") ?? "MEDIUM") as TicketPriority,
      dueDate: String(form.get("dueDate") ?? "") || undefined,
    };
    setPending(true);
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action(input);
    } catch {
      toast.error("Couldn't save the task. Your session may have expired, so refresh the page.");
      return;
    } finally {
      setPending(false);
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Optional: save the assignee's WhatsApp number typed into this form.
    let phone = chosen?.phone ?? null;
    const typedPhone = String(form.get("assigneePhone") ?? "").trim();
    if (typedPhone && input.assigneeId) {
      const saved = await setWhatsAppNumber(input.assigneeId, typedPhone).catch(() => null);
      if (saved?.ok) phone = saved.phone;
      else toast.error(saved ? saved.error : "Task saved, but the WhatsApp number didn't save.");
    }
    toast.success(existing ? "Task updated" : input.assigneeId ? "Task assigned" : "Task posted to the team board");
    router.refresh();
    onSuccess?.({ id: result.id, num: result.num, input, phone });
  }

  const selectClass =
    "h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {showWho && isManager && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-assignee">Who&apos;s doing it?</Label>
          <div className="relative">
            <select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
              <option value="">Anyone: put it on the team board</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.designation ? ` · ${p.designation}` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          </div>
          {assigneeId ? (
            <label className="mt-1 flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={shared}
                onChange={(e) => setShared(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input"
              />
              <span>
                Show on the team board
                <span className="block text-xs text-muted-foreground">Everyone can follow progress and comment. Off keeps it between you two.</span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">Everyone sees it, and the first person to take it up owns it.</p>
          )}
        </div>
      )}

      {showWho && !isManager && (
        <fieldset className="flex flex-col">
          <legend className="mb-1.5 text-sm leading-none font-medium">Who&apos;s doing it?</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {[
              { value: "", title: "Anyone", hint: "Post it on the team board for someone to take up" },
              { value: meId, title: "I'll do it", hint: "It's yours; the team can still follow along" },
            ].map((o) => (
              <label
                key={o.title}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                  "has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground",
                  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                )}
              >
                <input
                  type="radio"
                  name="who"
                  value={o.value}
                  checked={assigneeId === o.value}
                  onChange={() => setAssigneeId(o.value)}
                  className="sr-only"
                />
                <span className="font-medium">{o.title}</span>
                <span className="text-xs text-muted-foreground">{o.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {isManager && chosen && !chosen.phone && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3">
          <Label htmlFor="task-assignee-phone">
            {chosen.name.split(/\s+/)[0]}&apos;s WhatsApp number {optional}
          </Label>
          <Input key={chosen.id} id="task-assignee-phone" name="assigneePhone" type="tel" inputMode="tel" placeholder="98470 12345" />
          <p className="text-xs text-muted-foreground">Not on file yet. Add it to notify them on WhatsApp after assigning.</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-title">Task</Label>
        <Input
          id="task-title"
          name="title"
          required
          minLength={3}
          maxLength={200}
          defaultValue={existing?.title}
          placeholder="e.g. Prepare the October batch timetable"
          autoFocus={!existing}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="task-description">Details {optional}</Label>
        <Textarea
          id="task-description"
          name="description"
          rows={3}
          defaultValue={existing?.description ?? ""}
          placeholder="What does done look like? Any files or people to involve?"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <Choice name="priority" legend="Priority" options={TICKET_PRIORITIES} defaultValue={existing?.priority ?? "MEDIUM"} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="task-due">Due {optional}</Label>
          <Input id="task-due" name="dueDate" type="date" min={existing ? undefined : minDate} defaultValue={existing?.dueDate ?? ""} />
        </div>
      </div>

      <Button type="submit" size="lg" disabled={pending} className="mt-1">
        {pending ? "Saving…" : existing ? "Save changes" : assigneeId && assigneeId !== meId ? "Assign task" : assigneeId ? "Add my task" : "Post to team board"}
      </Button>
    </form>
  );
}
