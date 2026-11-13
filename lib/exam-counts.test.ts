import { expect, test } from "vitest";
import { examCountsByDate, parseExamCount } from "./exam-counts";

test("parseExamCount reads the trailing count off exam titles only", () => {
  expect(parseExamCount("META EXAMINATION-3")).toEqual({ exam: "META EXAMINATION", count: 3 });
  expect(parseExamCount("mos  examination - 5 ")).toEqual({ exam: "MOS EXAMINATION", count: 5 });
  expect(parseExamCount("MOS SYSTEM CONFIGURATION-1")).toBeNull();
  expect(parseExamCount("SAP EXAM EXAM ASSIGNED")).toBeNull();
});

test("examCountsByDate sums registrations per exam per day, newest day first", () => {
  const r = examCountsByDate([
    { date: "2026-10-01", program: "MOS EXAMINATION", count: 5 },
    { date: "2026-10-01", program: "mos examination", count: 2 },
    { date: "2026-10-01", program: "META EXAMINATION", count: 3 },
    { date: "2026-10-02", program: "META EXAMINATION", count: 1 },
  ]);
  expect(r.exams).toEqual(["META EXAMINATION", "MOS EXAMINATION"]);
  expect(r.days.map((d) => d.date)).toEqual(["2026-10-02", "2026-10-01"]);
  expect(r.days[1].counts.get("MOS EXAMINATION")).toBe(7);
  expect(r.totals.get("META EXAMINATION")).toBe(4);
});

test("activity titles fill in only where no registration was logged", () => {
  const r = examCountsByDate(
    [{ date: "2026-10-01", program: "MOS EXAMINATION", count: 5 }],
    [
      { date: "2026-10-01", activity: "MOS EXAMINATION-5" }, // already logged: not doubled
      { date: "2026-10-01", activity: "META EXAMINATION-3" },
      { date: "2026-10-01", activity: "LMS ID ISSUE" },
    ]
  );
  expect(r.days[0].counts.get("MOS EXAMINATION")).toBe(5);
  expect(r.days[0].counts.get("META EXAMINATION")).toBe(3);
});
