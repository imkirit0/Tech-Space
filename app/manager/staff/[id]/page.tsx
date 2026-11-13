import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dateToISO, fmtDay, fmtDayLong, parseISODate, periodRange, todayISO } from "@/lib/dates";
import { formatHours, WORKDAY_HOURS } from "@/lib/hours";
import { formatDuration } from "@/lib/duration";
import { ticketNo } from "@/lib/whatsapp";
import { isTaskOverdue } from "@/lib/tasks";
import { toManagerRow } from "@/lib/activity-row";
import { Board } from "@/components/nav";
import { Section, EmptyState } from "@/components/section";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { STATUSES, StatusBadge } from "@/components/status-badge";
import { TaskStatusBadge } from "@/components/task-status-badge";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/ticket-badges";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Staff report" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function StaffReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const { id } = await params;
  const person = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, designation: true, active: true },
  });
  if (!person) notFound();

  // Period: ?from=&to=, defaulting to this month so far.
  const sp = await searchParams;
  const today = todayISO();
  const iso = (key: string) => {
    const v = sp[key];
    return typeof v === "string" && ISO_DATE.test(v) ? v : undefined;
  };
  let from = iso("from") ?? periodRange(today, "month")[0];
  let to = iso("to") ?? today;
  if (from > to) [from, to] = [to, from];

  const days = { gte: parseISODate(from), lte: parseISODate(to) };
  // Timestamps (not calendar dates) are compared against the IST day boundaries.
  const stamps = { gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59.999+05:30`) };

  const [activities, registrations, tasks, tickets] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: id, date: days },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.registration.findMany({ where: { userId: id, date: days }, select: { program: true, count: true } }),
    // Everything still open, plus whatever they finished in the period.
    prisma.task.findMany({
      where: { assigneeId: id, OR: [{ status: { not: "DONE" } }, { completedAt: stamps }] },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.ticket.findMany({
      where: {
        OR: [
          { createdById: id, createdAt: stamps },
          { takenById: id, takenAt: stamps },
          { solvedById: id, solvedAt: stamps },
        ],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows = activities.map(toManagerRow);
  const hours = rows.reduce((s, r) => s + r.timeTaken, 0);
  const byStatus = STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length] as const).filter(([, n]) => n > 0);
  const completed = rows.filter((r) => r.status === "COMPLETED").length;

  // One line per logged day, newest first (rows are already in that order).
  const byDay = new Map<string, { entries: number; done: number; hours: number }>();
  for (const r of rows) {
    const d = byDay.get(r.date!) ?? { entries: 0, done: 0, hours: 0 };
    byDay.set(r.date!, d);
    d.entries++;
    d.hours += r.timeTaken;
    if (r.status === "COMPLETED") d.done++;
  }

  const examTotals = new Map<string, number>();
  for (const r of registrations) examTotals.set(r.program, (examTotals.get(r.program) ?? 0) + r.count);
  const examRows = [...examTotals].sort((a, b) => a[0].localeCompare(b[0]));
  const registered = registrations.reduce((s, r) => s + r.count, 0);

  const openTasks = tasks.filter((t) => t.status !== "DONE");
  const overdue = openTasks.filter((t) => isTaskOverdue(t.dueDate ? dateToISO(t.dueDate) : null, t.status, today));
  const inPeriod = (d: Date | null) => !!d && d >= stamps.gte && d <= stamps.lte;
  const ticketRows = tickets.map((t) => {
    const did: string[] = [];
    if (t.createdById === id && inPeriod(t.createdAt)) did.push("Logged");
    if (t.takenById === id && inPeriod(t.takenAt)) did.push("Took up");
    if (t.solvedById === id && inPeriod(t.solvedAt))
      did.push(`Solved in ${formatDuration(t.solvedAt!.getTime() - t.createdAt.getTime())}`);
    return { ...t, did };
  });
  const solved = ticketRows.filter((t) => t.did.some((d) => d.startsWith("Solved"))).length;

  const periodLabel = from === to ? fmtDayLong(from) : `${fmtDayLong(from)} – ${fmtDayLong(to)}`;
  const firstName = person.name.split(/\s+/)[0];
  const href = (r: [string, string]) => `/manager/staff/${id}?from=${r[0]}&to=${r[1] > today ? today : r[1]}`;
  const presets: [string, [string, string]][] = [
    ["Today", [today, today]],
    ["This week", periodRange(today, "week")],
    ["This month", periodRange(today, "month")],
  ];

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title={person.name}
        subtitle={`${person.designation || "Staff"}${person.active ? "" : " · account switched off"} · ${periodLabel}`}
        action={
          <Link href="/manager" className={buttonVariants({ variant: "board", size: "lg" })}>
            <ArrowLeft className="size-4" aria-hidden />
            All staff
          </Link>
        }
        counters={[
          { label: "Hours logged", value: formatHours(hours), digits: 5, tone: "white", primary: true },
          { label: "Activities", value: rows.length, digits: 4, tone: "white" },
          { label: "Days logged", value: byDay.size, digits: 3, tone: "white" },
          { label: "Open tasks", value: openTasks.length, digits: 3, tone: overdue.length ? "red" : "white", hint: overdue.length ? `${overdue.length} overdue` : undefined },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <form method="GET" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5">
          <div className="flex flex-col gap-1.5 sm:w-44">
            <label htmlFor="from" className="text-sm font-medium">
              From
            </label>
            <Input id="from" name="from" type="date" defaultValue={from} max={today} />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-44">
            <label htmlFor="to" className="text-sm font-medium">
              To
            </label>
            <Input id="to" name="to" type="date" defaultValue={to} max={today} />
          </div>
          <Button type="submit">Show</Button>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            {presets.map(([label, r]) => (
              <Link key={label} href={href(r)} className={buttonVariants({ variant: "outline" })}>
                {label}
              </Link>
            ))}
          </div>
        </form>

        <Section title="Summary" description={periodLabel}>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{firstName} logged no activities in this period.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p>
                {firstName} logged <strong>{plural(rows.length, "activity", "activities")}</strong> over{" "}
                <strong>{plural(byDay.size, "day")}</strong>, <strong>{formatHours(hours)} hours</strong> in all (
                {formatHours(hours / byDay.size)} h per logged day, against a {WORKDAY_HOURS} h day). {completed} of{" "}
                {rows.length} are completed.
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {byStatus.map(([status, n]) => (
                  <li key={status} className="flex items-center gap-1.5">
                    <StatusBadge status={status} />
                    <span className="font-medium tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-sm sm:grid-cols-4">
            <Fact label="Exam registrations" value={registered} />
            <Fact label="Open tasks" value={openTasks.length} note={overdue.length ? `${overdue.length} overdue` : undefined} />
            <Fact label="Tasks finished" value={tasks.length - openTasks.length} />
            <Fact label="Tickets solved" value={solved} />
          </dl>
        </Section>

        {byDay.size > 0 && (
          <Section flush title="Day by day" description="Hours and entries for each day they logged.">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead className="text-right">Entries</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="pr-5">Against {WORKDAY_HOURS} h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...byDay].map(([date, d]) => (
                  <TableRow key={date}>
                    <TableCell className="pl-5">{fmtDayLong(date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.entries}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.done}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatHours(d.hours)}</TableCell>
                    <TableCell className={cn("pr-5", d.hours >= WORKDAY_HOURS ? "text-emerald-700" : "text-amber-700")}>
                      {d.hours >= WORKDAY_HOURS ? "Full day" : `${formatHours(WORKDAY_HOURS - d.hours)} h short`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        )}

        <Section
          flush
          title="Activities"
          description={`${plural(rows.length, "entry", "entries")}. Click one for its description, timestamps and your comment.`}
        >
          <ManagerActivityTable rows={rows} />
        </Section>

        <Section flush title="Examination registrations" description={periodLabel}>
          {examRows.length === 0 ? (
            <EmptyState title="No registrations logged in this period" />
          ) : (
            <Table>
              <TableBody>
                {examRows.map(([exam, n]) => (
                  <TableRow key={exam}>
                    <TableCell className="pl-5 font-medium">{exam}</TableCell>
                    <TableCell className="pr-5 text-right tabular-nums">{n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-5 font-semibold">Total</TableCell>
                  <TableCell className="pr-5 text-right font-semibold tabular-nums">{registered}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </Section>

        <Section flush title="Tasks" description="Everything still open, plus tasks finished in this period.">
          {tasks.length === 0 ? (
            <EmptyState title="No tasks assigned" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-5">Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="pr-5">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t) => {
                  const due = t.dueDate ? dateToISO(t.dueDate) : null;
                  const late = isTaskOverdue(due, t.status, today);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-96 pl-5">
                        <p className="truncate font-medium" title={t.title}>
                          <span className="text-muted-foreground">#{t.num}</span> {t.title}
                        </p>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell className={cn("pr-5", late ? "font-medium text-red-700" : "text-muted-foreground")}>
                        {due ? `${fmtDay(due)}${late ? " · overdue" : ""}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section flush title="Tickets" description="Tickets they logged, took up or solved in this period.">
          {ticketRows.length === 0 ? (
            <EmptyState title="No ticket work in this period" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-5">Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5">What they did</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketRows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-96 pl-5">
                      <p className="truncate font-medium" title={t.title}>
                        <span className="text-muted-foreground">{ticketNo(t.num)}</span> {t.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="pr-5 text-muted-foreground">{t.did.join(" · ")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </main>
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
        {value}
        {note && <span className="ml-2 text-xs font-medium text-red-700">{note}</span>}
      </dd>
    </div>
  );
}
