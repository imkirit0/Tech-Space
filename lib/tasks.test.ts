import { describe, it, expect } from "vitest";
import {
  canViewTask,
  canPostToTask,
  canChangeTaskStatus,
  canTakeUpTask,
  canReleaseTask,
  canEditTask,
  canManageTasks,
  isTaskUnread,
  isTaskOverdue,
  statusChangeText,
} from "./tasks";

const emp = { id: "e1", role: "EMPLOYEE" as const };
const other = { id: "e2", role: "EMPLOYEE" as const };
const mgr = { id: "m1", role: "MANAGER" as const };

const priv = { assigneeId: "e1", createdById: "m1", shared: false };
const board = { assigneeId: null, createdById: "e2", shared: true };
const boardTaken = { assigneeId: "e1", createdById: "e2", shared: true };

describe("private tasks", () => {
  it("only the people involved and managers can see them", () => {
    expect(canViewTask(emp, priv)).toBe(true);
    expect(canViewTask(other, priv)).toBe(false);
    expect(canViewTask(mgr, { ...priv, assigneeId: "e9", createdById: "m9" })).toBe(true);
  });
  it("only managers manage", () => {
    expect(canManageTasks(mgr)).toBe(true);
    expect(canManageTasks(emp)).toBe(false);
  });
});

describe("team board tasks", () => {
  it("everyone can see and comment", () => {
    expect(canViewTask(emp, board)).toBe(true);
    expect(canPostToTask(emp, board)).toBe(true);
  });
  it("anyone can take up an unassigned task, nobody can take an assigned one", () => {
    expect(canTakeUpTask(emp, board)).toBe(true);
    expect(canTakeUpTask(other, boardTaken)).toBe(false);
  });
  it("bystanders comment but cannot move status", () => {
    const bystander = { id: "e3", role: "EMPLOYEE" as const };
    expect(canPostToTask(bystander, boardTaken)).toBe(true);
    expect(canChangeTaskStatus(bystander, boardTaken)).toBe(false);
    expect(canChangeTaskStatus(emp, boardTaken)).toBe(true); // assignee
    expect(canChangeTaskStatus(other, boardTaken)).toBe(true); // creator
  });
  it("assignee or a manager can release it back to the board", () => {
    expect(canReleaseTask(emp, boardTaken)).toBe(true);
    expect(canReleaseTask(mgr, boardTaken)).toBe(true);
    expect(canReleaseTask(other, boardTaken)).toBe(false);
    expect(canReleaseTask(emp, board)).toBe(false);
    expect(canReleaseTask(emp, priv)).toBe(false); // private assignments aren't released to a board
  });
  it("creators edit their own; managers edit all", () => {
    expect(canEditTask(other, board)).toBe(true);
    expect(canEditTask(emp, board)).toBe(false);
    expect(canEditTask(mgr, board)).toBe(true);
  });
});

describe("isTaskUnread", () => {
  const t = (at: string, by: string | null) => ({ lastActivityAt: new Date(at), lastActivityById: by });
  it("never read → unread if someone else posted", () => {
    expect(isTaskUnread(t("2026-09-29T10:00:00Z", "m1"), null, "e1")).toBe(true);
  });
  it("own last message is never unread", () => {
    expect(isTaskUnread(t("2026-09-29T10:00:00Z", "e1"), null, "e1")).toBe(false);
  });
  it("read after the last activity → read; activity after read → unread", () => {
    expect(isTaskUnread(t("2026-09-29T10:00:00Z", "m1"), new Date("2026-09-29T11:00:00Z"), "e1")).toBe(false);
    expect(isTaskUnread(t("2026-09-29T12:00:00Z", "m1"), new Date("2026-09-29T11:00:00Z"), "e1")).toBe(true);
  });
});

describe("isTaskOverdue", () => {
  it("past due and not done", () => {
    expect(isTaskOverdue("2026-09-28", "IN_PROGRESS", "2026-09-29")).toBe(true);
    expect(isTaskOverdue("2026-09-29", "TODO", "2026-09-29")).toBe(false);
    expect(isTaskOverdue("2026-09-28", "DONE", "2026-09-29")).toBe(false);
    expect(isTaskOverdue(null, "TODO", "2026-09-29")).toBe(false);
  });
});

it("statusChangeText reads like a chat event", () => {
  expect(statusChangeText("Anita", "BLOCKED")).toBe("Anita moved this to Blocked");
});
