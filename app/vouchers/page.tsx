import { redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { dateToISO, fmtDay, fmtDayLong, periodRange, todayISO } from "@/lib/dates";
import { RATE_DAYS, outstanding, outstandingByVoucher, rateSinceISO, voucherStock } from "@/lib/vouchers";
import { VoucherStockTable } from "@/components/voucher-stock-table";
import { VoucherOrderAlert } from "@/components/voucher-alert";
import { Pagination } from "@/components/pagination";
import { pageHref, pageParam, pageWindow, paginate } from "@/lib/paging";
import { Board } from "@/components/nav";
import { Section, EmptyState } from "@/components/section";
import {
  VoucherDialog,
  DeleteVoucherEntryButton,
  PlaceOrderDialog,
  ReceiveOrderDialog,
  CancelOrderButton,
} from "@/components/voucher-controls";
import { LampBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Vouchers" };

const ORDERS_PER_PAGE = 10;


export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  const isManager = user.role === "MANAGER";
  const today = todayISO();
  const monthStart = periodRange(today, "month")[0];

  // ponytail: every movement is loaded to total the stock; switch to a groupBy if this table gets large.
  // Managers see every entry; staff see the vouchers they issued themselves.
  const historyWhere = isManager ? {} : { userId: user.id };
  const params = await searchParams;
  const [all, historyTotal, orders, vendorRows] = await Promise.all([
    prisma.voucherEntry.findMany({ select: { voucher: true, quantity: true, date: true } }),
    prisma.voucherEntry.count({ where: historyWhere }),
    // Every order with what has arrived against it; open ones are listed first below.
    prisma.voucherOrder.findMany({
      orderBy: [{ orderedOn: "desc" }, { createdAt: "desc" }],
      include: { receipts: { select: { quantity: true, date: true } }, user: { select: { name: true } } },
    }),
    prisma.voucherEntry.findMany({ where: { vendor: { not: null } }, distinct: ["vendor"], select: { vendor: true }, orderBy: { vendor: "asc" } }),
  ]);
  const vendors = [...new Set([...vendorRows.map((v) => v.vendor!), ...orders.flatMap((o) => (o.vendor ? [o.vendor] : []))])].sort();
  const orderRows = orders
    .map((o) => {
      const received = o.receipts.reduce((n, r) => n + r.quantity, 0);
      const lastReceipt = o.receipts.map((r) => dateToISO(r.date)).sort().at(-1) ?? null;
      return { ...o, received, left: outstanding(o), lastReceipt, orderedOnISO: dateToISO(o.orderedOn) };
    })
    // Still-open orders first, then newest.
    .sort((a, b) => Number(a.left === 0) - Number(b.left === 0));
  const openOrders = orderRows.filter((o) => o.left > 0);
  const orderPages = paginate(orderRows, pageParam(params, "orderPage"), ORDERS_PER_PAGE);
  const pages = pageWindow(historyTotal, pageParam(params));
  const history = await prisma.voucherEntry.findMany({
    where: historyWhere,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: pages.skip,
    take: pages.size,
    include: { user: { select: { name: true } } },
  });
  const entries = all.map((e) => ({ voucher: e.voucher, quantity: e.quantity, date: dateToISO(e.date) }));
  const stock = voucherStock(entries, rateSinceISO(today), outstandingByVoucher(orders));
  const toOrder = stock.filter((s) => s.state !== "ok");
  const issuedThisMonth = entries.filter((e) => e.quantity < 0 && e.date >= monthStart).reduce((s, e) => s - e.quantity, 0);

  return (
    <div className="flex min-h-svh flex-col">
      <Board
        title="Vouchers"
        subtitle="Exam voucher stock. Every voucher issued comes off the stock, so you can see when to order more."
        action={
          <div className="flex flex-wrap gap-2">
            {isManager && <PlaceOrderDialog today={today} vouchers={stock.map((v) => v.voucher).sort()} vendors={vendors} />}
            {isManager && <VoucherDialog kind="stock" today={today} stock={stock} />}
            <VoucherDialog kind="issue" today={today} stock={stock} />
          </div>
        }
        counters={[
          { label: "Vouchers in stock", value: stock.reduce((s, v) => s + v.inStock, 0), digits: 5, tone: "white", primary: true },
          { label: "Issued this month", value: issuedThisMonth, digits: 4, tone: "white" },
          { label: "On order", value: openOrders.reduce((n, o) => n + o.left, 0), digits: 4, tone: "white", hint: openOrders.length ? `${openOrders.length} open` : undefined },
          { label: "To order", value: toOrder.length, digits: 2, tone: toOrder.length ? "red" : "white", hint: `of ${stock.length}` },
        ]}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <VoucherOrderAlert stock={stock} />

        <Section
          flush
          title="Stock"
          description={`What's on hand for each voucher. “Lasts about” uses how many were issued in the last ${RATE_DAYS} days.`}
        >
          {stock.length === 0 ? (
            <EmptyState icon={<Ticket />} title="No vouchers yet">
              {isManager
                ? "Use “Add stock” to record the vouchers you already hold, or “Place order” for a new purchase. Issuing one then takes it off the stock."
                : "A manager needs to add voucher stock before any can be issued."}
            </EmptyState>
          ) : (
            <VoucherStockTable stock={stock} />
          )}
        </Section>

        {isManager && (
          <div id="orders" className="scroll-mt-4">
            <Section
              flush
              title="Orders"
              description={
                orderRows.length === 0
                  ? "No orders placed yet."
                  : `${openOrders.length} waiting for delivery, ${orderRows.length} in all. Mark an order received when it arrives to add it to the stock.`
              }
            >
              {orderRows.length === 0 ? (
                <EmptyState title="No orders yet">
                  Use “Place order” when you order vouchers. When they arrive, press Receive on the order to record how many came and from
                  which vendor.
                </EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableHead className="pl-5">Ordered on</TableHead>
                      <TableHead>Voucher</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Received on</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-5">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderPages.items.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="pl-5 text-muted-foreground">{fmtDay(o.orderedOnISO)}</TableCell>
                        <TableCell className="font-medium">
                          {o.voucher}
                          {o.note && <p className="max-w-48 truncate text-xs font-normal text-muted-foreground" title={o.note}>{o.note}</p>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{o.quantity}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{o.received}</TableCell>
                        <TableCell className="text-muted-foreground">{o.lastReceipt ? fmtDay(o.lastReceipt) : "—"}</TableCell>
                        <TableCell>{o.vendor || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {o.left === 0 ? (
                            <LampBadge lamp="green">Received</LampBadge>
                          ) : o.received > 0 ? (
                            <LampBadge lamp="blue">{o.left} still to come</LampBadge>
                          ) : (
                            <LampBadge lamp="amber">Waiting</LampBadge>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right whitespace-nowrap">
                          {o.left > 0 && (
                            <ReceiveOrderDialog
                              today={today}
                              vendors={vendors}
                              order={{ id: o.id, voucher: o.voucher, ordered: o.quantity, received: o.received, orderedOn: o.orderedOnISO, vendor: o.vendor }}
                            />
                          )}
                          {o.received === 0 && <CancelOrderButton id={o.id} label={`${o.quantity} ${o.voucher} ordered on ${fmtDay(o.orderedOnISO)}`} />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <Pagination
                window={orderPages}
                href={(n) => pageHref("/vouchers", params, n, { key: "orderPage", hash: "orders" })}
                label="Order pages"
              />
            </Section>
          </div>
        )}

        {history.length > 0 && (
          <div id="history" className="scroll-mt-4">
          <Section
            flush
            title={isManager ? "History" : "Vouchers you issued"}
            description={
              isManager
                ? `${historyTotal} ${historyTotal === 1 ? "entry" : "entries"}, newest first: vouchers issued and stock received.`
                : `${historyTotal} ${historyTotal === 1 ? "entry" : "entries"}, newest first. Your manager sees these too.`
            }
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-5">Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead>Issued to / received from</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="w-12 pr-5">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((e) => {
                  const day = fmtDayLong(dateToISO(e.date));
                  const received = e.quantity > 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-5 text-muted-foreground">{day}</TableCell>
                      <TableCell className="font-medium">{e.voucher}</TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${received ? "text-emerald-700" : ""}`}>
                        {received ? `+${e.quantity}` : e.quantity}
                      </TableCell>
                      <TableCell>
                        {received ? (
                          <span className="text-muted-foreground">Stock received{e.vendor ? ` from ${e.vendor}` : ""}</span>
                        ) : (
                          <>
                            {e.issuedTo}
                            {e.channel && (
                              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{e.channel}</span>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground" title={e.note ?? undefined}>
                        {e.note || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{e.user.name}</TableCell>
                      <TableCell className="pr-5">
                        {(isManager || e.userId === user.id) && (
                          <DeleteVoucherEntryButton
                            id={e.id}
                            label={`${e.voucher} ${received ? `+${e.quantity} received` : `${-e.quantity} issued to ${e.issuedTo}`} on ${day}`}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination window={pages} href={(n) => pageHref("/vouchers", params, n, { hash: "history" })} label="Voucher history pages" />
          </Section>
          </div>
        )}
      </main>
    </div>
  );
}
