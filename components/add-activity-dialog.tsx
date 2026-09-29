"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ActivityForm } from "@/components/activity-form";
import { createActivity } from "@/app/activities/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddActivityDialog({
  maxDate,
  variant = "board",
}: {
  maxDate: string;
  variant?: "board" | "default";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size="lg" />}>
        <Plus className="size-4" aria-hidden />
        Add activity
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>Log one piece of work. You can edit it until the period is locked.</DialogDescription>
        </DialogHeader>
        <ActivityForm action={createActivity} maxDate={maxDate} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
