"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { safeErrorMessage } from "@/lib/errors";
import { normalizePhone } from "@/lib/whatsapp";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { lockedFor, recordFailure, recordSuccess } from "@/lib/login-guard";

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

/** Change your own password; the current one is required. */
export async function changeMyPassword(
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  if (current === next) return { ok: false, error: "Pick a password different from your current one." };
  try {
    const key = `change:${user.id}`;
    if (lockedFor(key) > 0) return { ok: false, error: "Too many wrong attempts. Try again in 15 minutes." };
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(current, me?.passwordHash))) {
      recordFailure(key);
      return { ok: false, error: "Your current password isn't right." };
    }
    recordSuccess(key);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
