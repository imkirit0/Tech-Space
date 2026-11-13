// ponytail: one reorder level for every voucher kind; make it per-voucher if their volumes differ a lot.
export const LOW_STOCK = 10;
/** Issue rate is averaged over this many days when estimating how long stock will last. */
export const RATE_DAYS = 30;

/** First day of the window the issue rate is averaged over. */
export function rateSinceISO(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - (RATE_DAYS - 1) * 864e5).toISOString().slice(0, 10);
}

export type VoucherState = "out" | "low" | "ok";

export type VoucherStock = {
  voucher: string;
  inStock: number;
  /** Vouchers issued in the last RATE_DAYS days. */
  issuedRecently: number;
  /** Ordered from a supplier but not delivered yet. */
  onOrder: number;
  /** Days until stock runs out at the recent issue rate; null when nothing was issued recently. */
  daysLeft: number | null;
  state: VoucherState;
};

/**
 * Stock per voucher kind from the movement rows (positive = received, negative = issued).
 * Sorted so the ones that need ordering come first.
 */
export function voucherStock(
  entries: { voucher: string; quantity: number; date: string }[],
  rateSince: string,
  /** Undelivered quantity per voucher, from outstandingByVoucher(). */
  onOrder: Map<string, number> = new Map()
): VoucherStock[] {
  const byVoucher = new Map<string, { inStock: number; issuedRecently: number }>();
  for (const e of entries) {
    const v = byVoucher.get(e.voucher) ?? { inStock: 0, issuedRecently: 0 };
    byVoucher.set(e.voucher, v);
    v.inStock += e.quantity;
    if (e.quantity < 0 && e.date >= rateSince) v.issuedRecently -= e.quantity;
  }
  // A voucher that has only ever been ordered (nothing delivered yet) still gets a row.
  for (const voucher of onOrder.keys()) if (!byVoucher.has(voucher)) byVoucher.set(voucher, { inStock: 0, issuedRecently: 0 });
  const order: Record<VoucherState, number> = { out: 0, low: 1, ok: 2 };
  return [...byVoucher]
    .map(([voucher, v]) => ({
      voucher,
      ...v,
      onOrder: onOrder.get(voucher) ?? 0,
      daysLeft: v.issuedRecently > 0 ? Math.floor(v.inStock / (v.issuedRecently / RATE_DAYS)) : null,
      state: (v.inStock <= 0 ? "out" : v.inStock <= LOW_STOCK ? "low" : "ok") as VoucherState,
    }))
    .sort((a, b) => order[a.state] - order[b.state] || a.inStock - b.inStock || a.voucher.localeCompare(b.voucher));
}

/** How much of an order is still to come (never negative: a supplier can over-deliver). */
export function outstanding(order: { quantity: number; receipts: { quantity: number }[] }): number {
  return Math.max(0, order.quantity - order.receipts.reduce((s, r) => s + r.quantity, 0));
}

/** Undelivered quantity per voucher across all orders. */
export function outstandingByVoucher(orders: { voucher: string; quantity: number; receipts: { quantity: number }[] }[]) {
  const m = new Map<string, number>();
  for (const o of orders) {
    const left = outstanding(o);
    if (left > 0) m.set(o.voucher, (m.get(o.voucher) ?? 0) + left);
  }
  return m;
}
