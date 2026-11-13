import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildActivityWhere, parseActivityFilters } from "@/lib/activity-query";
import { dateToISO, fmtDay, parseISODate, todayISO } from "@/lib/dates";
import { toManagerRow } from "@/lib/activity-row";
import { outstandingByVoucher, rateSinceISO, voucherStock } from "@/lib/vouchers";
import { VoucherOrderAlert } from "@/components/voucher-alert";
import { Pagination } from "@/components/pagination";
import { PAGE_SIZE, pageParam, pageWindow } from "@/lib/paging";
import { VoucherStockTable } from "@/components/voucher-stock-table";
import { formatHours } from "@/lib/hours";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/duration";
import { ticketNo } from "@/lib/whatsapp";
import { statusChangeText } from "@/lib/tasks";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { ActivityFilters as ActivityFiltersBar } from "@/components/activity-filters";
import { ManagerActivityTable } from "@/components/manager-activity-table";
import { LampBadge } from "@/components/status-badge";
import { RecentActivityFeed } from "@/components/recent-activity-feed";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Manager" };

const VOUCHER_ISSUES = 10;

const truncateTitle =(s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

export default async function ManagerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const params = await searchParams;
  const filters = parseActivityFilters(params);
  const page = pageParam(params);

  const [total, completed, pending, submittedToday, staffCount, activities] = await Promise.all([
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
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const today = todayISO();

  const rows = activities.map(toManagerRow);

  const [voucherEntries, voucherOrders, voucherIssues] = await Promise.all([
    prisma.voucherEntry.findMany({ select: { voucher: true, quantity: true, date: true } }),
    prisma.voucherOrder.findMany({ select: { voucher: true, quantity: true, receipts: { select: { quantity: true } } } }),
    prisma.voucherEntry.findMany({
      where: { quantity: { lt: 0 } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: VOUCHER_ISSUES,
      include: { user: { select: { name: true } } },
    }),
  ]);
  const vouchers = voucherStock(
    voucherEntries.map((e) => ({ voucher: e.voucher, quantity: e.quantity, date: dateToISO(e.date) })),
    rateSinceISO(todayISO()),
    outstandingByVoucher(voucherOrders)
  );

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


  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  const exportHref = "/api/export" + (qs.size ? `?${qs.toString()}` : "");

  const filtered = qs.size > 0;

  const activityPages = pageWindow(total, page);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(qs);
    if (n > 1) q.set("page", String(n));
    return `/manager${q.size ? `?${q}` : ""}#activities`;
  };
  // A stale link past the end (e.g. after deletions) lands on the last page instead of an empty one.
  if (page > activityPages.pageCount) redirect(pageHref(activityPages.pageCount));

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Manager"
        subtitle="All employee activity: filter, export, and open any person's report."
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
        <VoucherOrderAlert stock={vouchers} link />

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

        <div id="activities" className="scroll-mt-4">
          <Section
            flush
            title="Activities"
            description={
              total > PAGE_SIZE
                ? `${total} ${filtered ? "entries match the filters" : "entries"}, newest first.`
                : `${total} ${total === 1 ? "entry" : "entries"}${filtered ? " match the filters" : ""}.`
            }
          >
            <ManagerActivityTable rows={rows} />
            <Pagination window={activityPages} href={pageHref} label="Activity pages" />
          </Section>
        </div>

        <Section
          title="Exams"
          description="Registrations, exams conducted and certificate dispatch — on their own page."
          actions={
            <Link href="/exams" className="text-sm font-medium text-primary hover:underline">
              Open Exams
            </Link>
          }
        >
          <p className="text-sm text-muted-foreground">
            Staff log exam registrations and batches under My Activities. Open the Exams page for per-exam totals, urgent vs normal certificate
            dispatch, pass/fail/re-assessment figures and the full records.
          </p>
        </Section>

        <Section
          flush
          title="Vouchers"
          description={
            vouchers.length === 0
              ? "No voucher stock recorded yet."
              : `${vouchers.reduce((n, v) => n + v.inStock, 0)} in stock across ${vouchers.length} ${vouchers.length === 1 ? "voucher" : "vouchers"}. Staff issue them; every issue comes off the stock.`
          }
          actions={
            <Link href="/vouchers" className="text-sm font-medium text-primary hover:underline">
              Orders, stock and full history
            </Link>
          }
        >
          {vouchers.length > 0 && <VoucherStockTable stock={vouchers} />}
          {voucherIssues.length > 0 && (
            <>
              <p className="border-t bg-muted/30 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">
                Latest vouchers issued
              </p>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead>Voucher</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead>Issued to</TableHead>
                    <TableHead>Issued by</TableHead>
                    <TableHead className="pr-5">Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {voucherIssues.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-5 text-muted-foreground">{fmtDay(dateToISO(e.date))}</TableCell>
                      <TableCell className="font-medium">{e.voucher}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{-e.quantity}</TableCell>
                      <TableCell>
                        {e.issuedTo}
                        {e.channel && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{e.channel}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.user.name}</TableCell>
                      <TableCell className="max-w-56 truncate pr-5 text-muted-foreground" title={e.note ?? undefined}>
                        {e.note || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </Section>

        <RecentActivityFeed events={feedEvents} />
      </main>
    </div>
  );
}
