import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dateToISO, fmtDay, fmtDayLong, parseISODate, todayISO } from "@/lib/dates";
import { examCountsByDate } from "@/lib/exam-counts";
import { examTotals } from "@/lib/exam-records";
import { paginate, pageParam } from "@/lib/paging";
import { Pagination } from "@/components/pagination";
import { Board } from "@/components/nav";
import { Section } from "@/components/section";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExamRecordDialog, DeleteExamRecordButton, type ExamRecordValue } from "@/components/exam-record-controls";

export const metadata = { title: "Exams" };

const EXAM_DAYS = 14;
// Offered in the add/edit dialog until real ones are logged; any other name can be typed in.
const DEFAULT_EXAMS = ["TALLY", "IBMA"];
const selectClass =
  "h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "MANAGER") redirect("/dashboard");

  const params = await searchParams;
  const today = todayISO();
  const isoParam = (key: string) => {
    const v = params[key];
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
  };
  const from = isoParam("from");
  const to = isoParam("to");
  const staff = typeof params.staff === "string" && params.staff ? params.staff : undefined;
  const str = (key: string) => (typeof params[key] === "string" && params[key] ? (params[key] as string) : undefined);
  // Extra filters that apply to the records section only (exam/centre/vendor).
  const rExam = str("rExam");
  const rCentre = str("rCentre");
  const rVendor = str("rVendor");
  const rSource = str("rSource");
  const recordFiltered = !!rExam || !!rCentre || !!rVendor || !!rSource;

  const dateWhere = { gte: from ? parseISODate(from) : undefined, lte: to ? parseISODate(to) : undefined };
  const byStaff = staff ? { user: { name: { contains: staff, mode: "insensitive" as const } } } : {};

  const [registrations, examActivities, examRecordRows, employees, examNamesUsed, centreRows, vendorRows] = await Promise.all([
    prisma.registration.findMany({ where: { date: dateWhere, ...byStaff }, select: { date: true, program: true, count: true } }),
    prisma.activity.findMany({
      where: { date: dateWhere, activity: { contains: "exam", mode: "insensitive" }, ...byStaff },
      select: { date: true, activity: true },
    }),
    prisma.examRecord.findMany({
      where: {
        date: dateWhere,
        ...byStaff,
        ...(rExam ? { exam: rExam } : {}),
        ...(rCentre ? { center: rCentre } : {}),
        ...(rVendor ? { vendor: rVendor } : {}),
        ...(rSource ? { source: rSource } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: { user: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.examRecord.findMany({ distinct: ["exam"], select: { exam: true }, orderBy: { exam: "asc" } }),
    prisma.examRecord.findMany({ where: { center: { not: null } }, distinct: ["center"], select: { center: true }, orderBy: { center: "asc" } }),
    prisma.examRecord.findMany({ where: { vendor: { not: null } }, distinct: ["vendor"], select: { vendor: true }, orderBy: { vendor: "asc" } }),
  ]);
  const recordExams = examNamesUsed.map((u) => u.exam);
  const centres = centreRows.map((c) => c.center!);
  const vendors = vendorRows.map((v) => v.vendor!);
  // Names for the add/edit dialog's exam dropdown (all known, plus defaults).
  const examNames = [...recordExams];
  for (const d of DEFAULT_EXAMS) if (!examNames.some((e) => e.toLowerCase() === d.toLowerCase())) examNames.push(d);
  examNames.sort();

  // ── Registrations table (rows = exams, columns = dates) ──
  const exams = examCountsByDate(
    registrations.map((r) => ({ date: dateToISO(r.date), program: r.program, count: r.count })),
    examActivities.map((a) => ({ date: dateToISO(a.date), activity: a.activity }))
  );
  const chosenExams = new Set([params.exam ?? []].flat().filter((e) => exams.exams.includes(e)));
  const matchingDays = chosenExams.size
    ? exams.days
        .map((d) => ({ date: d.date, counts: new Map([...d.counts].filter(([e]) => chosenExams.has(e))) }))
        .filter((d) => d.counts.size > 0)
    : exams.days;
  const examFiltered = chosenExams.size > 0 || !!from || !!to || !!staff;
  const examDays = matchingDays.slice(0, EXAM_DAYS);
  const examRows = exams.exams
    .map((exam) => ({ exam, total: examDays.reduce((s, d) => s + (d.counts.get(exam) ?? 0), 0) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.exam.localeCompare(b.exam));
  const sum = (counts: Map<string, number>) => [...counts.values()].reduce((s, n) => s + n, 0);
  const examGrandTotal = examRows.reduce((s, r) => s + r.total, 0);
  const examMax = examRows[0]?.total ?? 0;

  // ── Results & dispatch totals ──
  const results = examTotals(examRecordRows);
  const recordPages = paginate(examRecordRows, pageParam(params, "erPage"), 10);

  // Build an /exams URL from the current params, applying overrides (null clears a key).
  const hrefWith = (over: Record<string, string | string[] | null | undefined>, hash = "") => {
    const merged: Record<string, string | string[] | undefined> = { ...params };
    for (const [k, v] of Object.entries(over)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
      else q.set(k, v);
    }
    return `/exams${q.size ? `?${q}` : ""}${hash}`;
  };
  // Changing the exam set or the period resets the records page.
  const examHref = (chosen: Set<string>, f?: string, t?: string) =>
    hrefWith({ exam: [...chosen], from: f ?? null, to: t ?? null, erPage: null }, "#registrations");
  const recordsHref = (n: number) => hrefWith({ erPage: n > 1 ? String(n) : null }, "#records");
  const recordsReset = hrefWith({ rExam: null, rCentre: null, rVendor: null, rSource: null, erPage: null }, "#records");
  // Hidden inputs so the records filter keeps the top staff / exam-chip selection (date is a visible field).
  const recordTopHidden: [string, string][] = [];
  if (staff) recordTopHidden.push(["staff", staff]);
  for (const e of chosenExams) recordTopHidden.push(["exam", e]);

  const daysAgo = (n: number) => dateToISO(new Date(parseISODate(today).getTime() - n * 864e5));
  const periods = [
    { label: "All dates", from: undefined, to: undefined },
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: daysAgo(6), to: today },
    { label: "Last 30 days", from: daysAgo(29), to: today },
  ];
  // Hidden inputs so the custom-date / staff form keeps the chosen exams.
  const hiddenExams = [...chosenExams].map((e) => ["exam", e] as const);

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Exams"
        subtitle="Registrations, exams conducted and certificate dispatch. Staff log these under My Activities."
        counters={[
          { label: "Registered", value: examGrandTotal, digits: 5, tone: "white" },
          { label: "Conducted", value: results.grand.conducted, digits: 5, tone: "white", primary: true },
          { label: "Dispatched", value: results.grand.dispatched, digits: 5, tone: "white" },
          { label: "Urgent", value: results.grand.urgent, digits: 4, tone: results.grand.urgent > 0 ? "amber" : "white" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Shared filter: period + staff drive both tables; exam chips filter the registrations table. */}
        <Section title="Filter">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="w-24 shrink-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Period</span>
              <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Period">
                {periods.map((p) => {
                  const active = from === p.from && to === p.to;
                  return (
                    <Link
                      key={p.label}
                      href={examHref(chosenExams, p.from, p.to)}
                      aria-current={active ? "true" : undefined}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </Link>
                  );
                })}
              </div>
              <form key={`${from}|${to}|${staff}`} method="GET" action="/exams#registrations" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {hiddenExams.map(([k, v]) => (
                  <input key={k + v} type="hidden" name={k} value={v} />
                ))}
                <label htmlFor="from">from</label>
                <Input id="from" name="from" type="date" defaultValue={from ?? ""} max={today} className="h-9 w-38 bg-card" />
                <label htmlFor="to">to</label>
                <Input id="to" name="to" type="date" defaultValue={to ?? ""} max={today} className="h-9 w-38 bg-card" />
                <label htmlFor="staff" className="ml-2">
                  staff
                </label>
                <select
                  id="staff"
                  name="staff"
                  defaultValue={staff ?? ""}
                  className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">All staff</option>
                  {employees.map((e) => (
                    <option key={e.name} value={e.name}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline">
                  Apply
                </Button>
              </form>
            </div>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <span className="w-24 shrink-0 pt-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Examinations</span>
              <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                <li>
                  <ExamChip href={examHref(new Set(), from, to)} on={chosenExams.size === 0}>
                    All
                  </ExamChip>
                </li>
                {exams.exams.map((e) => {
                  const next = new Set(chosenExams);
                  if (!next.delete(e)) next.add(e);
                  return (
                    <li key={e}>
                      <ExamChip href={examHref(next, from, to)} on={chosenExams.has(e)} title={e}>
                        {e.replace(/ EXAMINATION$/, "")}
                      </ExamChip>
                    </li>
                  );
                })}
              </ul>
              {examFiltered && (
                <Link href="/exams" className="pt-1.5 text-sm font-medium text-primary hover:underline">
                  Reset
                </Link>
              )}
            </div>
          </div>
        </Section>

        <div id="registrations" className="scroll-mt-4">
          <Section
            flush
            title="Examination registrations"
            description={
              examDays.length === 0
                ? "Nothing registered for this choice."
                : `${examGrandTotal} registered for ${examRows.length} ${examRows.length === 1 ? "examination" : "examinations"}` +
                  (matchingDays.length > examDays.length
                    ? ` on the latest ${examDays.length} of ${matchingDays.length} dates. Narrow the period to see older dates.`
                    : ` on ${examDays.length} ${examDays.length === 1 ? "date" : "dates"}.`)
            }
          >
            {examDays.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted">
                      <TableHead className="sticky left-0 z-10 bg-muted pl-5">Examination</TableHead>
                      <TableHead className="w-full min-w-56 pl-4">Total registered</TableHead>
                      {examDays.map((d, i) => (
                        <TableHead
                          key={d.date}
                          className={`min-w-20 text-right font-normal text-muted-foreground ${i === examDays.length - 1 ? "pr-5" : ""}`}
                          title={fmtDayLong(d.date)}
                        >
                          {d.date === today ? "Today" : fmtDay(d.date)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examRows.map((r) => (
                      <TableRow key={r.exam} className="group">
                        <TableCell className="sticky left-0 z-10 bg-card py-3 pl-5 font-medium group-hover:bg-muted">{r.exam}</TableCell>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-right text-base font-semibold tabular-nums">{r.total}</span>
                            <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden>
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.total / examMax) * 100}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        {examDays.map((d, i) => (
                          <TableCell key={d.date} className={`text-right tabular-nums ${i === examDays.length - 1 ? "pr-5" : ""}`}>
                            {d.counts.get(r.exam) ?? <span className="text-muted-foreground/40">–</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="sticky left-0 z-10 bg-muted pl-5 font-semibold">All examinations</TableCell>
                      <TableCell className="pl-4">
                        <span className="inline-block w-8 text-right text-base font-semibold tabular-nums">{examGrandTotal}</span>
                      </TableCell>
                      {examDays.map((d, i) => (
                        <TableCell key={d.date} className={`text-right font-semibold tabular-nums ${i === examDays.length - 1 ? "pr-5" : ""}`}>
                          {sum(d.counts)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </Section>
        </div>

        <div id="records" className="scroll-mt-4">
          <Section
            flush
            title="Exams conducted & certificates"
            description={
              results.rows.length === 0
                ? "No exam records for this choice."
                : `${results.grand.conducted} students conducted across ${results.grand.batches} ${
                    results.grand.batches === 1 ? "batch" : "batches"
                  }, ${results.grand.dispatched} certificates dispatched.`
            }
            actions={<ExamRecordDialog today={today} exams={examNames} />}
          >
            {(recordExams.length > 0 || recordFiltered) && (
              <form
                key={`${from}|${to}`}
                method="GET"
                action="/exams#records"
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground sm:px-5"
              >
                {recordTopHidden.map(([k, v], i) => (
                  <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
                ))}
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Filter</span>
                <label htmlFor="r-from" className="text-xs">
                  from
                </label>
                <Input id="r-from" name="from" type="date" defaultValue={from ?? ""} max={today} className="h-9 w-38 bg-card" />
                <label htmlFor="r-to" className="text-xs">
                  to
                </label>
                <Input id="r-to" name="to" type="date" defaultValue={to ?? ""} max={today} className="h-9 w-38 bg-card" />
                <select name="rExam" defaultValue={rExam ?? ""} aria-label="Certificate group" className={selectClass}>
                  <option value="">All groups</option>
                  {recordExams.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <select name="rCentre" defaultValue={rCentre ?? ""} aria-label="Centre" className={selectClass}>
                  <option value="">All centres</option>
                  {centres.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select name="rVendor" defaultValue={rVendor ?? ""} aria-label="Vendor" className={selectClass}>
                  <option value="">All vendors</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <select name="rSource" defaultValue={rSource ?? ""} aria-label="Source" className={selectClass}>
                  <option value="">Any source</option>
                  <option value="GEMS">GEMS</option>
                  <option value="Forms">Forms</option>
                </select>
                <Button type="submit" variant="outline">
                  Apply
                </Button>
                {recordFiltered && (
                  <Link href={recordsReset} className="font-medium text-primary hover:underline">
                    Reset
                  </Link>
                )}
                <span className="ml-auto text-xs text-muted-foreground">The staff filter above also applies.</span>
              </form>
            )}
            {results.rows.length > 0 && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted hover:bg-muted">
                        <TableHead className="pl-5">Certificate group</TableHead>
                        <TableHead className="text-right">Conducted</TableHead>
                        <TableHead className="text-right">Passed</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead className="text-right">Re-assessed</TableHead>
                        <TableHead className="text-right">Dispatched</TableHead>
                        <TableHead className="text-right">Urgent</TableHead>
                        <TableHead className="pr-5 text-right">Normal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.rows.map((r) => (
                        <TableRow key={r.exam}>
                          <TableCell className="pl-5 font-medium">{r.exam}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.conducted}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-700">{r.passed}</TableCell>
                          <TableCell className="text-right tabular-nums text-rose-700">{r.failed}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.reassessed}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{r.dispatched}</TableCell>
                          <TableCell className="text-right tabular-nums text-amber-700">{r.urgent}</TableCell>
                          <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">{r.normal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="hover:bg-transparent">
                        <TableCell className="pl-5 font-semibold">All exams</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.conducted}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.passed}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.failed}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.reassessed}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.dispatched}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{results.grand.urgent}</TableCell>
                        <TableCell className="pr-5 text-right font-semibold tabular-nums">{results.grand.normal}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
                <p className="border-t bg-muted/30 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase sm:px-5">
                  Recent exam records
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead className="pl-5">Date</TableHead>
                        <TableHead>Certificate group</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>By</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="w-20 pr-5">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recordPages.items.map((e) => {
                        const day = fmtDay(dateToISO(e.date));
                        const value: ExamRecordValue = {
                          id: e.id,
                          date: dateToISO(e.date),
                          exam: e.exam,
                          certificateName: e.certificateName,
                          center: e.center,
                          vendor: e.vendor,
                          conducted: e.conducted,
                          passed: e.passed,
                          failed: e.failed,
                          reassessed: e.reassessed,
                          urgent: e.urgent,
                          normal: e.normal,
                          source: e.source,
                          note: e.note,
                        };
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="pl-5 whitespace-nowrap text-muted-foreground">{day}</TableCell>
                            <TableCell className="font-medium">
                              {e.exam}
                              {e.certificateName && (
                                <span className="block text-xs font-normal text-muted-foreground">{e.certificateName}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {e.source ? (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{e.source}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{e.center || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{e.vendor || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{e.user.name}</TableCell>
                            <TableCell className="max-w-56 truncate text-muted-foreground" title={e.note ?? undefined}>
                              {e.note || "—"}
                            </TableCell>
                            <TableCell className="pr-5">
                              <div className="flex justify-end">
                                <ExamRecordDialog today={today} exams={examNames} record={value} />
                                <DeleteExamRecordButton id={e.id} label={`${e.exam} on ${day}`} />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <Pagination window={recordPages} href={recordsHref} label="Exam record pages" />
              </>
            )}
          </Section>
        </div>
      </main>
    </div>
  );
}

/** Toggle pill for the exam table: a link, so choosing an examination needs no Apply button. */
function ExamChip({ href, on, title, children }: { href: string; on: boolean; title?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={title}
      aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${
        on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
    </Link>
  );
}
