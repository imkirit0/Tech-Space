import { describe, it, expect } from "vitest";
import { dateToISO, fmtDay, fmtDayLong, isFutureISO, parseISODate, periodRange, todayISO } from "./dates";

describe("dates", () => {
  it("todayISO returns YYYY-MM-DD", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("dateToISO reads UTC date parts of a db.Date", () => {
    expect(dateToISO(new Date("2026-08-01T00:00:00.000Z"))).toBe("2026-08-01");
  });
  it("parseISODate round-trips with dateToISO", () => {
    expect(dateToISO(parseISODate("2026-10-15"))).toBe("2026-10-15");
  });
  it("isFutureISO is true for tomorrow, false for today", () => {
    const [y, m, d] = todayISO().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    expect(isFutureISO(tomorrow)).toBe(true);
    expect(isFutureISO(todayISO())).toBe(false);
  });
  it("fmtDay keeps the calendar day regardless of server time zone", () => {
    expect(fmtDay("2026-08-01")).toBe("1 Aug");
    expect(fmtDayLong("2026-09-29")).toMatch(/^Tue, 29 Sept?,? 2026$/);
  });
});

describe("periodRange", () => {
  it("day is the date itself", () => {
    expect(periodRange("2026-09-30", "day")).toEqual(["2026-09-30", "2026-09-30"]);
  });
  it("week runs Monday to Sunday", () => {
    expect(periodRange("2026-09-30", "week")).toEqual(["2026-09-28", "2026-10-04"]); // Wed
    expect(periodRange("2026-10-04", "week")).toEqual(["2026-09-28", "2026-10-04"]); // Sun
    expect(periodRange("2026-09-28", "week")).toEqual(["2026-09-28", "2026-10-04"]); // Mon
  });
  it("month covers the whole month, leap Feb included", () => {
    expect(periodRange("2026-09-30", "month")).toEqual(["2026-09-01", "2026-09-30"]);
    expect(periodRange("2028-02-10", "month")).toEqual(["2028-02-01", "2028-02-29"]);
  });
});
