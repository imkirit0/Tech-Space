"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TicketForm } from "@/components/ticket-form";
import { createTicket } from "@/app/tickets/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewTicketDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        <Plus className="size-4" aria-hidden />
        New ticket
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>Search the list first so the same complaint isn't logged twice.</DialogDescription>
        </DialogHeader>
        <TicketForm action={createTicket} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
