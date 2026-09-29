"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { setWhatsAppNumber } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { displayPhone } from "@/lib/whatsapp";

/** The avatar on the board opens this: set your own WhatsApp number for task notifications. */
export function PhoneDialog({
  userId,
  phone,
  trigger,
}: {
  userId: string;
  phone: string | null;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("phone") ?? "");
    setPending(true);
    try {
      const r = await setWhatsAppNumber(userId, raw);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.phone ? `Saved ${displayPhone(r.phone)}` : "Number removed");
      setOpen(false);
    } catch {
      toast.error("Couldn't save. Your session may have expired, so refresh the page.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Your WhatsApp number</DialogTitle>
          <DialogDescription>Managers use it to ping you on WhatsApp when they assign you a task.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-phone">Mobile number</Label>
            <Input
              id="my-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={phone ? displayPhone(phone) : ""}
              placeholder="98470 12345"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Indian numbers can skip +91. Leave empty to remove it.</p>
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            <MessageCircle />
            {pending ? "Saving…" : "Save number"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
