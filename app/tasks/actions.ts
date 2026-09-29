"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/session";
import { taskSchema, taskUpdateSchema, type TaskInput } from "@/lib/validation";
import { safeErrorMessage } from "@/lib/errors";
import { parseISODate } from "@/lib/dates";
import {
  canChangeTaskStatus,
  canEditTask,
  canPostToTask,
  canReleaseTask,
  canTakeUpTask,
  canViewTask,
  type TaskStatus,
} from "@/lib/tasks";

type Result = { ok: true } | { ok: false; error: string };

const ACCESS = { assigneeId: true, createdById: true, shared: true, status: true } as const;

function revalidate() {
  revalidatePath("/tasks");
  revalidatePath("/manager");
}

async function markRead(userId: string, taskId: string, at = new Date()) {
  await prisma.taskRead.upsert({
    where: { userId_taskId: { userId, taskId } },
    update: { lastReadAt: at },
    create: { userId, taskId, lastReadAt: at },
  });
}

/**
 * Who a task goes to and whether it's on the team board, by role.
 * Staff can only leave it open or take it themselves, and their tasks are always shared.
 * Nobody assigned → it must be on the board, or no one could ever pick it up.
 */
function placement(user: SessionUser, v: TaskInput): { assigneeId: string | null; shared: boolean } | string {
  const assigneeId = v.assigneeId || null;
  if (user.role !== "MANAGER") {
    if (assigneeId && assigneeId !== user.id) return "Only managers can assign tasks to other people.";
    return { assigneeId, shared: true };
  }
  return { assigneeId, shared: assigneeId ? v.shared : true };
}

export async function createTask(
  input: TaskInput
): Promise<{ ok: true; id: string; num: number } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const place = placement(user, v);
  if (typeof place === "string") return { ok: false, error: place };
  try {
    if (place.assigneeId) {
      const exists = await prisma.user.findUnique({ where: { id: place.assigneeId }, select: { id: true } });
      if (!exists) return { ok: false, error: "That person no longer exists. Refresh and pick again." };
    }
    const now = new Date();
    const task = await prisma.task.create({
      data: {
        title: v.title,
        description: v.description || null,
        priority: v.priority,
        dueDate: v.dueDate ? parseISODate(v.dueDate) : null,
        ...place,
        // Taking it yourself means you've started.
        status: place.assigneeId === user.id ? "IN_PROGRESS" : "TODO",
        createdById: user.id,
        lastActivityAt: now,
        lastActivityById: user.id,
      },
      select: { id: true, num: true },
    });
    await markRead(user.id, task.id, now);
    revalidate();
    return { ok: true, id: task.id, num: task.num };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function editTask(taskId: string, input: TaskInput): Promise<Result> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const existing = await prisma.task.findUnique({ where: { id: taskId }, select: ACCESS });
    if (!existing) return { ok: false, error: "Task not found. It may have been deleted." };
    if (!canEditTask(user, existing)) return { ok: false, error: "Only whoever created this task, or a manager, can edit it." };

    // Staff edit the words; who's doing it changes through take up / release.
    const place = user.role === "MANAGER" ? placement(user, v) : { assigneeId: existing.assigneeId, shared: true };
    if (typeof place === "string") return { ok: false, error: place };
    const reassigned = existing.assigneeId !== place.assigneeId;
    const now = new Date();
    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: {
          title: v.title,
          description: v.description || null,
          priority: v.priority,
          dueDate: v.dueDate ? parseISODate(v.dueDate) : null,
          ...place,
          lastActivityAt: now,
          lastActivityById: user.id,
        },
      }),
      prisma.taskUpdate.create({
        data: {
          taskId,
          authorId: user.id,
          body: reassigned
            ? place.assigneeId
              ? `${user.name} reassigned this task`
              : `${user.name} put this back on the team board`
            : `${user.name} edited the task details`,
          createdAt: now,
        },
      }),
    ]);
    await markRead(user.id, taskId, now);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Claim an unassigned task. Atomic, so two people clicking at once can't both win. */
