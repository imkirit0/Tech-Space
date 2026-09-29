import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildActivityWhere, parseActivityFilters } from "@/lib/activity-query";
import { dateToISO, parseISODate, todayISO } from "@/lib/dates";
import { formatDuration } from "@/lib/duration";
import { ticketNo } from "@/lib/whatsapp";
import { statusChangeText } from "@/lib/tasks";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { ActivityFilters as ActivityFiltersBar } from "@/components/activity-filters";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { LockPanel } from "@/components/lock-panel";
import { RecentActivityFeed } from "@/components/recent-activity-feed";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Manager" };

// ponytail: fixed on-screen cap; add pagination if managers need to browse past it (export has everything)
const TABLE_LIMIT = 200;

const truncateTitle = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const filters = parseActivityFilters(await searchParams);

  const [total, completed, pending, submittedToday, staffCount, activities, locks] = await Promise.all([
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
  ]);

  const rows = activities.map((a) => ({
    id: a.id,
    date: a.date ? dateToISO(a.date) : null,
    employeeName: a.employeeName,
    designation: a.designation,
    activity: a.activity,
    description: a.description,
    status: a.status,
    assignedBy: a.assignedBy,
    timeTaken: Number(a.timeTaken),
    deadline: a.deadline ? dateToISO(a.deadline) : null,
  }));

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
