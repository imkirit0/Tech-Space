import { prisma } from "@/lib/db";
import { dateToISO, fmtDayLong } from "@/lib/dates";
import { Section, EmptyState } from "@/components/section";
import { Pagination } from "@/components/pagination";
import { pageWindow } from "@/lib/paging";
import { ExamRecordDialog, DeleteExamRecordButton, type ExamRecordValue } from "@/components/exam-record-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Offered in the exam dropdown until someone logs them; any other name can be typed in.
const DEFAULT_EXAMS = ["TALLY", "IBMA"];
const PER_PAGE = 10;

/** Staff panel: log exam batches (results and certificate dispatch) and see recent entries. */
export async function MyExamRecords({
  userId,
  today,
  page,
  href,
}: {
  userId: string;
  today: string;
  page: number;
  href: (page: number) => string;
}) {
  const pages = pageWindow(await prisma.examRecord.count({ where: { userId } }), page, PER_PAGE);
  const [records, used] = await Promise.all([
    prisma.examRecord.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: pages.skip,
      take: pages.size,
    }),
    prisma.examRecord.findMany({ distinct: ["exam"], select: { exam: true }, orderBy: { exam: "asc" } }),
  ]);

  const exams = used.map((u) => u.exam);
  for (const d of DEFAULT_EXAMS) if (!exams.some((e) => e.toLowerCase() === d.toLowerCase())) exams.push(d);
  exams.sort();

  return (
    <div id="exam-records" className="scroll-mt-4">
      <Section
        flush
        title="Exam records"
        description="One row per exam batch: students conducted, results, and certificates dispatched (urgent + normal). Your manager sees the totals per exam."
        actions={<ExamRecordDialog today={today} exams={exams} />}
      >
        {records.length === 0 ? (
          <EmptyState title="No exam records yet">Use “Add exam record” to log a batch you conducted.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Certificate group</TableHead>
                  <TableHead>Centre</TableHead>
                  <TableHead className="text-right">Conducted</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Re-assessed</TableHead>
                  <TableHead className="text-right" title="Certificates dispatched (urgent + normal)">
                    Dispatched
                  </TableHead>
                  <TableHead className="w-20 pr-5">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((e) => {
                  const date = dateToISO(e.date);
                  const day = fmtDayLong(date);
                  const value: ExamRecordValue = {
                    id: e.id,
                    date,
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
                        {e.source && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{e.source}</span>
                        )}
                        {e.certificateName && <span className="block text-xs font-normal text-muted-foreground">{e.certificateName}</span>}
                        {e.vendor && <span className="block text-xs font-normal text-muted-foreground">{e.vendor}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.center || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.conducted}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.passed}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.failed}</TableCell>
                      <TableCell className="text-right tabular-nums">{e.reassessed}</TableCell>
                      <TableCell className="text-right tabular-nums" title={`${e.urgent} urgent + ${e.normal} normal`}>
                        {e.urgent + e.normal}
                        {e.urgent > 0 && <span className="ml-1 text-xs text-amber-700">({e.urgent}!)</span>}
                      </TableCell>
                      <TableCell className="pr-5">
                        <div className="flex justify-end">
                          <ExamRecordDialog today={today} exams={exams} record={value} />
                          <DeleteExamRecordButton id={e.id} label={`${e.exam} on ${day}`} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Pagination window={pages} href={href} label="Exam record pages" />
      </Section>
    </div>
  );
}
