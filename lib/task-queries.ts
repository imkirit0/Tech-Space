import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isTaskUnread } from "@/lib/tasks";
import type { SessionUser } from "@/lib/session";

/** Tasks a user may see: managers see all; others see the team board plus what involves them. */
export function visibleTasksWhere(user: SessionUser): Prisma.TaskWhereInput {
  return user.role === "MANAGER"
    ? {}
    : { OR: [{ shared: true }, { assigneeId: user.id }, { createdById: user.id }] };
}

/** Tasks this user is part of: doing it or raised it. */
export function involvedWhere(user: SessionUser): Prisma.TaskWhereInput {
  return { OR: [{ assigneeId: user.id }, { createdById: user.id }] };
}

/**
 * How many threads have news for this user (drives the nav badge).
 * Only tasks you're part of count, so a busy team board doesn't ping everyone.
 */
export async function unreadTaskCount(user: SessionUser): Promise<number> {
  // ponytail: only threads active in the last 30 days are scanned for the badge
  const since = new Date(Date.now() - 30 * 86400_000);
  const tasks = await prisma.task.findMany({
    where: {
      ...involvedWhere(user),
      lastActivityAt: { gte: since },
      NOT: { lastActivityById: user.id },
    },
    select: { lastActivityAt: true, lastActivityById: true, reads: { where: { userId: user.id }, select: { lastReadAt: true } } },
  });
  return tasks.filter((t) => isTaskUnread(t, t.reads[0]?.lastReadAt, user.id)).length;
}
