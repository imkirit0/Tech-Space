"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { registrationSchema, type RegistrationInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";
import { parseISODate } from "@/lib/dates";

type Result = { ok: true } | { ok: false; error: string };

/** Sets the caller's count for a program on a day. Re-entering replaces it; 0 clears it. */
export async function saveRegistration(input: RegistrationInput): Promise<Result> {
  const user = await requireUser();
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    // Reuse an existing program's spelling so "tally" and "Tally" total together.
    const known = await prisma.registration.findFirst({
      where: { program: { equals: v.program, mode: "insensitive" } },
      select: { program: true },
    });
    const program = known?.program ?? v.program;
    const key = { userId: user.id, date: parseISODate(v.date), program };
    if (v.count === 0) {
      await prisma.registration.deleteMany({ where: key });
    } else {
      await prisma.registration.upsert({
        where: { userId_date_program: key },
        create: { ...key, count: v.count },
        update: { count: v.count },
      });
    }
    revalidatePath("/registrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function deleteRegistration(id: string): Promise<Result> {
  const user = await requireUser();
  try {
    const existing = await prisma.registration.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return { ok: false, error: "Not found" };
    if (user.role !== "MANAGER" && existing.userId !== user.id) return { ok: false, error: "Forbidden" };
    await prisma.registration.delete({ where: { id } });
    revalidatePath("/registrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
