"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { examRecordSchema, type ExamRecordInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";
import { parseISODate } from "@/lib/dates";

type Result = { ok: true } | { ok: false; error: string };

/** Create a new exam record, or update one the caller owns when an id is given. */
export async function saveExamRecord(input: ExamRecordInput): Promise<Result> {
  const user = await requireUser();
  const parsed = examRecordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    // Reuse an existing exam's spelling so "tally" and "Tally" total together; new names go in capitals.
    const known = await prisma.examRecord.findFirst({
      where: { exam: { equals: v.exam, mode: "insensitive" } },
      select: { exam: true },
    });
    const exam = known?.exam ?? v.exam.replace(/\s+/g, " ").toUpperCase();
    const data = {
      date: parseISODate(v.date),
      exam,
      certificateName: v.certificateName || null,
      center: v.center || null,
      vendor: v.vendor || null,
      conducted: v.conducted,
      passed: v.passed,
      failed: v.failed,
      reassessed: v.reassessed,
      urgent: v.urgent,
      normal: v.normal,
      source: v.source ?? null,
      note: v.note || null,
    };
    if (v.id) {
      const existing = await prisma.examRecord.findUnique({ where: { id: v.id }, select: { userId: true } });
      if (!existing) return { ok: false, error: "That record no longer exists." };
      if (user.role !== "MANAGER" && existing.userId !== user.id) return { ok: false, error: "Forbidden" };
      await prisma.examRecord.update({ where: { id: v.id }, data });
    } else {
      await prisma.examRecord.create({ data: { ...data, userId: user.id } });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function deleteExamRecord(id: string): Promise<Result> {
  const user = await requireUser();
  try {
    const existing = await prisma.examRecord.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) return { ok: false, error: "Not found" };
    if (user.role !== "MANAGER" && existing.userId !== user.id) return { ok: false, error: "Forbidden" };
    await prisma.examRecord.delete({ where: { id } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
