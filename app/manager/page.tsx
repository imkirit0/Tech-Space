import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildActivityWhere, parseActivityFilters } from "@/lib/activity-query";
import { dateToISO, fmtDay, fmtDayLong, parseISODate, todayISO } from "@/lib/dates";
import { examCountsByDate } from "@/lib/exam-counts";
import { toManagerRow } from "@/lib/activity-row";
import { formatHours } from "@/lib/hours";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/duration";
import { ticketNo } from "@/lib/whatsapp";
import { statusChangeText } from "@/lib/tasks";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { ActivityFilters as ActivityFiltersBar } from "@/components/activity-filters";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { LockPanel } from "@/components/lock-panel";
import { LampBadge } from "@/components/status-badge";
import { RecentActivityFeed } from "@/components/recent-activity-feed";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Manager" };

// ponytail: fixed on-screen cap; add pagination if managers need to browse past it (export has everything)
const TABLE_LIMIT = 200;
const EXAM_DAYS = 14;

const truncateTitle =(s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const filters = parseActivityFilters(await searchParams);
  const examScope = { employeeName: filters.employeeName, dateFrom: filters.dateFrom, dateTo: filters.dateTo };

  const [total, completed, pending, submittedToday, staffCount, activities, locks, examActivities, registrations] = await Promise.all([
    prisma.activity.count({ where: buildActivityWhere(filters) }),
    prisma.activity.count({ where: buildActivityWhere({ ...filters, status: "COMPLETED" }) }),
    prisma.activity.count({ where: buildActivityWhere({ ...filters, status: "PENDING" }) }),
    prisma.activity.findMany({
      where: { date: parseISODate(todayISO()) },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.activity.findMany({
      where: buildActivityWhere(filters),
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: TABLE_LIMIT,
    }),
    prisma.periodLock.findMany({
      include: { lockedBy: { select: { name: true } } },
      orderBy: { lockedAt: "desc" },
    }),
    // Exam counts follow only the date and employee filters, and are not capped by TABLE_LIMIT.
    prisma.activity.findMany({
      where: { AND: [buildActivityWhere(examScope), { activity: { contains: "exam", mode: "insensitive" } }] },
      select: { date: true, activity: true },
    }),
    prisma.registration.findMany({
      where: {
        date: {
          gte: examScope.dateFrom ? parseISODate(examScope.dateFrom) : undefined,
          lte: examScope.dateTo ? parseISODate(examScope.dateTo) : undefined,
        },
        ...(examScope.employeeName && { user: { name: { contains: examScope.employeeName, mode: "insensitive" } } }),
      },
      select: { date: true, program: true, count: true },
    }),
  ]);

  const exams = examCountsByDate(
    registrations.map((r) => ({ date: dateToISO(r.date), program: r.program, count: r.count })),
    examActivities.map((a) => ({ date: dateToISO(a.date), activity: a.activity }))
  );
  // ponytail: one column per date, newest EXAM_DAYS only; narrow with From/To to see older dates.
  const examDays = exams.days.slice(0, EXAM_DAYS);
  const examRows = exams.exams
    .map((exam) => ({ exam, total: examDays.reduce((s, d) => s + (d.counts.get(exam) ?? 0), 0) }))
    .filter((r) => r.total > 0);
  const sum = (counts: Map<string, number>) => [...counts.values()].reduce((s, n) => s + n, 0);
  const examGrandTotal = examRows.reduce((s, r) => s + r.total, 0);

  const rows = activities.map(toManagerRow);

  const [staff, hoursToday] = await Promise.all([
    prisma.user.findMany({
      where: { role: "EMPLOYEE", active: true },
      select: { id: true, name: true, designation: true },
      orderBy: { name: "asc" },
    }),
    prisma.activity.groupBy({
      by: ["userId"],
      where: { date: parseISODate(todayISO()) },
      _sum: { timeTaken: true },
    }),
  ]);
  const todayByUser = new Map(hoursToday.map((h) => [h.userId, Number(h._sum.timeTaken ?? 0)]));

  const [feedActivities, recentTickets, recentForwards, recentNotes, recentTaskUpdates] = await Promise.all([
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, employeeName: true, activity: true, createdAt: true },
    }),
    user.tech
      ? prisma.ticket.findMany({
          orderBy: { createdAt: "desc" },
          take: 15,
          select: {
            num: true,
            title: true,
            createdAt: true,
            createdBy: { select: { name: true } },
            takenAt: true,
            takenBy: { select: { name: true } },
            solvedAt: true,
            solvedBy: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    user.tech
      ? prisma.ticketForward.findMany({
          orderBy: { at: "desc" },
          take: 15,
          include: {
            by: { select: { name: true } },
            ticket: { select: { num: true, title: true } },
          },
        })
      : Promise.resolve([]),
    user.tech
      ? prisma.ticketNote.findMany({
          orderBy: { at: "desc" },
          take: 15,
          include: {
            by: { select: { name: true } },
            ticket: { select: { num: true } },
          },
        })
      : Promise.resolve([]),
    prisma.taskUpdate.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { author: { select: { name: true } }, task: { select: { num: true, title: true } } },
    }),
  ]);

  const events: { at: string; text: string }[] = [];

  for (const a of feedActivities) {
    events.push({
      at: a.createdAt.toISOString(),
      text: `${a.employeeName} logged “${truncateTitle(a.activity)}”`,
    });
  }

  for (const t of recentTickets) {
    const no = ticketNo(t.num);
    events.push({
      at: t.createdAt.toISOString(),
      text: `${no} “${truncateTitle(t.title)}” logged by ${t.createdBy.name}`,
    });
    if (t.takenAt && t.takenBy) {
      events.push({ at: t.takenAt.toISOString(), text: `${no} taken up by ${t.takenBy.name}` });
    }
    if (t.solvedAt && t.solvedBy) {
      const resolved = formatDuration(t.solvedAt.getTime() - t.createdAt.getTime());
      events.push({
        at: t.solvedAt.toISOString(),
        text: `${no} “${truncateTitle(t.title)}” solved by ${t.solvedBy.name} (resolved in ${resolved})`,
      });
    }
  }

  for (const f of recentForwards) {
    events.push({
      at: f.at.toISOString(),
      text: `${ticketNo(f.ticket.num)} forwarded to ${f.to} by ${f.by.name}`,
    });
  }

  for (const u of recentTaskUpdates) {
    events.push({
      at: u.createdAt.toISOString(),
      text: u.statusTo
        ? `Task #${u.task.num} “${truncateTitle(u.task.title)}”: ${statusChangeText(u.author.name, u.statusTo)}`
        : `${u.author.name} on task #${u.task.num}: “${truncateTitle(u.body)}”`,
    });
  }

  for (const n of recentNotes) {
    events.push({
      at: n.at.toISOString(),
      text: `${ticketNo(n.ticket.num)} follow-up by ${n.by.name}: “${truncateTitle(n.note)}”`,
    });
  }

  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const feedEvents = events.slice(0, 15);

  const serializedLocks = locks.map((l) => ({
    id: l.id,
    label: l.label,
    startDate: dateToISO(l.startDate),
    endDate: dateToISO(l.endDate),
    reason: l.reason,
    lockedByName: l.lockedBy.name,
    lockedAt: l.lockedAt.toISOString(),
  }));

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  const exportHref = "/api/export" + (qs.size ? `?${qs.toString()}` : "");

  const filtered = qs.size > 0;

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Manager"
        subtitle="All employee activity: filter, export, and lock reporting periods."
        action={
          <a href={exportHref} className={buttonVariants({ variant: "board", size: "lg" })}>
            <Download className="size-4" aria-hidden />
            Export to Excel
          </a>
        }
        counters={[
          { label: filtered ? "Matching activities" : "Total activities", value: total, digits: 5, tone: "white" },
          { label: "Completed", value: completed, digits: 5, tone: "white" },
          { label: "Pending", value: pending, digits: 5, tone: pending > 0 ? "amber" : "white", primary: true },
          {
            label: "Staff submitted today",
            value: submittedToday.length,
            digits: 3,
            tone: submittedToday.length < staffCount ? "red" : "white",
            hint: staffCount ? `of ${staffCount}` : undefined,
          },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        {staff.length > 0 && (
          <Section title="Staff" description="Open a person to see their full report: work, hours, tasks, tickets and registrations.">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((p) => {
                const h = todayByUser.get(p.id);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/manager/staff/${p.id}`}
                      className="group flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.designation || "Staff"}</p>
                        <p className="mt-1.5">
                          <LampBadge lamp={h === undefined ? "amber" : "green"}>
                            {h === undefined ? "Nothing logged today" : `${formatHours(h)} h logged today`}
                          </LampBadge>
                        </p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title="Filter activities">
          <ActivityFiltersBar key={qs.toString() || "empty"} />
        </Section>

        <Section
          flush
          title="Activities"
          description={
            total > rows.length
              ? `Showing the newest ${rows.length} of ${total}. Narrow the filters, or export to see them all.`
              : `${total} ${total === 1 ? "entry" : "entries"}${filtered ? " match the filters" : ""}.`
          }
        >
          <ManagerActivityTable rows={rows} />
        </Section>

        {examDays.length > 0 && (
          <Section
            flush
            title="Examination registrations"
            description={
              (exams.days.length > examDays.length
                ? `Latest ${examDays.length} of ${exams.days.length} dates; set From and To above to see others.`
                : `${examRows.length} ${examRows.length === 1 ? "examination" : "examinations"} across ${examDays.length} ${examDays.length === 1 ? "date" : "dates"}.`) +
              " Logged by staff under My Activities; follows the Employee, From and To filters."
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead className="sticky left-0 z-10 bg-muted pl-5">Examination</TableHead>
                  {examDays.map((d) => (
                    <TableHead key={d.date} className="text-right" title={fmtDayLong(d.date)}>
                      {fmtDay(d.date)}
                    </TableHead>
                  ))}
                  <TableHead className="pr-5 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examRows.map((r) => (
                  <TableRow key={r.exam} className="group">
                    <TableCell className="sticky left-0 z-10 bg-card pl-5 font-medium group-hover:bg-muted">
                      {r.exam}
                    </TableCell>
                    {examDays.map((d) => (
                      <TableCell key={d.date} className="text-right tabular-nums">
                        {d.counts.get(r.exam) ?? <span className="text-muted-foreground/60">–</span>}
                      </TableCell>
                    ))}
                    <TableCell className="pr-5 text-right font-semibold tabular-nums">{r.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="sticky left-0 z-10 bg-muted pl-5 font-semibold">All examinations</TableCell>
                  {examDays.map((d) => (
                    <TableCell key={d.date} className="text-right font-semibold tabular-nums">
                      {sum(d.counts)}
                    </TableCell>
                  ))}
                  <TableCell className="pr-5 text-right font-semibold tabular-nums">{examGrandTotal}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Section>
        )}

        <RecentActivityFeed events={feedEvents} />

        <Section
          flush
          title="Period locks"
          description="Lock a month or date range after review. Employees can't change entries in it afterwards."
        >
          <LockPanel locks={serializedLocks} />
        </Section>
      </main>
    </div>
  );
}
