/**
 * Slows down password guessing: after MAX_FAILS wrong passwords for one
 * username within WINDOW_MS, that username is locked for WINDOW_MS.
 * ponytail: in-memory per server process; move to the database (or Redis) if the app runs on several instances.
 */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60_000;

type Entry = { fails: number; first: number; lockedUntil: number };
const attempts = new Map<string, Entry>();

export function lockedFor(key: string, now = Date.now()): number {
  const e = attempts.get(key);
  return e && e.lockedUntil > now ? e.lockedUntil - now : 0;
}

export function recordFailure(key: string, now = Date.now()): void {
  const e = attempts.get(key);
  if (!e || now - e.first > WINDOW_MS) {
    attempts.set(key, { fails: 1, first: now, lockedUntil: 0 });
    return;
  }
  e.fails += 1;
  if (e.fails >= MAX_FAILS) e.lockedUntil = now + WINDOW_MS;
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}
