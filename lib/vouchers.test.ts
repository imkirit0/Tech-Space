import { expect, test } from "vitest";
import { outstanding, outstandingByVoucher, voucherStock } from "./vouchers";

test("voucherStock nets received against issued and flags what to order", () => {
  const stock = voucherStock(
    [
      { voucher: "MOS", quantity: 50, date: "2026-10-01" },
      { voucher: "MOS", quantity: -30, date: "2026-11-01" }, // recent: counts toward the rate
      { voucher: "MOS", quantity: -5, date: "2026-10-02" }, // older than the rate window
      { voucher: "META", quantity: 8, date: "2026-10-01" },
      { voucher: "IC3", quantity: 4, date: "2026-10-01" },
      { voucher: "IC3", quantity: -4, date: "2026-11-05" },
    ],
    "2026-10-15"
  );
  // Out of stock first, then low, then healthy.
  expect(stock.map((s) => [s.voucher, s.inStock, s.state])).toEqual([
    ["IC3", 0, "out"],
    ["META", 8, "low"],
    ["MOS", 15, "ok"],
  ]);
  // 15 left at 30 issued per 30 days = 15 days.
  expect(stock[2]).toMatchObject({ issuedRecently: 30, daysLeft: 15 });
  // Nothing issued recently: no estimate.
  expect(stock[1].daysLeft).toBeNull();
});

test("orders count as on order until delivered, across part deliveries", () => {
  const orders = [
    { voucher: "MOS", quantity: 50, receipts: [{ quantity: 20 }, { quantity: 10 }] }, // 20 still to come
    { voucher: "MOS", quantity: 10, receipts: [] },
    { voucher: "META", quantity: 30, receipts: [{ quantity: 35 }] }, // over-delivered: nothing outstanding
    { voucher: "NEW", quantity: 5, receipts: [] }, // never stocked before
  ];
  expect(outstanding(orders[0])).toBe(20);
  expect(outstanding(orders[2])).toBe(0);
  const onOrder = outstandingByVoucher(orders);
  expect([...onOrder]).toEqual([["MOS", 30], ["NEW", 5]]);
  const stock = voucherStock([{ voucher: "MOS", quantity: 4, date: "2026-11-01" }], "2026-10-15", onOrder);
  expect(stock.map((s) => [s.voucher, s.inStock, s.onOrder])).toEqual([["NEW", 0, 5], ["MOS", 4, 30]]);
});