export async function takeUpTask(taskId: string): Promise<Result> {
  const user = await requireUser();
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: ACCESS });
    if (!task || !canViewTask(user, task)) return { ok: false, error: "Task not found." };
    if (!canTakeUpTask(user, task)) return { ok: false, error: "Someone already took this up. Refresh to see who." };
    const now = new Date();
    const startIt = task.status === "TODO";
    const claimed = await prisma.task.updateMany({
      where: { id: taskId, assigneeId: null },
      data: {
        assigneeId: user.id,
        ...(startIt && { status: "IN_PROGRESS" }),
        lastActivityAt: now,
        lastActivityById: user.id,
      },
    });
    if (claimed.count === 0) return { ok: false, error: "Someone took this up a moment ago. Refresh to see who." };
    await prisma.taskUpdate.create({
      data: {
        taskId,
        authorId: user.id,
        body: `${user.name} took this up`,
        statusTo: startIt ? "IN_PROGRESS" : null,
        createdAt: now,
      },
    });
    await markRead(user.id, taskId, now);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Hand a shared task back to the board so someone else can take it. */
export async function releaseTask(taskId: string): Promise<Result> {
  const user = await requireUser();
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: ACCESS });
    if (!task || !canViewTask(user, task)) return { ok: false, error: "Task not found." };
    if (!canReleaseTask(user, task)) return { ok: false, error: "Only the person doing this task can release it." };
    const now = new Date();
    await prisma.$transaction([
      prisma.task.update({
        where: { id: taskId },
        data: {
          assigneeId: null,
          status: task.status === "DONE" ? "DONE" : "TODO",
          lastActivityAt: now,
          lastActivityById: user.id,
        },
      }),
      prisma.taskUpdate.create({
        data: { taskId, authorId: user.id, body: `${user.name} released this back to the team board`, createdAt: now },
      }),
    ]);
    await markRead(user.id, taskId, now);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

/** Post a message to the task's thread, optionally moving it to a new status. */
export async function postTaskUpdate(taskId: string, input: { body: string; statusTo?: TaskStatus }): Promise<Result> {
  const user = await requireUser();
  const parsed = taskUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: ACCESS });
    if (!task || !canPostToTask(user, task)) return { ok: false, error: "Task not found." };

    const statusTo = v.statusTo && v.statusTo !== task.status ? v.statusTo : undefined;
    if (statusTo && !canChangeTaskStatus(user, task))
      return { ok: false, error: "Only the person doing this task, its creator or a manager can change its status." };
    if (!statusTo && !v.body) return { ok: true }; // nothing changed

    const now = new Date();
    await prisma.$transaction([
      prisma.taskUpdate.create({
        data: { taskId, authorId: user.id, body: v.body, statusTo: statusTo ?? null, createdAt: now },
      }),
      prisma.task.update({
        where: { id: taskId },
        data: {
          lastActivityAt: now,
          lastActivityById: user.id,
          ...(statusTo && { status: statusTo, completedAt: statusTo === "DONE" ? now : null }),
        },
      }),
    ]);
    await markRead(user.id, taskId, now);
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function markTaskRead(taskId: string): Promise<Result> {
  const user = await requireUser();
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: ACCESS });
    if (!task || !canViewTask(user, task)) return { ok: false, error: "Task not found." };
    await markRead(user.id, taskId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}

export async function deleteTask(taskId: string): Promise<Result> {
  const user = await requireUser();
  try {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { createdById: true } });
    if (!task) return { ok: false, error: "Task not found." };
    if (!canEditTask(user, task)) return { ok: false, error: "Only whoever created this task, or a manager, can delete it." };
    await prisma.task.delete({ where: { id: taskId } });
    revalidate();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: safeErrorMessage(e) };
  }
}
