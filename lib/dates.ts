// en-CA formats as YYYY-MM-DD; timeZone gives the Asia/Kolkata calendar date.
const IST = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

export function todayISO(): string {
  return IST.format(new Date());
}

// @db.Date values arrive as UTC-midnight Dates; take the UTC date portion.
export function dateToISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isFutureISO(iso: string): boolean {
  return iso > todayISO();
}

// Display helpers for YYYY-MM-DD values (formatted in UTC so the calendar day never shifts).
const DAY = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });
const DAY_LONG = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function fmtDay(iso: string): string {
  return DAY.format(parseISODate(iso));
}

export function fmtDayLong(iso: string): string {
  return DAY_LONG.format(parseISODate(iso));
}

/** Inclusive [start, end] ISO dates of the day, Monday-first week or month holding `iso`. */
export function periodRange(iso: string, period: "day" | "week" | "month"): [string, string] {
  if (period === "day") return [iso, iso];
  const d = parseISODate(iso);
  if (period === "week") {
    const back = (d.getUTCDay() + 6) % 7; // days since Monday
    const start = new Date(d.getTime() - back * 86400_000);
    return [dateToISO(start), dateToISO(new Date(start.getTime() + 6 * 86400_000))];
  }
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return [`${iso.slice(0, 7)}-01`, dateToISO(end)];
}
