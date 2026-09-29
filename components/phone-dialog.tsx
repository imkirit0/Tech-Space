"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { changeMyPassword, setWhatsAppNumber } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { displayPhone } from "@/lib/whatsapp";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

const SESSION_ERROR = "Couldn't save. Your session may have expired, so refresh the page.";

/** The avatar on the board opens this: your WhatsApp number and your password. */
export function PhoneDialog({
  userId,
  username,
  phone,
  trigger,
}: {
  userId: string;
  username: string | null;
  phone: string | null;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"phone" | "password" | null>(null);

  async function savePhone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = String(new FormData(e.currentTarget).get("phone") ?? "");
    setPending("phone");
    try {
      const r = await setWhatsAppNumber(userId, raw);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.phone ? `Saved ${displayPhone(r.phone)}` : "Number removed");
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(null);
    }
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const next = String(f.get("new") ?? "");
    if (next !== String(f.get("confirm") ?? "")) return void toast.error("The two new passwords don't match.");
    setPending("password");
    try {
      const r = await changeMyPassword(String(f.get("current") ?? ""), next);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Password changed");
      formEl.reset();
      setOpen(false);
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your account</DialogTitle>
          {username && (
            <DialogDescription>
              You sign in as <span className="font-mono font-semibold text-foreground">{username}</span>.
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={savePhone} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="my-phone">WhatsApp number</Label>
            <div className="flex gap-2">
              <Input
                id="my-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={phone ? displayPhone(phone) : ""}
                placeholder="98470 12345"
              />
              <Button type="submit" variant="outline" disabled={pending !== null}>
                <MessageCircle />
                {pending === "phone" ? "Saving…" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Managers use it to ping you when they assign you a task. Leave empty to remove it.</p>
          </div>
        </form>

        <form onSubmit={savePassword} className="flex flex-col gap-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Change password</h3>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" name="new" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw-confirm">Type it again</Label>
              <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <Button type="submit" size="lg" disabled={pending !== null}>
            <KeyRound />
            {pending === "password" ? "Saving…" : "Change password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
