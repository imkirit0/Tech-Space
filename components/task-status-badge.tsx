import { LampBadge, type Lamp } from "@/components/status-badge";
import { TASK_STATUS_LABEL, type TaskStatus } from "@/lib/tasks";

export const TASK_LAMP: Record<TaskStatus, Lamp> = {
  TODO: "amber",
  IN_PROGRESS: "blue",
  BLOCKED: "red",
  DONE: "green",
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <LampBadge lamp={TASK_LAMP[status]} className={className}>
      {TASK_STATUS_LABEL[status]}
    </LampBadge>
  );
}
