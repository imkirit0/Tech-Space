"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTask } from "@/app/tasks/actions";
import { TaskForm, type Person, type TaskSaved } from "@/components/task-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { openTaskWhatsApp } from "@/lib/task-whatsapp";
import { displayPhone } from "@/lib/whatsapp";

export function AssignTaskDialog({
  people,
  today,
  managerName,
  isManager,
  meId,
}: {
  people: Person[];
  today: string;
  managerName: string;
  isManager: boolean;
  meId: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<(TaskSaved & { assigneeName: string }) | null>(null);
  const router = useRouter();

  function close() {
    setOpen(false);
    if (done?.id) router.push(`/tasks?t=${done.id}`);
    setDone(null);
  }

  function notify() {
    if (!done?.id || !done.num || !done.phone) return;
    const ok = openTaskWhatsApp(done.phone, {
      id: done.id,
      num: done.num,
      title: done.input.title,
      priority: done.input.priority,
      dueDate: done.input.dueDate ?? null,
      assigneeName: done.assigneeName,
      managerName,
    });
    if (!ok) toast.error("That WhatsApp number looks invalid. Fix it from the task later.");
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        <Plus className="size-4" aria-hidden />
        {isManager ? "Assign task" : "Add task"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {done ? (
          <>
            <DialogHeader>
              <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
              <DialogTitle>
                Task #{done.num} assigned to {done.assigneeName}
              </DialogTitle>
              <DialogDescription>
                {done.phone
                  ? `Let them know on WhatsApp (${displayPhone(done.phone)}). The message includes the task, priority, due date and a link.`
                  : `${done.assigneeName} hasn't added a WhatsApp number yet. They'll still see it under Tasks with an unread badge.`}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              {done.phone && (
                <Button size="lg" onClick={notify}>
                  <MessageCircle />
                  Notify on WhatsApp
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={close}>
                {done.phone ? "Skip" : "Open task"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isManager ? "Assign a task" : "Add a task"}</DialogTitle>
              <DialogDescription>
                {isManager
                  ? "Give it to someone, or put it on the team board for anyone to take up."
                  : "Post it on the team board for anyone to take up, or take it yourself. Everyone can follow its progress."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              people={people}
              minDate={today}
              action={createTask}
              isManager={isManager}
              meId={meId}
              onSuccess={(saved) => {
                // Only a hand-off to someone else gets the "let them know" step.
                if (saved.input.assigneeId && saved.input.assigneeId !== meId) {
                  setDone({ ...saved, assigneeName: people.find((p) => p.id === saved.input.assigneeId)?.name ?? "them" });
                } else {
                  setOpen(false);
                  if (saved.id) router.push(`/tasks?t=${saved.id}`);
                }
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
