import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  label as fmtLabel,
  type TicketStatus,
  type TicketPriority,
  type TicketCategory,
} from "@/components/ticket-badges";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { TicketsTable, type TicketRow } from "@/components/tickets-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Tickets" };

const STATUS_ORDER: Record<TicketStatus, number> = { OPEN: 0, TAKEN_UP: 1, FORWARDED: 2, SOLVED: 3, DUPLICATE: 4 };
const PRIORITY_ORDER: Record<TicketPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Native select styled to match the shadcn Input for a consistent filter bar.
const selectClass =
  "h-9 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const TAB_ORDER: TicketStatus[] = ["OPEN", "TAKEN_UP", "FORWARDED", "SOLVED", "DUPLICATE"];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.tech) redirect("/");

  const params = await searchParams;
  const get = (key: string): string | undefined => {
    const v = params[key];
    return typeof v === "string" && v ? v : undefined;
  };

  const statusParam = get("status");
  const priorityParam = get("priority");
  const status = statusParam && TICKET_STATUSES.includes(statusParam as TicketStatus) ? (statusParam as TicketStatus) : undefined;
  const priority =
    priorityParam && TICKET_PRIORITIES.includes(priorityParam as TicketPriority) ? (priorityParam as TicketPriority) : undefined;
  const categoryParam = get("category");
  const category =
    categoryParam && TICKET_CATEGORIES.includes(categoryParam as TicketCategory) ? (categoryParam as TicketCategory) : undefined;
  const q = get("q");

  const baseWhere: Prisma.TicketWhereInput = {};
  if (priority) baseWhere.priority = priority;
  if (category) baseWhere.category = category;
  if (q) {
    baseWhere.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { contactPhone: { contains: q, mode: "insensitive" } },
      { assetId: { contains: q, mode: "insensitive" } },
      { ipAddress: { contains: q, mode: "insensitive" } },
    ];
  }
  const where: Prisma.TicketWhereInput = status ? { ...baseWhere, status } : baseWhere;

  const [tickets, byStatus, solvedTodayCount] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        takenBy: { select: { name: true } },
        solvedBy: { select: { name: true } },
        createdBy: { select: { name: true } },
        forwards: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
        notes: { orderBy: { at: "desc" }, take: 1, select: { at: true } },
      },
    }),
    prisma.ticket.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    // solvedAt is a real timestamp, so anchor to the true start of the IST day
    // (parseISODate would give UTC midnight — 5.5h late).
    prisma.ticket.count({
      where: { ...baseWhere, status: "SOLVED", solvedAt: { gte: new Date(`${todayISO()}T00:00:00+05:30`) } },
    }),
  ]);

  // ponytail: in-memory sort, move to SQL ordering if ticket volume grows
  tickets.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const rows: TicketRow[] = tickets.map((t) => {
    const fwdAt = t.forwards[0]?.at.getTime();
    const noteAt = t.notes[0]?.at.getTime();
    // ponytail: fixed 48h
    const quietSince =
      fwdAt !== undefined || noteAt !== undefined
        ? Math.max(fwdAt ?? 0, noteAt ?? 0)
        : (t.takenAt ?? t.createdAt).getTime();
    const needsFollowUp = t.status === "FORWARDED" && quietSince < Date.now() - 48 * 3600_000;

    return {
      id: t.id,
      num: t.num,
      title: t.title,
      description: t.description,
      contactName: t.contactName,
      contactPhone: t.contactPhone,
      branch: t.branch,
      source: t.source,
      ipAddress: t.ipAddress,
      assetId: t.assetId,
      priority: t.priority,
      category: t.category,
      status: t.status,
      forwardedTo: t.forwardedTo,
      forwardedAt: t.forwards[0] ? t.forwards[0].at.toISOString() : null,
      takenByName: t.takenBy?.name ?? null,
      takenAt: t.takenAt ? t.takenAt.toISOString() : null,
      solvedByName: t.solvedBy?.name ?? null,
      solvedAt: t.solvedAt ? t.solvedAt.toISOString() : null,
      resolutionNote: t.resolutionNote,
      createdAt: t.createdAt.toISOString(),
      createdByName: t.createdBy.name,
      needsFollowUp,
    };
  });

  const counts = Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])) as Partial<Record<TicketStatus, number>>;
  const allCount = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const followUps = rows.filter((r) => r.needsFollowUp).length;
  // One clock for server and client render so relative times hydrate identically.
  const renderedAt = Date.now();

  // Tabs and filters keep each other's values.
  const hrefWith = (next: Record<string, string | undefined>) => {
    const qs = new URLSearchParams();
    const merged = { status, priority, category, q, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return qs.size ? `/tickets?${qs.toString()}` : "/tickets";
  };
  const tabs: { key?: TicketStatus; label: string; count: number }[] = [
    { label: "All", count: allCount },
    ...TAB_ORDER.map((s) => ({ key: s, label: fmtLabel(s), count: counts[s] ?? 0 })),
  ];
  const filtered = !!(priority || category || q);

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Tickets"
        subtitle="Tech team complaint tracker. One list, no duplicates."
        action={<NewTicketDialog />}
        counters={[
          { label: "Open", value: counts.OPEN ?? 0, digits: 3, tone: (counts.OPEN ?? 0) > 0 ? "red" : "white", primary: true },
          { label: "Taken up", value: counts.TAKEN_UP ?? 0, digits: 3, tone: "white" },
          { label: "Need follow-up", value: followUps, digits: 3, tone: followUps > 0 ? "amber" : "white" },
          { label: "Solved today", value: solvedTodayCount, digits: 3, tone: "white" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <form method="GET" className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end sm:p-5">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="flex flex-1 flex-col gap-1.5 sm:min-w-64">
            <label htmlFor="q" className="text-sm font-medium">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="q" name="q" type="search" defaultValue={q ?? ""} className="pl-8" placeholder="Title, name, phone, asset or IP" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="flex flex-col gap-1.5 sm:w-36">
              <label htmlFor="filter-priority" className="text-sm font-medium">
                Priority
              </label>
              <div className="relative">
                <select id="filter-priority" name="priority" defaultValue={priority ?? ""} className={selectClass}>
                <option value="">Any priority</option>
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {fmtLabel(p)}
                  </option>
                ))}
              </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:w-36">
              <label htmlFor="filter-category" className="text-sm font-medium">
                Category
              </label>
              <div className="relative">
                <select id="filter-category" name="category" defaultValue={category ?? ""} className={selectClass}>
                <option value="">Any category</option>
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {fmtLabel(c)}
                  </option>
                ))}
              </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 sm:flex-none">
              Apply
            </Button>
            {filtered && (
              <Link
                href={hrefWith({ priority: undefined, category: undefined, q: undefined })}
                className="inline-flex h-9 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        <Section flush>
          <nav aria-label="Filter by status" className="flex overflow-x-auto border-b px-2 [scrollbar-width:none] sm:px-3">
            {tabs.map((t) => {
              const active = status === t.key;
              return (
                <Link
                  key={t.label}
                  href={hrefWith({ status: t.key })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-12 shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full",
                    active ? "text-foreground after:bg-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {t.count}
                  </span>
                </Link>
              );
            })}
          </nav>
          <TicketsTable rows={rows} isManager={user.role === "MANAGER"} now={renderedAt} />
        </Section>
      </main>
    </div>
  );
}
