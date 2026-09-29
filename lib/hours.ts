export const WORKDAY_HOURS = 8;

/** 6 → "6", 6.5 → "6.5", 6.25 → "6.25"; no float noise like 0.30000000000000004. */
export function formatHours(h: number): string {
  return String(Math.round(h * 100) / 100);
}
