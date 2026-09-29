export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

type Viewer = { id: string; role: "EMPLOYEE" | "MANAGER" };
type TaskAccess = { assigneeId: string | null; createdById: string; shared: boolean };

const involved = (user: Viewer, task: TaskAccess) => task.assigneeId === user.id || task.createdById === user.id;

/** Managers see every task; shared (team board) tasks are visible to all; private ones to those involved. */
export function canViewTask(user: Viewer, task: TaskAccess): boolean {
  return user.role === "MANAGER" || task.shared || involved(user, task);
}

/** Anyone who can see a task can post to its thread (comments, questions, offers of help). */
export const canPostToTask = canViewTask;

/** Status moves belong to the person doing it, whoever raised it, and managers. */
export function canChangeTaskStatus(user: Viewer, task: TaskAccess): boolean {
  return user.role === "MANAGER" || involved(user, task);
}

/** An unassigned task can be taken up by anyone who can see it. */
export function canTakeUpTask(user: Viewer, task: TaskAccess): boolean {
  return task.assigneeId === null && canViewTask(user, task);
}

/** The assignee (or a manager) can hand a shared task back to the board. */
export function canReleaseTask(user: Viewer, task: TaskAccess): boolean {
  return task.assigneeId !== null && task.shared && (task.assigneeId === user.id || user.role === "MANAGER");
}

/** Managers edit anything; staff edit and delete tasks they created. */
export function canEditTask(user: Viewer, task: { createdById: string }): boolean {
  return user.role === "MANAGER" || task.createdById === user.id;
}

/** Only managers assign work directly to other people or keep tasks private. */
export function canManageTasks(user: Viewer): boolean {
  return user.role === "MANAGER";
}

/**
 * Unread when someone else posted after this user last opened the thread.
 * Your own messages never make a task unread for you.
 */
export function isTaskUnread(
  task: { lastActivityAt: Date; lastActivityById: string | null },
  lastReadAt: Date | null | undefined,
  userId: string
): boolean {
  if (task.lastActivityById === userId) return false;
  return !lastReadAt || task.lastActivityAt > lastReadAt;
}

export function isTaskOverdue(dueISO: string | null, status: TaskStatus, todayISO: string): boolean {
  return !!dueISO && status !== "DONE" && dueISO < todayISO;
}

export function statusChangeText(name: string, to: TaskStatus): string {
  return `${name} moved this to ${TASK_STATUS_LABEL[to]}`;
}
