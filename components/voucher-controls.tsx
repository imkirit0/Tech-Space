"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, PackagePlus, ShoppingCart, Ticket, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  saveVoucherEntry,
  deleteVoucherEntry,
  placeVoucherOrder,
  receiveVoucherOrder,
  cancelVoucherOrder,
} from "@/app/vouchers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SESSION_ERROR = "Couldn't save. Your session may have expired, so refresh the page.";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * kind "issue": hand out vouchers (stock goes down). kind "stock": record vouchers received (stock goes up).
 * `stock` is what's currently on hand per voucher, used for the issue dropdown.
 */
export function VoucherDialog({
  kind,
  today,
  stock,
}: {
  kind: "issue" | "stock";
  today: string;
  stock: { voucher: string; inStock: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const issue = kind === "issue";
  const available = stock.filter((s) => s.inStock > 0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const r = await saveVoucherEntry({
        kind,
        date: String(fd.get("date")),
        voucher: String(fd.get("voucher") ?? ""),
        quantity: Number(fd.get("quantity")),
        issuedTo: String(fd.get("issuedTo") ?? ""),
        channel: (String(fd.get("channel") ?? "") || undefined) as "GEMS" | "Forms" | undefined,
        vendor: String(fd.get("vendor") ?? ""),
        note: String(fd.get("note") ?? ""),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(issue ? "Voucher issued" : "Stock added");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        {issue ? <Ticket className="size-4" aria-hidden /> : <PackagePlus className="size-4" aria-hidden />}
        {issue ? "Issue voucher" : "Add stock"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{issue ? "Issue voucher" : "Add stock"}</DialogTitle>
          <DialogDescription>
            {issue
              ? "Record a voucher handed out. It comes off the stock straight away."
              : "For vouchers you already hold, or that arrived without an order. For a new purchase, use “Place order” and mark it received when it arrives."}
          </DialogDescription>
        </DialogHeader>
        {issue && available.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no vouchers in stock to issue. A manager needs to add stock first.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${kind}-voucher`}>Voucher</Label>
              {issue ? (
                <select id={`${kind}-voucher`} name="voucher" required className={selectClass} defaultValue="">
                  <option value="" disabled>
                    Choose a voucher
                  </option>
                  {available.map((s) => (
                    <option key={s.voucher} value={s.voucher}>
                      {s.voucher} ({s.inStock} in stock)
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <Input
                    id={`${kind}-voucher`}
                    name="voucher"
                    list="voucher-kinds"
                    required
                    maxLength={40}
                    autoComplete="off"
                    placeholder="Pick from the list, or type a new one"
                  />
                  <datalist id="voucher-kinds">
                    {stock.map((s) => (
                      <option key={s.voucher} value={s.voucher} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${kind}-quantity`}>{issue ? "How many" : "Quantity received"}</Label>
                <Input
                  id={`${kind}-quantity`}
                  name="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  step={1}
                  defaultValue={issue ? 1 : undefined}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${kind}-date`}>Date</Label>
                <Input id={`${kind}-date`} name="date" type="date" defaultValue={today} max={today} required />
              </div>
            </div>
            {issue && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-to">Issued to</Label>
                <Input id="issue-to" name="issuedTo" required maxLength={120} autoComplete="off" placeholder="Student or centre name" />
              </div>
            )}
            {issue && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm leading-none font-medium">Given to</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["GEMS", "Forms"] as const).map((c) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center justify-center rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                    >
                      <input type="radio" name="channel" value={c} required className="sr-only" />
                      {c}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {!issue && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stock-vendor">
                  Vendor <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input id="stock-vendor" name="vendor" maxLength={120} autoComplete="off" placeholder="Who supplied them" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${kind}-note`}>
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`${kind}-note`}
                name="note"
                maxLength={300}
                autoComplete="off"
                placeholder={issue ? "e.g. registration number" : "e.g. invoice number"}
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : issue ? "Issue voucher" : "Add stock"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteVoucherEntryButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    try {
      const r = await deleteVoucherEntry(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Entry removed");
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this entry?"
        description={`${label}. The stock figure is corrected straight away.`}
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />
    </>
  );
}

/** Manager: record an order placed with a supplier. Stock is untouched until the delivery is received. */
export function PlaceOrderDialog({ today, vouchers, vendors }: { today: string; vouchers: string[]; vendors: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const r = await placeVoucherOrder({
        date: String(fd.get("date")),
        voucher: String(fd.get("voucher") ?? ""),
        quantity: Number(fd.get("quantity")),
        vendor: String(fd.get("vendor") ?? ""),
        note: String(fd.get("note") ?? ""),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Order placed");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        <ShoppingCart className="size-4" aria-hidden />
        Place order
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Place order</DialogTitle>
          <DialogDescription>
            Record vouchers you have ordered. The stock goes up only when you mark the order received.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-voucher">Voucher</Label>
            <Input
              id="order-voucher"
              name="voucher"
              list="order-voucher-kinds"
              required
              maxLength={40}
              autoComplete="off"
              placeholder="Pick from the list, or type a new one"
            />
            <datalist id="order-voucher-kinds">
              {vouchers.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="order-quantity">Quantity ordered</Label>
              <Input id="order-quantity" name="quantity" type="number" inputMode="numeric" min={1} max={10000} step={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="order-date">Ordered on</Label>
              <Input id="order-date" name="date" type="date" defaultValue={today} max={today} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-vendor">
              Vendor <span className="font-normal text-muted-foreground">(optional, can be set on delivery)</span>
            </Label>
            <Input id="order-vendor" name="vendor" list="voucher-vendors" maxLength={120} autoComplete="off" placeholder="Who you ordered from" />
            <VendorList vendors={vendors} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="order-note" name="note" maxLength={300} autoComplete="off" placeholder="e.g. purchase order number" />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Place order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VendorList({ vendors }: { vendors: string[] }) {
  return (
    <datalist id="voucher-vendors">
      {vendors.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}

export type OpenOrder = { id: string; voucher: string; ordered: number; received: number; orderedOn: string; vendor: string | null };

/** Manager: mark a delivery against an order: how many arrived, when, and from which vendor. */
export function ReceiveOrderDialog({ order, today, vendors }: { order: OpenOrder; today: string; vendors: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const left = Math.max(0, order.ordered - order.received);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const r = await receiveVoucherOrder({
        orderId: order.id,
        date: String(fd.get("date")),
        quantity: Number(fd.get("quantity")),
        vendor: String(fd.get("vendor") ?? ""),
        note: String(fd.get("note") ?? ""),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Delivery recorded and added to stock");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PackageCheck className="size-4" aria-hidden />
        Receive
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive {order.voucher}</DialogTitle>
          <DialogDescription>
            {order.ordered} ordered{order.received > 0 ? `, ${order.received} already received, ${left} still to come` : ""}. What you
            enter here is added to the stock. If only part has arrived, enter that and receive the rest later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receive-quantity">Quantity received</Label>
              <Input
                id="receive-quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                step={1}
                defaultValue={left || undefined}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="receive-date">Received on</Label>
              <Input id="receive-date" name="date" type="date" defaultValue={today} min={order.orderedOn} max={today} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receive-vendor">Received from (vendor)</Label>
            <Input
              id="receive-vendor"
              name="vendor"
              list="voucher-vendors"
              required
              maxLength={120}
              autoComplete="off"
              defaultValue={order.vendor ?? ""}
              placeholder="Pick a vendor, or type a new one"
            />
            <VendorList vendors={vendors} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receive-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="receive-note" name="note" maxLength={300} autoComplete="off" placeholder="e.g. invoice number" />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Add to stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelOrderButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    try {
      const r = await cancelVoucherOrder(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Order cancelled");
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Cancel order: ${label}`} title="Cancel order" onClick={() => setOpen(true)}>
        <X />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this order?"
        description={`${label}. Nothing has been received against it, so the stock is not affected.`}
        confirmLabel="Cancel order"
        onConfirm={onConfirm}
      />
    </>
  );
}
