import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { CalendarClock, ChevronDown, ListTodo, MessagesSquare } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dateToISO, fmtDay, parseISODate, todayISO } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import {
  canChangeTaskStatus,
  canEditTask,
  canReleaseTask,
  canTakeUpTask,
  canViewTask,
  isTaskOverdue,
  isTaskUnread,
  statusChangeText,
  type TaskStatus,
} from "@/lib/tasks";
import { involvedWhere, unreadTaskCount, visibleTasksWhere } from "@/lib/task-queries";
import { Board } from "@/components/nav";
import { EmptyState } from "@/components/section";
import { AssignTaskDialog } from "@/components/assign-task-dialog";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { TaskThread } from "@/components/task-thread";
import { LiveRefresh } from "@/components/live-refresh";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tasks" };

const VIEWS = {
  open: { label: "Open", where: { status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } } },
  blocked: { label: "Blocked", where: { status: "BLOCKED" } },
  done: { label: "Done", where: { status: "DONE" } },
} satisfies Record<string, { label: string; where: Prisma.TaskWhereInput }>;
type View = keyof typeof VIEWS;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const isManager = user.role === "MANAGER";
  const today = todayISO();

  const params = await searchParams;
  const get = (k: string) => (typeof params[k] === "string" && params[k] ? (params[k] as string) : undefined);
  const view: View = (get("view") as View) in VIEWS ? (get("view") as View) : "open";
  const who = isManager ? get("who") : undefined;
  const selectedId = get("t");
  // Scope: your own tasks, the shared team board, or (managers) everything.
  const scopes = isManager ? (["all", "board", "mine"] as const) : (["mine", "board"] as const);
  type Scope = (typeof scopes)[number];
  const scope: Scope = (scopes as readonly string[]).includes(get("scope") ?? "") ? (get("scope") as Scope) : scopes[0];
  const SCOPE_LABEL: Record<Scope, string> = { all: "All", board: "Team board", mine: isManager ? "Mine" : "My tasks" };
  const scopeWhere: Prisma.TaskWhereInput =
    scope === "board" ? { shared: true } : scope === "mine" ? involvedWhere(user) : {};

  const base: Prisma.TaskWhereInput = {
    AND: [visibleTasksWhere(user), scopeWhere, who ? { assigneeId: who } : {}],
  };
  const openWhere: Prisma.TaskWhereInput = { AND: [base, VIEWS.open.where] };
  const grabsWhere: Prisma.TaskWhereInput = { AND: [visibleTasksWhere(user), VIEWS.open.where, { assigneeId: null, shared: true }] };

  const [tasks, counts, overdue, people, selected, unread, upForGrabs] = await Promise.all([
    prisma.task.findMany({
      where: { AND: [base, VIEWS[view].where] },
      // Up-for-grabs first on the board, then most recent activity.
      orderBy: scope === "board" ? [{ assigneeId: { sort: "asc", nulls: "first" } }, { lastActivityAt: "desc" }] : { lastActivityAt: "desc" },
      take: 200,
      include: {
        assignee: { select: { name: true } },
        createdBy: { select: { name: true } },
        reads: { where: { userId: user.id }, select: { lastReadAt: true } },
        updates: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { select: { name: true } } } },
      },
    }),
    prisma.task.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.task.count({ where: { AND: [openWhere, { dueDate: { lt: parseISODate(today) } }] } }),
    isManager
      ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, designation: true, phone: true } })
      : Promise.resolve([]),
    selectedId
      ? prisma.task.findUnique({
          where: { id: selectedId },
          include: {
            assignee: { select: { name: true, phone: true } },
            createdBy: { select: { name: true } },
            reads: { where: { userId: user.id }, select: { lastReadAt: true } },
            updates: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
          },
        })
      : Promise.resolve(null),
    unreadTaskCount(user),
    prisma.task.count({ where: grabsWhere }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<TaskStatus, number>>;
  const openCount = (byStatus.TODO ?? 0) + (byStatus.IN_PROGRESS ?? 0) + (byStatus.BLOCKED ?? 0);
  const active = selected && canViewTask(user, selected) ? selected : null;
  const now = Date.now();

  const href = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { scope: scope === scopes[0] ? undefined : scope, view: view === "open" ? undefined : view, who, t: undefined, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return qs.size ? `/tasks?${qs.toString()}` : "/tasks";
  };

  return (
    <div className="flex min-h-svh flex-col">
      <LiveRefresh />
      <Board
        title="Tasks"
        subtitle={
          isManager
            ? "Assign work, follow every update in one thread per task."
            : "Your work and the team board. Add a task, or take one up that nobody has started."
        }
        action={<AssignTaskDialog people={people} today={today} managerName={user.name} isManager={isManager} meId={user.id} />}
        counters={[
          { label: SCOPE_LABEL[scope] === "All" ? "Open tasks" : `Open · ${SCOPE_LABEL[scope]}`, value: openCount, digits: 3, tone: "white", primary: true },
          { label: "Up for grabs", value: upForGrabs, digits: 3, tone: upForGrabs > 0 ? "amber" : "white" },
          { label: "Unread threads", value: unread, digits: 3, tone: unread > 0 ? "amber" : "white" },
          { label: "Overdue", value: overdue, digits: 3, tone: overdue > 0 ? "red" : "white" },
        ]}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_31_64/0.04)] lg:grid lg:h-[min(48rem,calc(100svh-3rem))] lg:grid-cols-[22rem_1fr]">
          {/* Task list */}
          <div className={cn("flex min-h-0 flex-col lg:border-r", active && "hidden lg:flex")}>
            <div className="flex flex-col gap-2 border-b p-3">
              <nav aria-label="Whose tasks" className="flex gap-1">
                {scopes.map((sc) => {
                  const on = sc === scope;
                  return (
                    <Link
                      key={sc}
                      href={href({ scope: sc === scopes[0] ? undefined : sc, view: undefined })}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {SCOPE_LABEL[sc]}
                      {sc === "board" && upForGrabs > 0 && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-xs tabular-nums",
                            on ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                          )}
                        >
                          {upForGrabs}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <nav aria-label="Filter tasks by status" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {(Object.keys(VIEWS) as View[]).map((v) => {
                  const n = v === "open" ? openCount : v === "blocked" ? (byStatus.BLOCKED ?? 0) : (byStatus.DONE ?? 0);
                  const on = v === view;
                  return (
                    <Link
                      key={v}
                      href={href({ view: v === "open" ? undefined : v })}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "flex min-h-8 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors",
                        on ? "bg-card text-foreground shadow-[0_1px_2px_rgb(0_31_64/0.12)]" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {VIEWS[v].label}
                      <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
                    </Link>
                  );
                })}
              </nav>
              {isManager && (
                <form method="GET" className="flex gap-2">
                  {view !== "open" && <input type="hidden" name="view" value={view} />}
                  {scope !== scopes[0] && <input type="hidden" name="scope" value={scope} />}
                  <div className="relative flex-1">
                    <select
                      name="who"
                      defaultValue={who ?? ""}
                      aria-label="Filter by person"
                      className="h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="">Everyone</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  </div>
                  <Button type="submit" variant="outline">
                    Show
                  </Button>
                </form>
              )}
            </div>

            {tasks.length === 0 ? (
              <EmptyState icon={<ListTodo />} title={view === "done" ? "Nothing finished yet" : "No tasks here"}>
                {scope === "board"
                  ? "Nothing on the team board. Use “Add task” to post one for anyone to pick up."
                  : isManager
                    ? "Use “Assign task” above to hand someone a piece of work."
                    : "Tasks assigned to you, or that you add or take up, show up here."}
              </EmptyState>
            ) : (
              <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                {tasks.map((t) => {
                  const due = t.dueDate ? dateToISO(t.dueDate) : null;
                  const late = isTaskOverdue(due, t.status, today);
                  const isUnread = isTaskUnread(t, t.reads[0]?.lastReadAt, user.id);
                  const last = t.updates[0];
                  const preview = last
                    ? last.statusTo && !last.body
                      ? statusChangeText(last.author.name, last.statusTo)
                      : `${last.authorId === user.id ? "You" : last.author.name}: ${last.body}`
                    : t.description || "No updates yet";
                  const on = active?.id === t.id;
                  return (
                    <li key={t.id}>
                      <Link
                        href={href({ t: t.id })}
                        aria-current={on ? "true" : undefined}
                        className={cn(
                          "relative flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                          on && "bg-accent/70 hover:bg-accent/70"
                        )}
                      >
                        {on && <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-muted-foreground">
                            {t.assignee ? (
                              <>
                                {t.assigneeId === user.id ? "You" : <span className="font-semibold text-foreground">{t.assignee.name}</span>}
                                {t.createdById !== t.assigneeId && ` · from ${t.createdById === user.id ? "you" : t.createdBy.name}`}
                              </>
                            ) : (
                              <>
                                <span className="font-semibold text-amber-800">Up for grabs</span> · from{" "}
                                {t.createdById === user.id ? "you" : t.createdBy.name}
                              </>
                            )}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(now - t.lastActivityAt.getTime())}</span>
                        </div>
                        <p className={cn("flex items-start gap-2 text-sm break-words", isUnread ? "font-bold" : "font-medium")}>
                          {isUnread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                          <span className="min-w-0">{t.title}</span>
                        </p>
                        <p className={cn("truncate text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>{preview}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs">
                          <TaskStatusBadge status={t.status} />
                          {t.shared && scope !== "board" && <span className="text-muted-foreground">Team board</span>}
                          {due && (
                            <span className={cn("inline-flex items-center gap-1", late ? "font-semibold text-red-700" : "text-muted-foreground")}>
                              <CalendarClock className="size-3" aria-hidden />
                              {late ? "Overdue" : "Due"} {fmtDay(due)}
                            </span>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Thread */}
          <div className={cn("min-h-0", active ? "flex h-[calc(100svh-2rem)] flex-col lg:h-auto" : "hidden lg:flex lg:flex-col")}>
            {active ? (
              <TaskThread
                key={active.id}
                task={{
                  id: active.id,
                  num: active.num,
                  title: active.title,
                  description: active.description,
                  status: active.status,
                  priority: active.priority,
                  dueDate: active.dueDate ? dateToISO(active.dueDate) : null,
                  assigneeId: active.assigneeId,
                  assigneeName: active.assignee?.name ?? null,
                  assigneePhone: active.assignee?.phone ?? null,
                  shared: active.shared,
                  createdByName: active.createdBy.name,
                  createdAt: active.createdAt.toISOString(),
                }}
                updates={active.updates.map((u) => ({
                  id: u.id,
                  authorId: u.authorId,
                  authorName: u.author.name,
                  body: u.body,
                  statusTo: u.statusTo,
                  createdAt: u.createdAt.toISOString(),
                }))}
                meId={user.id}
                perms={{
                  changeStatus: canChangeTaskStatus(user, active),
                  takeUp: canTakeUpTask(user, active),
                  release: canReleaseTask(user, active),
                  edit: canEditTask(user, active),
                  notify: isManager,
                }}
                isManager={isManager}
                people={people}
                lastReadAt={active.reads[0]?.lastReadAt.toISOString() ?? null}
                today={today}
                backHref={href({})}
              />
            ) : (
              <div className="m-auto">
                <EmptyState icon={<MessagesSquare />} title="Pick a task to see its thread">
                  Every update, question and status change for a task lives in one conversation.
                </EmptyState>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
