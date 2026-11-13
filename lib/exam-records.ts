/** A single exam batch's figures. `dispatched` is derived as urgent + normal. */
export type ExamFigures = {
  conducted: number;
  passed: number;
  failed: number;
  reassessed: number;
  urgent: number;
  normal: number;
};

export type ExamTotal = ExamFigures & { exam: string; dispatched: number; batches: number };

const FIELDS = ["conducted", "passed", "failed", "reassessed", "urgent", "normal"] as const;

/** Sum records per exam/certificate type, plus a grand total. Rows are sorted by most conducted. */
export function examTotals(records: (ExamFigures & { exam: string })[]): { rows: ExamTotal[]; grand: ExamTotal } {
  const byExam = new Map<string, ExamTotal>();
  const grand: ExamTotal = blank("All exams");
  for (const r of records) {
    const row = byExam.get(r.exam) ?? blank(r.exam);
    for (const f of FIELDS) {
      row[f] += r[f];
      grand[f] += r[f];
    }
    row.batches += 1;
    grand.batches += 1;
    byExam.set(r.exam, row);
  }
  for (const row of byExam.values()) row.dispatched = row.urgent + row.normal;
  grand.dispatched = grand.urgent + grand.normal;
  const rows = [...byExam.values()].sort((a, b) => b.conducted - a.conducted || a.exam.localeCompare(b.exam));
  return { rows, grand };
}

function blank(exam: string): ExamTotal {
  return { exam, conducted: 0, passed: 0, failed: 0, reassessed: 0, urgent: 0, normal: 0, dispatched: 0, batches: 0 };
}
