"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeErrorMessage } from "@/lib/errors";
import { normalizePhone } from "@/lib/whatsapp";

/** Save a WhatsApp number. Anyone can set their own; managers can set anyone's. Empty clears it. */
export async function setWhatsAppNumber(
  userId: string,
  raw: string
): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  const user = await requireUser();
  if (userId !== user.id && user.role !== "MANAGER") return { ok: false, error: "You can only change your own number." };
  const trimmed = raw.trim();
  const phone = trimmed ? normalizePhone(trimmed) : null;
  if (trimmed && !phone) return { ok: false, error: "Enter a valid mobile number, e.g. 98470 12345." };
  try {
    await prisma.user.update({ where: { id: userId }, data: { phone } });
    revalidatePath("/", "layout");
    return { ok: true, phone };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
