import { ClipboardList, History } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO, parseISODate, fmtDay, fmtDayLong } from "@/lib/dates";
import { Board } from "@/components/nav";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { StatusBadge, type ActivityStatus } from "@/components/status-badge";
import { Section, EmptyState } from "@/components/section";
import { formatHours, WORKDAY_HOURS } from "@/lib/hours";

export const metadata = { title: "Dashboard" };

function serialize(r: {
  id: string;
  date: Date;
  activity: string;
  assignedBy: string;
  status: string;
  deadline: Date | null;
  timeTaken: unknown;
}) {
  return {
    id: r.id,
    date: dateToISO(r.date),
    activity: r.activity,
    assignedBy: r.assignedBy,
    status: r.status as ActivityStatus,
    deadline: r.deadline ? dateToISO(r.deadline) : null,
    timeTaken: Number(r.timeTaken),
  };
}

type Row = ReturnType<typeof serialize>;

function EntryMeta({ r }: { r: Row }) {
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      Assigned by {r.assignedBy}
      {r.deadline && <> · Due {fmtDay(r.deadline)}</>}
    </p>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const today = todayISO();

  const [todayRaw, recentRaw, pending, inProgress] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: user.id, date: parseISODate(today) },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({
      where: { userId: user.id, date: { lt: parseISODate(today) } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.activity.count({ where: { userId: user.id, status: "PENDING" } }),
    prisma.activity.count({ where: { userId: user.id, status: "IN_PROGRESS" } }),
  ]);

  const todayRows = todayRaw.map(serialize);
  const recentRows = recentRaw.map(serialize);
  const hoursToday = todayRows.reduce((sum, r) => sum + r.timeTaken, 0);
  const firstName = user.name.split(/\s+/)[0] || "there";

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title={`Hello, ${firstName}`}
        subtitle={fmtDayLong(today)}
        action={<AddActivityDialog maxDate={today} />}
        counters={[
          {
            label: "Hours logged today",
            value: formatHours(hoursToday),
            digits: 4,
            tone: hoursToday >= WORKDAY_HOURS ? "white" : "amber",
            hint: `of ${WORKDAY_HOURS}`,
            primary: true,
          },
          { label: "Entries today", value: todayRows.length, digits: 2, tone: "white" },
          { label: "Pending", value: pending, digits: 3, tone: pending > 0 ? "amber" : "white" },
          { label: "In progress", value: inProgress, digits: 3, tone: "white" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Section
          flush
          title="Today"
          description={todayRows.length ? "Everything you've logged for today." : undefined}
        >
          {todayRows.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title="Nothing logged today yet"
              action={<AddActivityDialog maxDate={today} variant="default" />}
            >
              Add each piece of work as you finish it. It takes under a minute.
            </EmptyState>
          ) : (
            <>
              <ul className="divide-y">
                {todayRows.map((r) => (
                  <li key={r.id} className="flex items-start gap-4 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium break-words">{r.activity}</p>
                      <EntryMeta r={r} />
                    </div>
                    <StatusBadge status={r.status} className="mt-0.5 hidden sm:inline-flex" />
                    <p className="w-16 shrink-0 text-right font-medium tabular-nums">{formatHours(r.timeTaken)} h</p>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3 text-sm sm:px-5">
                <span className="text-muted-foreground">
                  {hoursToday >= WORKDAY_HOURS
                    ? "Full day logged."
                    : `${formatHours(WORKDAY_HOURS - hoursToday)} h left to reach a full day.`}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatHours(hoursToday)} / {WORKDAY_HOURS} h
                </span>
              </div>
            </>
          )}
        </Section>

        <Section
          flush
          title="Earlier"
          description="Your last 10 entries before today."
          actions={
            <Link href="/activities" className="text-sm font-medium text-primary hover:underline">
              Full history
            </Link>
          }
        >
          {recentRows.length === 0 ? (
            <EmptyState icon={<History />} title="No earlier entries">
              Entries from previous days will show up here.
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {recentRows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1.5 px-4 py-3.5 sm:grid-cols-[5.5rem_1fr_auto_4rem] sm:px-5"
                >
                  <p className="text-sm text-muted-foreground tabular-nums sm:pt-px">{fmtDay(r.date)}</p>
                  <p className="text-right font-medium tabular-nums sm:order-last">{formatHours(r.timeTaken)} h</p>
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <p className="font-medium break-words">{r.activity}</p>
                    <EntryMeta r={r} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <StatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </main>
    </div>
  );
}
