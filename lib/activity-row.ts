import type { Activity } from "@prisma/client";
import { dateToISO } from "./dates";

// Formatted on the server so the client never re-renders timestamps in another zone.
const STAMP = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** Serialises an activity for ManagerActivityTable (rows + the details dialog). */
export function toManagerRow(a: Activity) {
  return {
    id: a.id,
    date: a.date ? dateToISO(a.date) : null,
    employeeName: a.employeeName,
    designation: a.designation,
    activity: a.activity,
    description: a.description,
    status: a.status,
    assignedBy: a.assignedBy,
    timeTaken: Number(a.timeTaken),
    deadline: a.deadline ? dateToISO(a.deadline) : null,
    managerComment: a.managerComment,
    commentedBy: a.commentedBy,
    commentedAt: a.commentedAt ? STAMP.format(a.commentedAt) : null,
    loggedAt: STAMP.format(a.createdAt),
    // Prisma bumps updatedAt on comments too, so only call it edited when it moved past both.
    editedAt:
      a.updatedAt.getTime() - Math.max(a.createdAt.getTime(), a.commentedAt?.getTime() ?? 0) > 1000
        ? STAMP.format(a.updatedAt)
        : null,
  };
}
