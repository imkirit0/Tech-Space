// Shared list paging: every list in the app pages through the URL (?page=2), so links can be shared and Back works.
export const PAGE_SIZE = 25;

type Params = Record<string, string | string[] | undefined>;

/** Reads a 1-based page number from the URL; anything invalid is page 1. */
export function pageParam(params: Params, key = "page"): number {
  const v = params[key];
  return Math.max(1, Math.floor(Number(typeof v === "string" ? v : "")) || 1);
}

/** Clamps `page` to what exists for `total` rows; `skip` is the database offset. */
export function pageWindow(total: number, page: number, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return { page: current, pageCount, skip: (current - 1) * size, total, size };
}

/** Pages a list that is already in memory (used where the page also needs totals over every row). */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const w = pageWindow(items.length, page, size);
  return { ...w, items: items.slice(w.skip, w.skip + size) };
}

/** Link to page `n`, keeping every other filter in the URL. */
export function pageHref(path: string, params: Params, n: number, { key = "page", hash = "" } = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === key) continue;
    for (const one of [v ?? []].flat()) if (one) q.append(k, one);
  }
  if (n > 1) q.set(key, String(n));
  return `${path}${q.size ? `?${q}` : ""}${hash ? `#${hash}` : ""}`;
}
