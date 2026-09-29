"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Hand, MessageCircle, MoreHorizontal, Pencil, SendHorizontal, Trash2, Undo2, Users } from "lucide-react";
import { openTaskWhatsApp } from "@/lib/task-whatsapp";
import { postTaskUpdate, markTaskRead, deleteTask, editTask, takeUpTask, releaseTask } from "@/app/tasks/actions";
import { TaskForm, type Person } from "@/components/task-form";
import { TASK_LAMP } from "@/components/task-status-badge";
import { TicketPriorityBadge, type TicketPriority } from "@/components/ticket-badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LAMP } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TASK_STATUSES, TASK_STATUS_LABEL, isTaskOverdue, statusChangeText, type TaskStatus } from "@/lib/tasks";
import { fmtDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type ThreadTask = {
  id: string;
  num: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TicketPriority;
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneePhone: string | null;
  shared: boolean;
  createdByName: string;
  createdAt: string;
};

export type ThreadUpdate = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  statusTo: TaskStatus | null;
  createdAt: string;
};

const TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
        mine ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function TaskThread({
  task,
  updates,
  meId,
  perms,
  isManager,
  people,
  lastReadAt,
  today,
  backHref,
}: {
  task: ThreadTask;
  updates: ThreadUpdate[];
  meId: string;
  perms: { changeStatus: boolean; takeUp: boolean; release: boolean; edit: boolean; notify: boolean };
  isManager: boolean;
  people: Person[];
  lastReadAt: string | null;
  today: string;
  backHref: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Opening the thread (or a new message arriving while it's open) marks it read.
  const latestId = updates.at(-1)?.id ?? task.id;
  useEffect(() => {
    // Refresh once so the unread dot and nav badge clear right away.
    markTaskRead(task.id)
      .then((r) => r.ok && router.refresh())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, latestId]);

  // Keep the newest message in view, like a chat.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [task.id, updates.length]);

  async function send(payload: { body: string; statusTo?: TaskStatus }) {
    setSending(true);
    try {
      const result = await postTaskUpdate(task.id, payload);
      if (!result.ok) {
        toast.error(result.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      toast.error("Couldn't post. Your session may have expired, so refresh the page.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    setSending(true);
    try {
      const r = await action();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(success);
      router.refresh();
    } catch {
      toast.error("That didn't go through. Your session may have expired, so refresh the page.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    if (await send({ body: text })) setBody("");
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const overdue = isTaskOverdue(task.dueDate, task.status, today);
  const readAt = lastReadAt ? Date.parse(lastReadAt) : 0;
  const firstNewIndex = updates.findIndex((u) => u.authorId !== meId && Date.parse(u.createdAt) > readAt);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b px-4 py-3.5 sm:px-5">
        <div className="flex items-start gap-2">
          <Link
            href={backHref}
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Back to tasks"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs font-bold text-primary">#{task.num}</p>
            <h2 className="text-lg leading-snug font-semibold tracking-tight break-words">{task.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {task.assigneeName ? (
                  <>
                    For <strong className="font-semibold text-foreground">{task.assigneeId === meId ? "you" : task.assigneeName}</strong>
                  </>
                ) : (
                  <strong className="font-semibold text-amber-800">Up for grabs</strong>
                )}{" "}
                · from {task.createdByName}
              </span>
              {task.shared && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden />
                  Team board
                </span>
              )}
              <TicketPriorityBadge priority={task.priority} />
              {task.dueDate && (
                <span className={cn("inline-flex items-center gap-1", overdue && "font-semibold text-red-700")}>
                  <CalendarClock className="size-3.5" aria-hidden />
                  {overdue ? "Overdue · " : "Due "}
                  {fmtDay(task.dueDate)}
                </span>
              )}
            </p>
          </div>
          {perms.takeUp && (
            <Button size="sm" disabled={sending} onClick={() => run(() => takeUpTask(task.id), "It's yours. Post updates as you go.")}>
              <Hand />
              Take up
            </Button>
          )}
          {(perms.edit || perms.release || perms.notify) && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label="Task options">
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {perms.release && (
                  <DropdownMenuItem onClick={() => run(() => releaseTask(task.id), "Released back to the team board")}>
                    <Undo2 /> Release to team board
                  </DropdownMenuItem>
                )}
                {perms.notify && task.assigneeName && (
                <DropdownMenuItem
                  disabled={!task.assigneePhone}
                  onClick={() =>
                    task.assigneePhone &&
                    openTaskWhatsApp(task.assigneePhone, { ...task, assigneeName: task.assigneeName ?? "", managerName: task.createdByName })
                  }
                >
                  <MessageCircle />
                  {task.assigneePhone ? `Notify ${task.assigneeName.split(/\s+/)[0]} on WhatsApp` : "No WhatsApp number on file"}
                </DropdownMenuItem>
                )}
                {perms.edit && (
                  <>
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      <Pencil /> {isManager ? "Edit or reassign" : "Edit task"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
                      <Trash2 /> Delete task
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div role="radiogroup" aria-label="Task status" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {TASK_STATUSES.map((s) => {
            const active = task.status === s;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={sending || !perms.changeStatus}
                title={perms.changeStatus ? undefined : "Only the person doing it, its creator or a manager can change status"}
                onClick={() => !active && send({ body: "", statusTo: s })}
                className={cn(
                  "flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed",
                  !perms.changeStatus && !active && "opacity-50",
                  active ? "bg-card text-foreground shadow-[0_1px_2px_rgb(0_31_64/0.12)]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("size-1.5 rounded-full", LAMP[TASK_LAMP[s]].dot)} aria-hidden />
                {TASK_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        <div className="flex gap-3">
          <Avatar name={task.createdByName} mine={false} />
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-semibold">{task.createdByName}</span>{" "}
              <span className="text-xs text-muted-foreground">
                assigned this · {DAY.format(new Date(task.createdAt))}, {TIME.format(new Date(task.createdAt))}
              </span>
            </p>
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">
              {task.description || "No extra details were added."}
            </p>
          </div>
        </div>

        <ol className="mt-4 flex flex-col">
          {updates.map((u, i) => {
            const prev = updates[i - 1];
            const at = new Date(u.createdAt);
            const newDay = !prev || DAY.format(new Date(prev.createdAt)) !== DAY.format(at);
            // Slack-style grouping: same author within 5 minutes shares one header.
            const grouped =
              !!prev && !newDay && !prev.statusTo && !u.statusTo && prev.authorId === u.authorId && at.getTime() - Date.parse(prev.createdAt) < 5 * 60_000;
            const mine = u.authorId === meId;
            return (
              <li key={u.id}>
                {i === firstNewIndex && (
                  <div className="my-2 flex items-center gap-2 text-xs font-semibold text-red-700" role="separator">
                    <span className="h-px flex-1 bg-red-600/40" />
                    New
                  </div>
                )}
                {newDay && (
                  <div className="my-3 flex items-center gap-3 text-xs font-medium text-muted-foreground" role="separator">
                    <span className="h-px flex-1 bg-border" />
                    {DAY.format(at)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {u.statusTo && (
                  <p className="my-1.5 flex items-center gap-2 pl-11 text-xs text-muted-foreground">
                    <span className={cn("size-2 rounded-full", LAMP[TASK_LAMP[u.statusTo]].dot)} aria-hidden />
                    <span>
                      <span className="font-semibold text-foreground">{statusChangeText(u.authorName, u.statusTo)}</span> · {TIME.format(at)}
                    </span>
                  </p>
                )}
                {u.body && (
                  <div className={cn("flex gap-3", grouped ? "mt-0.5" : "mt-3")}>
                    {grouped ? <span className="w-8 shrink-0" aria-hidden /> : <Avatar name={u.authorName} mine={mine} />}
                    <div className="min-w-0">
                      {!grouped && (
                        <p className="text-sm">
                          <span className="font-semibold">{mine ? "You" : u.authorName}</span>{" "}
                          <span className="text-xs text-muted-foreground">{TIME.format(at)}</span>
                        </p>
                      )}
                      <p className="text-sm break-words whitespace-pre-wrap">{u.body}</p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        {updates.length === 0 && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No updates yet. Post progress, questions or blockers below.
          </p>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t bg-card p-3 sm:px-5">
        <div className="flex items-end gap-2 rounded-lg border border-input bg-card p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            maxLength={5000}
            aria-label="Write an update"
            placeholder={perms.changeStatus ? `Update on #${task.num}…` : `Comment on #${task.num}…`}
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-1.5 py-1.5 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={sending || !body.trim()} aria-label="Send update">
            <SendHorizontal />
          </Button>
        </div>
        <p className="mt-1.5 hidden text-xs text-muted-foreground sm:block">Enter to send · Shift + Enter for a new line</p>
      </form>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit task #{task.num}</DialogTitle>
          </DialogHeader>
          <TaskForm
            people={people}
            minDate={today}
            existing={task}
            isManager={isManager}
            meId={meId}
            action={(input) => editTask(task.id, input)}
            onSuccess={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete task #${task.num}?`}
        description={`“${task.title}” and its whole update thread will be removed for good.`}
        confirmLabel="Delete task"
        onConfirm={async () => {
          try {
            const r = await deleteTask(task.id);
            if (!r.ok) {
              toast.error(r.error);
              return false;
            }
          } catch {
            toast.error("Couldn't delete. Your session may have expired, so refresh the page.");
            return false;
          }
          toast.success("Task deleted");
          router.push(backHref);
        }}
      />
    </div>
  );
}
