import { describe, expect, it } from "vitest";
import { examTotals } from "./exam-records";

const rec = (exam: string, o: Partial<Record<"conducted" | "passed" | "failed" | "reassessed" | "urgent" | "normal", number>>) => ({
  exam,
  conducted: 0,
  passed: 0,
  failed: 0,
  reassessed: 0,
  urgent: 0,
  normal: 0,
  ...o,
});

describe("examTotals", () => {
  it("sums per exam and derives dispatched = urgent + normal", () => {
    const { rows, grand } = examTotals([
      rec("TALLY", { conducted: 10, passed: 8, failed: 2, urgent: 3, normal: 5 }),
      rec("TALLY", { conducted: 5, passed: 5, reassessed: 1, urgent: 1, normal: 4 }),
      rec("IBMA", { conducted: 4, passed: 3, failed: 1, urgent: 0, normal: 3 }),
    ]);
    const tally = rows.find((r) => r.exam === "TALLY")!;
    expect(tally.conducted).toBe(15);
    expect(tally.passed).toBe(13);
    expect(tally.failed).toBe(2);
    expect(tally.reassessed).toBe(1);
    expect(tally.dispatched).toBe(13); // 4 urgent + 9 normal
    expect(tally.batches).toBe(2);
    // Most conducted first.
    expect(rows[0].exam).toBe("TALLY");
    expect(grand.conducted).toBe(19);
    expect(grand.dispatched).toBe(16);
    expect(grand.batches).toBe(3);
  });

  it("is empty-safe", () => {
    const { rows, grand } = examTotals([]);
    expect(rows).toEqual([]);
    expect(grand.conducted).toBe(0);
    expect(grand.dispatched).toBe(0);
  });
});
