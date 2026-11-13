import { RATE_DAYS, type VoucherState, type VoucherStock } from "@/lib/vouchers";
import { LampBadge, type Lamp } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATE: Record<VoucherState, { lamp: Lamp; label: string }> = {
  out: { lamp: "red", label: "Out of stock" },
  low: { lamp: "amber", label: "Order now" },
  ok: { lamp: "green", label: "In stock" },
};

/** Stock per voucher: number on hand, recent issue rate, how long it lasts and whether to order. */
export function VoucherStockTable({ stock }: { stock: VoucherStock[] }) {
  const maxStock = Math.max(1, ...stock.map((s) => s.inStock));
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/60 hover:bg-muted/60">
          <TableHead className="pl-5">Voucher</TableHead>
          <TableHead className="w-full min-w-56">In stock</TableHead>
          <TableHead className="text-right">On order</TableHead>
          <TableHead className="text-right">Issued, {RATE_DAYS} days</TableHead>
          <TableHead>Lasts about</TableHead>
          <TableHead className="pr-5">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stock.map((s) => (
          <TableRow key={s.voucher}>
            <TableCell className="pl-5 font-medium">{s.voucher}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 text-right text-base font-semibold tabular-nums">{s.inStock}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className={`h-full rounded-full ${s.state === "ok" ? "bg-primary/70" : s.state === "low" ? "bg-amber-500" : "bg-red-600"}`}
                    style={{ width: `${(Math.max(0, s.inStock) / maxStock) * 100}%` }}
                  />
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {s.onOrder > 0 ? <span className="font-medium text-primary">+{s.onOrder}</span> : <span className="text-muted-foreground/50">–</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{s.issuedRecently}</TableCell>
            <TableCell className="text-muted-foreground">
              {s.inStock <= 0 ? "—" : s.daysLeft === null ? "None issued lately" : `${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"}`}
            </TableCell>
            <TableCell className="pr-5">
              <LampBadge lamp={STATE[s.state].lamp}>{STATE[s.state].label}</LampBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
