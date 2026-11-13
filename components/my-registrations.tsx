import { prisma } from "@/lib/db";
import { dateToISO, fmtDayLong } from "@/lib/dates";
import { Section, EmptyState } from "@/components/section";
import { Pagination } from "@/components/pagination";
import { pageWindow } from "@/lib/paging";
import { AddRegistrationDialog, DeleteRegistrationButton, EditableCount } from "@/components/registration-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Offered in the examination dropdown until someone logs them; any other name can be typed in.
const DEFAULT_EXAMS = ["META EXAMINATION", "MOS EXAMINATION"];
const PER_PAGE = 10;

/** Staff panel: log how many registered for each examination on a day, and see their recent entries. */
export async function MyRegistrations({
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
  const pages = pageWindow(await prisma.registration.count({ where: { userId } }), page, PER_PAGE);
  const [entries, used] = await Promise.all([
    prisma.registration.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { program: "asc" }],
      skip: pages.skip,
      take: pages.size,
    }),
    prisma.registration.findMany({ distinct: ["program"], select: { program: true }, orderBy: { program: "asc" } }),
  ]);

  const exams = used.map((u) => u.program);
  for (const d of DEFAULT_EXAMS) if (!exams.some((e) => e.toLowerCase() === d.toLowerCase())) exams.push(d);
  exams.sort();

  return (
    <div id="registrations" className="scroll-mt-4">
    <Section
      flush
      title="Examination registrations"
      description="How many registered for each examination, per day. Type over a count to correct it. Your manager sees the totals."
      actions={<AddRegistrationDialog today={today} programs={exams} />}
    >
      {entries.length === 0 ? (
        <EmptyState title="No registrations logged yet">
          Use “Add registrations” to record the count for an examination on a date.
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="pl-5">Date</TableHead>
              <TableHead>Examination</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="w-12 pr-5">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const day = fmtDayLong(dateToISO(e.date));
              return (
                <TableRow key={e.id}>
                  <TableCell className="pl-5 text-muted-foreground">{day}</TableCell>
                  <TableCell className="font-medium">{e.program}</TableCell>
                  <TableCell>
                    <EditableCount date={dateToISO(e.date)} program={e.program} count={e.count} />
                  </TableCell>
                  <TableCell className="pr-5">
                    <DeleteRegistrationButton id={e.id} label={`${e.program}: ${e.count} on ${day}`} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <Pagination window={pages} href={href} label="Registration pages" />
    </Section>
    </div>
  );
}
