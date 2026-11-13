"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireManager, requireUser } from "@/lib/session";
import {
  voucherSchema,
  voucherOrderSchema,
  voucherReceiptSchema,
  type VoucherInput,
  type VoucherOrderInput,
  type VoucherReceiptInput,
} from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";
import { parseISODate } from "@/lib/dates";

type Result = { ok: true } | { ok: false; error: string };

/** Reuses an existing voucher's spelling so "mos" and "MOS" share one stock figure; new names go in capitals. */
async function voucherName(typed: string): Promise<{ voucher: string; known: boolean }> {
  const where = { voucher: { equals: typed, mode: "insensitive" as const } };
  const [entry, order] = await Promise.all([
    prisma.voucherEntry.findFirst({ where, select: { voucher: true } }),
    prisma.voucherOrder.findFirst({ where, select: { voucher: true } }),
  ]);
  // `known` means there has been stock for it, which is what issuing needs.
  return { voucher: entry?.voucher ?? order?.voucher ?? typed.replace(/\s+/g, " ").toUpperCase(), known: !!entry };
}

/** kind "issue" takes vouchers out of stock (anyone); kind "stock" adds received vouchers (managers). */
export async function saveVoucherEntry(input: VoucherInput): Promise<Result> {
  const user = await requireUser();
  const parsed = voucherSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.kind === "stock" && user.role !== "MANAGER") return { ok: false, error: "Only a manager can add stock." };
  try {
    const { voucher, known } = await voucherName(v.voucher);
    if (v.kind === "issue") {
      // ponytail: check-then-insert, so two people issuing the last voucher in the same instant could
      // both succeed; wrap in a serializable transaction if that ever happens in practice.
      const { _sum } = await prisma.voucherEntry.aggregate({ where: { voucher }, _sum: { quantity: true } });
      const inStock = _sum.quantity ?? 0;
      if (!known) return { ok: false, error: "No stock has been added for that voucher yet." };
      if (v.quantity > inStock)
        return { ok: false, error: inStock > 0 ? `Only ${inStock} ${voucher} in stock.` : `${voucher} is out of stock.` };
    }
    await prisma.voucherEntry.create({
      data: {
        voucher,
        quantity: v.kind === "issue" ? -v.quantity : v.quantity,
        date: parseISODate(v.date),
        issuedTo: v.kind === "issue" ? v.issuedTo || null : null,
        channel: v.kind === "issue" ? v.channel ?? null : null,
        vendor: v.kind === "stock" ? v.vendor || null : null,
        note: v.note || null,
        userId: user.id,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Undo a mistaken entry: managers can remove any, staff only their own. */
export async function deleteVoucherEntry(id: string): Promise<Result> {
  const user = await requireUser();
  try {
    const existing = await prisma.voucherEntry.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Not found" };
    if (user.role !== "MANAGER" && existing.userId !== user.id) return { ok: false, error: "Forbidden" };
    if (existing.quantity > 0) {
      // Removing received stock must not leave more issued than was ever received.
      const { _sum } = await prisma.voucherEntry.aggregate({ where: { voucher: existing.voucher }, _sum: { quantity: true } });
      if ((_sum.quantity ?? 0) - existing.quantity < 0)
        return { ok: false, error: "Some of this stock has already been issued, so it can't be removed." };
    }
    await prisma.voucherEntry.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Record an order placed with a supplier. Stock does not change until a delivery is received. */
export async function placeVoucherOrder(input: VoucherOrderInput): Promise<Result> {
  const user = await requireManager();
  const parsed = voucherOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const { voucher } = await voucherName(v.voucher);
    await prisma.voucherOrder.create({
      data: { voucher, quantity: v.quantity, orderedOn: parseISODate(v.date), vendor: v.vendor || null, note: v.note || null, userId: user.id },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Record a delivery against an order: adds the received quantity to stock and notes the vendor. */
export async function receiveVoucherOrder(input: VoucherReceiptInput): Promise<Result> {
  const user = await requireManager();
  const parsed = voucherReceiptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const order = await prisma.voucherOrder.findUnique({ where: { id: v.orderId } });
    if (!order) return { ok: false, error: "That order no longer exists." };
    if (parseISODate(v.date) < order.orderedOn) return { ok: false, error: "The delivery can't be dated before the order." };
    await prisma.$transaction([
      prisma.voucherEntry.create({
        data: {
          voucher: order.voucher,
          quantity: v.quantity,
          date: parseISODate(v.date),
          orderId: order.id,
          vendor: v.vendor,
          note: v.note || null,
          userId: user.id,
        },
      }),
      // Keep the order showing the vendor it actually came from.
      prisma.voucherOrder.update({ where: { id: order.id }, data: { vendor: v.vendor } }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Cancel an order nothing has been delivered against. */
export async function cancelVoucherOrder(id: string): Promise<Result> {
  await requireManager();
  try {
    const received = await prisma.voucherEntry.count({ where: { orderId: id } });
    if (received > 0) return { ok: false, error: "Part of this order has been received, so it can't be cancelled." };
    await prisma.voucherOrder.deleteMany({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
