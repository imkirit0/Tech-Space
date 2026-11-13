import Link from "next/link";
import { LOW_STOCK, type VoucherStock } from "@/lib/vouchers";

/** Amber "time to order" banner; renders nothing when every voucher is well stocked. */
export function VoucherOrderAlert({ stock, link = false }: { stock: VoucherStock[]; link?: boolean }) {
  const toOrder = stock.filter((s) => s.state !== "ok");
  if (toOrder.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 sm:px-5"
    >
      <div>
        <p className="font-semibold">Time to order vouchers: {toOrder.map((s) => s.voucher).join(", ")}</p>
        <p className="mt-0.5 text-amber-900">
          {toOrder
            .map(
              (s) =>
                (s.inStock <= 0 ? `${s.voucher} is out of stock` : `${s.voucher} has ${s.inStock} left`) +
                (s.onOrder > 0 ? ` (${s.onOrder} already on order)` : "")
            )
            .join(" · ")}
          . A voucher is flagged at {LOW_STOCK} or fewer.
        </p>
      </div>
      {link && (
        <Link href="/vouchers" className="font-semibold underline underline-offset-2 hover:no-underline">
          Open Vouchers
        </Link>
      )}
    </div>
  );
}
