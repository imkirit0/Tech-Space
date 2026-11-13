// Before the registrations form, staff logged exam counts as an activity titled
// "<EXAM NAME>-<count>", e.g. "MOS EXAMINATION-5". Still read so those older days keep their numbers.
const EXAM_TITLE = /^(.*\bexam\w*)\s*[-–:]\s*(\d+)\s*$/i;

const examName = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

export function parseExamCount(title: string): { exam: string; count: number } | null {
  const m = EXAM_TITLE.exec(title.trim());
  if (!m) return null;
  return { exam: examName(m[1]), count: Number(m[2]) };
}

/**
 * Pivot into per-date exam counts: newest date first, exams A–Z.
 * Logged registrations win: an activity title only counts for a date + exam nobody
 * logged a registration for, so doing both never doubles the figure.
 */
export function examCountsByDate(
  registrations: { date: string; program: string; count: number }[],
  activities: { date: string; activity: string }[] = []
) {
  const byDate = new Map<string, Map<string, number>>();
  const add = (date: string, exam: string, count: number) => {
    const day = byDate.get(date) ?? new Map<string, number>();
    byDate.set(date, day);
    day.set(exam, (day.get(exam) ?? 0) + count);
  };
  for (const r of registrations) add(r.date, examName(r.program), r.count);
  const logged = new Set([...byDate].flatMap(([date, day]) => [...day.keys()].map((exam) => `${date}|${exam}`)));
  for (const a of activities) {
    const parsed = parseExamCount(a.activity);
    if (parsed && !logged.has(`${a.date}|${parsed.exam}`)) add(a.date, parsed.exam, parsed.count);
  }
  const totals = new Map<string, number>();
  for (const day of byDate.values()) for (const [exam, n] of day) totals.set(exam, (totals.get(exam) ?? 0) + n);
  return {
    exams: [...totals.keys()].sort(),
    totals,
    days: [...byDate].sort((a, b) => b[0].localeCompare(a[0])).map(([date, counts]) => ({ date, counts })),
  };
}
