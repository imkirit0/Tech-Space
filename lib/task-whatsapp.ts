import { buildWaLink, taskAssignedMessage } from "@/lib/whatsapp";

export type NotifyTask = {
  id: string;
  num: number;
  title: string;
  priority: string;
  dueDate: string | null;
  assigneeName: string;
  managerName: string;
};

/**
 * Opens WhatsApp (app or web) with the assignment message pre-filled.
 * Client-only: the task link uses this site's own origin.
 */
export function openTaskWhatsApp(phone: string, task: NotifyTask): boolean {
  const url = `${window.location.origin}/tasks?t=${task.id}`;
  const link = buildWaLink(phone, taskAssignedMessage({ ...task, url }));
  if (!link) return false;
  window.open(link, "_blank", "noopener");
  return true;
}
