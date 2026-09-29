"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";
import { safeErrorMessage } from "@/lib/errors";
import { hashPassword, normalizeUsername, passwordProblem, usernameProblem } from "@/lib/password";

type Result = { ok: true } | { ok: false; error: string };

const accountSchema = z.object({
  name: z.string().trim().min(2, "Enter their full name").max(100),
  username: z.string(),
  designation: z.string().trim().max(100).optional(),
  role: z.enum(["EMPLOYEE", "MANAGER"]),
  tech: z.boolean(),
});
export type AccountInput = z.infer<typeof accountSchema>;

function checkUsername(raw: string): { username: string } | { error: string } {
  const username = normalizeUsername(raw);
  const problem = usernameProblem(username);
  return problem ? { error: problem } : { username };
}

async function usernameTaken(username: string, exceptId?: string) {
  const u = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  return !!u && u.id !== exceptId;
}

export async function createAccount(input: AccountInput & { password: string }): Promise<Result> {
  await requireManager();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const u = checkUsername(parsed.data.username);
  if ("error" in u) return { ok: false, error: u.error };
  const pwProblem = passwordProblem(input.password);
  if (pwProblem) return { ok: false, error: pwProblem };
  try {
    if (await usernameTaken(u.username)) return { ok: false, error: `“${u.username}” is already taken.` };
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: u.username,
        designation: parsed.data.designation || null,
        role: parsed.data.role,
        tech: parsed.data.tech,
        passwordHash: await hashPassword(input.password),
      },
    });
    revalidatePath("/manager/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function updateAccount(id: string, input: AccountInput): Promise<Result> {
  const me = await requireManager();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const u = checkUsername(parsed.data.username);
  if ("error" in u) return { ok: false, error: u.error };
  if (id === me.id && parsed.data.role !== "MANAGER")
    return { ok: false, error: "You can't remove your own manager role. Ask another manager." };
  try {
    if (await usernameTaken(u.username, id)) return { ok: false, error: `“${u.username}” is already taken.` };
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        username: u.username,
        designation: parsed.data.designation || null,
        role: parsed.data.role,
        tech: parsed.data.tech,
      },
    });
    revalidatePath("/manager/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function resetPassword(id: string, password: string): Promise<Result> {
  await requireManager();
  const pwProblem = passwordProblem(password);
  if (pwProblem) return { ok: false, error: pwProblem };
  try {
    const u = await prisma.user.findUnique({ where: { id }, select: { username: true } });
    if (!u) return { ok: false, error: "Account not found." };
    if (!u.username) return { ok: false, error: "Give them a username first (Edit), then set a password." };
    await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    revalidatePath("/manager/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Switch an account off (can't sign in, history kept) or back on. */
export async function setAccountActive(id: string, active: boolean): Promise<Result> {
  const me = await requireManager();
  if (id === me.id && !active) return { ok: false, error: "You can't switch off your own account." };
  try {
    if (!active) {
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === "MANAGER") {
        const managers = await prisma.user.count({ where: { role: "MANAGER", active: true } });
        if (managers <= 1) return { ok: false, error: "At least one manager must stay active." };
      }
    }
    await prisma.user.update({ where: { id }, data: { active } });
    revalidatePath("/manager/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
