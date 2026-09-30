"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRegistration, deleteRegistration } from "@/app/registrations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SESSION_ERROR = "Couldn't save. Your session may have expired, so refresh the page.";

export function AddRegistrationDialog({ today, programs }: { today: string; programs: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const r = await saveRegistration({
        date: String(fd.get("date")),
        program: String(fd.get("program")),
        count: Number(fd.get("count")),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Registrations saved");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        <Plus className="size-4" aria-hidden />
        Add registrations
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add registrations</DialogTitle>
          <DialogDescription>
            How many signed up for a program that day. Entering the same program and day again replaces the count; 0 removes it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-date">Date</Label>
            <Input id="reg-date" name="date" type="date" defaultValue={today} max={today} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-program">Program</Label>
            <Input
              id="reg-program"
              name="program"
              list="reg-programs"
              required
              maxLength={40}
              autoComplete="off"
              placeholder="Tally, IAB, MOS… or type a new one"
            />
            <datalist id="reg-programs">
              {programs.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-count">Registrations</Label>
            <Input id="reg-count" name="count" type="number" inputMode="numeric" min={0} max={10000} step={1} required />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteRegistrationButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    try {
      const r = await deleteRegistration(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Entry removed");
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    }
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={() => setOpen(true)}>
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove this entry?"
        description={label}
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />
    </>
  );
}
