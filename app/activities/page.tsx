import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO } from "@/lib/dates";
import { isLocked } from "@/lib/period-lock";
import { formatHours } from "@/lib/hours";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { AddActivityDialog } from "@/components/add-activity-dialog";
import { ActivityHistory } from "@/components/activity-history";

export const metadata = { title: "My Activities" };

export default async function ActivitiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const today = todayISO();
  const month = today.slice(0, 7);

  const [activities, locks] = await Promise.all([
    prisma.activity.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { createdAt: "asc" }] }),
    prisma.periodLock.findMany({ select: { startDate: true, endDate: true } }),
  ]);

  const rows = activities.map((r) => {
    const date = dateToISO(r.date);
    return {
      id: r.id,
      date,
      activity: r.activity,
      description: r.description,
      assignedBy: r.assignedBy,
      status: r.status,
      deadline: r.deadline ? dateToISO(r.deadline) : null,
      timeTaken: Number(r.timeTaken),
      locked: isLocked(date, locks),
    };
  });

  const thisMonth = rows.filter((r) => r.date.startsWith(month));
  const monthHours = thisMonth.reduce((s, r) => s + r.timeTaken, 0);
  const daysLogged = new Set(thisMonth.map((r) => r.date)).size;
  const monthName = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", timeZone: "UTC" });

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="My Activities"
        subtitle="Your full history. Entries in a locked reporting period are read-only."
        action={<AddActivityDialog maxDate={today} />}
        counters={[
          { label: `Hours in ${monthName}`, value: formatHours(monthHours), digits: 5, tone: "white" },
          { label: `Days logged in ${monthName}`, value: daysLogged, digits: 2, tone: "white" },
          { label: "All-time entries", value: rows.length, digits: 4, tone: "white" },
          { label: "Locked", value: rows.filter((r) => r.locked).length, digits: 4, tone: "white" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Section flush>
          <ActivityHistory rows={rows} maxDate={today} />
        </Section>
      </main>
    </div>
  );
}
