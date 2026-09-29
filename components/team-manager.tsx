"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, RefreshCw, UserX, Users } from "lucide-react";
import {
  createAccount,
  updateAccount,
  resetPassword,
  setAccountActive,
  type AccountInput,
} from "@/app/manager/team/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/section";
import { LampBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayPhone } from "@/lib/whatsapp";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { cn } from "@/lib/utils";

export type Member = {
  id: string;
  name: string;
  username: string | null;
  designation: string | null;
  role: "EMPLOYEE" | "MANAGER";
  tech: boolean;
  active: boolean;
  phone: string | null;
  hasPassword: boolean;
};

const SESSION_ERROR = "That didn't go through. Your session may have expired, so refresh the page.";

/** Readable random password, e.g. "kx7m-p2qa-9fhe" (no look-alike characters). */
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}

function PasswordField({ id, label }: { id: string; label: string }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="password"
          type="text"
          autoComplete="new-password"
          spellCheck={false}
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="font-mono"
        />
        <Button type="button" variant="outline" onClick={() => setValue(generatePassword())}>
          <RefreshCw />
          Generate
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        At least {MIN_PASSWORD_LENGTH} characters. Share it with them in person; they can change it from their name menu.
      </p>
    </div>
  );
}

function AccountForm({
  existing,
  onDone,
}: {
  existing?: Member;
  onDone: (shared?: { username: string; password: string }) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input: AccountInput = {
      name: String(f.get("name") ?? ""),
      username: String(f.get("username") ?? ""),
      designation: String(f.get("designation") ?? "") || undefined,
      role: f.get("role") === "MANAGER" ? "MANAGER" : "EMPLOYEE",
      tech: f.get("tech") === "on",
    };
    const password = String(f.get("password") ?? "");
    setPending(true);
    try {
      const r = existing ? await updateAccount(existing.id, input) : await createAccount({ ...input, password });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(existing ? "Account updated" : `Account created for ${input.name}`);
      router.refresh();
      onDone(existing ? undefined : { username: input.username.trim().toLowerCase(), password });
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-name">Full name</Label>
          <Input id="acc-name" name="name" required defaultValue={existing?.name} autoFocus={!existing} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acc-designation">
            Designation <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="acc-designation" name="designation" defaultValue={existing?.designation ?? ""} placeholder="e.g. Accountant" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-username">Username (login ID)</Label>
        <Input
          id="acc-username"
          name="username"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={existing?.username ?? ""}
          placeholder="e.g. anita.s"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">Lowercase letters, numbers, dots, dashes or underscores.</p>
      </div>

      <fieldset className="flex flex-col">
        <legend className="mb-1.5 text-sm leading-none font-medium">Access</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(["EMPLOYEE", "MANAGER"] as const).map((r) => (
            <label
              key={r}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                "has-checked:border-primary has-checked:bg-accent has-checked:text-accent-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              )}
            >
              <input type="radio" name="role" value={r} defaultChecked={(existing?.role ?? "EMPLOYEE") === r} className="sr-only" />
              <span className="font-medium">{r === "MANAGER" ? "Manager" : "Staff"}</span>
              <span className="text-xs text-muted-foreground">
                {r === "MANAGER" ? "Sees everyone's work, assigns tasks, manages accounts" : "Logs their day, works tasks"}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" name="tech" defaultChecked={existing?.tech} className="mt-0.5 size-4 rounded border-input" />
          <span>
            Tech desk access
            <span className="block text-xs text-muted-foreground">Can see and work complaint tickets.</span>
          </span>
        </label>
      </fieldset>

      {!existing && <PasswordField id="acc-password" label="Temporary password" />}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : existing ? "Save changes" : "Create account"}
      </Button>
    </form>
  );
}

/** Shown once after a password is set, so the manager can pass it on. */
function SharePassword({ who, username, password, onClose }: { who: string; username: string; password: string; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Share these with {who}</DialogTitle>
        <DialogDescription>This is the only time the password is shown. They can change it after signing in.</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border bg-muted/50 p-4 text-sm">
        <dt className="text-muted-foreground">Username</dt>
        <dd className="font-mono font-semibold select-all">{username}</dd>
        <dt className="text-muted-foreground">Password</dt>
        <dd className="font-mono font-semibold select-all">{password}</dd>
      </dl>
      <Button size="lg" onClick={onClose}>
        Done
      </Button>
    </>
  );
}

export function AddPersonDialog() {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<{ who: string; username: string; password: string } | null>(null);
  const close = () => {
    setOpen(false);
    setShared(null);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger render={<Button variant="board" size="lg" />}>
        <Plus className="size-4" aria-hidden />
        Add person
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {shared ? (
          <SharePassword {...shared} onClose={close} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a person</DialogTitle>
              <DialogDescription>Create their login. You&apos;ll see the password once to pass on.</DialogDescription>
            </DialogHeader>
            <AccountForm
              onDone={(s) => {
                const name = (document.getElementById("acc-name") as HTMLInputElement | null)?.value ?? "them";
                if (s) setShared({ who: name, ...s });
                else close();
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TeamTable({ members, meId }: { members: Member[]; meId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Member | null>(null);
  const [resetting, setResetting] = useState<Member | null>(null);
  const [resetDone, setResetDone] = useState<string | null>(null);
  const [switchingOff, setSwitchingOff] = useState<Member | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleActive(m: Member, active: boolean) {
    try {
      const r = await setAccountActive(m.id, active);
      if (!r.ok) {
        toast.error(r.error);
        return false;
      }
      toast.success(active ? `${m.name} can sign in again` : `${m.name} is switched off`);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
      return false;
    }
  }

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resetting) return;
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setPending(true);
    try {
      const r = await resetPassword(resetting.id, password);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`New password set for ${resetting.name}`);
      setResetDone(password);
      router.refresh();
    } catch {
      toast.error(SESSION_ERROR);
    } finally {
      setPending(false);
    }
  }

  if (members.length === 0) {
    return (
      <EmptyState icon={<Users />} title="No one here yet">
        Use “Add person” to create the first login.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {members.map((m) => (
          <li key={m.id} className={cn("flex items-start gap-3 px-4 py-3.5 sm:items-center sm:px-5", !m.active && "bg-muted/40")}>
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                m.active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              )}
              aria-hidden
            >
              {m.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <div className="grid min-w-0 flex-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_13rem] sm:items-center">
              <div className="min-w-0">
                <p className={cn("truncate font-medium", !m.active && "text-muted-foreground line-through")}>
                  {m.name}
                  {m.id === meId && <span className="ml-1.5 text-xs font-normal text-muted-foreground no-underline">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.designation ?? "No designation"}
                  {m.phone && ` · ${displayPhone(m.phone)}`}
                </p>
              </div>
              <p className="font-mono text-sm">
                {m.username ?? <span className="font-sans text-xs text-amber-800">No login yet</span>}
                {m.username && !m.hasPassword && <span className="ml-2 font-sans text-xs text-amber-800">no password</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {m.role === "MANAGER" && <LampBadge lamp="blue">Manager</LampBadge>}
                {m.tech && <LampBadge lamp="violet">Tech desk</LampBadge>}
                {!m.active && <LampBadge lamp="slate">Switched off</LampBadge>}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" />} aria-label={`Options for ${m.name}`}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setEditing(m)}>
                  <Pencil /> {m.username ? "Edit" : "Set up login"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!m.username}
                  onClick={() => {
                    setResetDone(null);
                    setResetting(m);
                  }}
                >
                  <KeyRound /> {m.hasPassword ? "Reset password" : "Set password"}
                </DropdownMenuItem>
                {m.id !== meId && (
                  <>
                    <DropdownMenuSeparator />
                    {m.active ? (
                      <DropdownMenuItem variant="destructive" onClick={() => setSwitchingOff(m)}>
                        <UserX /> Switch off account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => toggleActive(m, true)}>
                        <Power /> Switch back on
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.username ? `Edit ${editing.name}` : `Set up a login for ${editing?.name}`}</DialogTitle>
            {!editing?.username && <DialogDescription>Give them a username, then use “Set password”.</DialogDescription>}
          </DialogHeader>
          {editing && <AccountForm existing={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="sm:max-w-md">
          {resetting && resetDone ? (
            <SharePassword who={resetting.name} username={resetting.username ?? ""} password={resetDone} onClose={() => setResetting(null)} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>New password for {resetting?.name}</DialogTitle>
                <DialogDescription>Their old password stops working straight away.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <PasswordField id="reset-password" label="New password" />
                <Button type="submit" size="lg" disabled={pending}>
                  {pending ? "Saving…" : "Set password"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!switchingOff}
        onOpenChange={(o) => !o && setSwitchingOff(null)}
        title={`Switch off ${switchingOff?.name}'s account?`}
        description="They're signed out and can't sign in until you switch it back on. Their activities, tasks and tickets stay."
        confirmLabel="Switch off"
        onConfirm={() => toggleActive(switchingOff!, false)}
      />
    </>
  );
}
