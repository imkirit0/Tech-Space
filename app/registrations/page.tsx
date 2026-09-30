import { redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronDown, ClipboardList } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO, dateToISO, parseISODate, periodRange, fmtDay, fmtDayLong } from "@/lib/dates";
import { Board } from "@/components/nav";
import { Section, EmptyState } from "@/components/section";
import { AddRegistrationDialog, DeleteRegistrationButton } from "@/components/registration-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata = { title: "Registrations" };

type Period = "day" | "week" | "month";
const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];
// Suggested in the program box until someone logs them; any other name works too.
const DEFAULT_PROGRAMS = ["Tally", "IAB", "MOS"];

const selectClass =
  "h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const isManager = user.role === "MANAGER";

  const params = await searchParams;
  const get = (key: string): string | undefined => {
    const v = params[key];
    return typeof v === "string" && v ? v : undefined;
  };
  const today = todayISO();
  const period: Period = PERIODS.some((p) => p.key === get("period")) ? (get("period") as Period) : "day";
  const dateParam = get("date");
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today ? dateParam : today;
  // Staff see their own figures; managers see everyone, or one person.
  const who = isManager ? get("who") : user.id;
  const scope: Prisma.RegistrationWhereInput = who ? { userId: who } : {};

  const [start, end] = periodRange(date, period);
  const between = (r: [string, string]) => ({ gte: parseISODate(r[0]), lte: parseISODate(r[1]) });
  const sumFor = (r: [string, string]) =>
    prisma.registration.aggregate({ where: { ...scope, date: between(r) }, _sum: { count: true } });

  const [entries, dayTotal, weekTotal, monthTotal, used, people] = await Promise.all([
    prisma.registration.findMany({
      where: { ...scope, date: between([start, end]) },
      include: { user: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { program: "asc" }],
    }),
    sumFor(periodRange(today, "day")),
    sumFor(periodRange(today, "week")),
    sumFor(periodRange(today, "month")),
    prisma.registration.findMany({ distinct: ["program"], select: { program: true }, orderBy: { program: "asc" } }),
    isManager
      ? prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  const programs = used.map((u) => u.program);
  for (const d of DEFAULT_PROGRAMS)
    if (!programs.some((p) => p.toLowerCase() === d.toLowerCase())) programs.push(d);

  const tally = (key: (e: (typeof entries)[number]) => string) => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(key(e), (m.get(key(e)) ?? 0) + e.count);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const byProgram = tally((e) => e.program);
  const byStaff = tally((e) => e.user.name);
  const periodTotal = entries.reduce((s, e) => s + e.count, 0);
  const showStaff = isManager && !who;

  const hrefWith = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { period, date: date === today ? undefined : date, who: isManager ? who : undefined, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return qs.size ? `/registrations?${qs.toString()}` : "/registrations";
  };
  const rangeLabel = start === end ? fmtDayLong(start) : `${fmtDay(start)} – ${fmtDay(end)}`;

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Registrations"
        subtitle={isManager ? "Daily sign-ups logged by the team, per program." : "Your daily sign-ups, per program."}
        action={<AddRegistrationDialog today={today} programs={programs} />}
        counters={[
          { label: "Today", value: dayTotal._sum.count ?? 0, digits: 4, tone: "white", primary: true },
          { label: "This week", value: weekTotal._sum.count ?? 0, digits: 4, tone: "white" },
          { label: "This month", value: monthTotal._sum.count ?? 0, digits: 4, tone: "white" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <form method="GET" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5">
          <input type="hidden" name="period" value={period} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Period</span>
            <div className="flex h-9 rounded-lg border p-0.5" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <Link
                  key={p.key}
                  href={hrefWith({ period: p.key })}
                  aria-current={period === p.key ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-md px-3 text-sm font-medium transition-colors",
                    period === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-44">
            <label htmlFor="date" className="text-sm font-medium">
              {period === "day" ? "Date" : "Any date in the " + period}
            </label>
            <Input id="date" name="date" type="date" defaultValue={date} max={today} />
          </div>
          {isManager && (
            <div className="flex flex-col gap-1.5 sm:w-52">
              <label htmlFor="who" className="text-sm font-medium">
                Staff
              </label>
              <div className="relative">
                <select id="who" name="who" defaultValue={who ?? ""} className={selectClass}>
                  <option value="">Everyone</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              </div>
            </div>
          )}
          <Button type="submit">Show</Button>
        </form>

        {entries.length === 0 ? (
          <Section title={rangeLabel}>
            <EmptyState icon={<ClipboardList />} title="No registrations logged">
              Nothing for this {period} yet. Use “Add registrations” to log today's numbers.
            </EmptyState>
          </Section>
        ) : (
          <>
            <div className={cn("grid gap-4", showStaff && "lg:grid-cols-2")}>
              <TotalsTable title="By program" description={rangeLabel} rows={byProgram} total={periodTotal} />
              {showStaff && <TotalsTable title="By staff" description={rangeLabel} rows={byStaff} total={periodTotal} />}
            </div>
            <Section title="Entries" description={rangeLabel} flush>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="pl-5">Date</TableHead>
                    {isManager && <TableHead>Staff</TableHead>}
                    <TableHead>Program</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="w-12 pr-5">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-5">{fmtDay(dateToISO(e.date))}</TableCell>
                      {isManager && <TableCell>{e.user.name}</TableCell>}
                      <TableCell className="font-medium">{e.program}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.count}</TableCell>
                      <TableCell className="pr-5">
                        <DeleteRegistrationButton
                          id={e.id}
                          label={`${e.program}: ${e.count} on ${fmtDay(dateToISO(e.date))} (${e.user.name})`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function TotalsTable({
  title,
  description,
  rows,
  total,
}: {
  title: string;
  description: string;
  rows: [string, number][];
  total: number;
}) {
  return (
    <Section title={title} description={description} flush>
      <Table>
        <TableBody>
          {rows.map(([name, n]) => (
            <TableRow key={name}>
              <TableCell className="pl-5 font-medium">{name}</TableCell>
              <TableCell className="pr-5 text-right tabular-nums">{n}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="pl-5 font-semibold">Total</TableCell>
            <TableCell className="pr-5 text-right font-semibold tabular-nums">{total}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Section>
  );
}
