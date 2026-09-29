"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TICKET_SOURCES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
  label as fmtLabel,
  type TicketSource,
  type TicketPriority,
  type TicketCategory,
} from "@/components/ticket-badges";
import { uploadAttachments } from "@/app/tickets/actions";
import type { TicketInput } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Props = {
  action: (input: TicketInput) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  onSuccess?: () => void;
};

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

/** A row of one-tap choices (native radios, so keyboard and forms just work). */
export function Choice<T extends string>({
  name,
  legend,
  options,
  defaultValue,
  tone,
}: {
  name: string;
  legend: string;
  options: readonly T[];
  defaultValue: T;
  tone?: Partial<Record<T, string>>;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="mb-1.5 text-sm leading-none font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o}
            className={cn(
              "flex min-h-9 cursor-pointer items-center rounded-lg border bg-card px-3 text-sm transition-colors hover:bg-muted",
              "has-checked:border-primary has-checked:bg-accent has-checked:font-medium has-checked:text-accent-foreground",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              tone?.[o]
            )}
          >
            <input type="radio" name={name} value={o} defaultChecked={o === defaultValue} className="sr-only" />
            {fmtLabel(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const PRIORITY_TONE: Partial<Record<TicketPriority, string>> = {
  URGENT: "has-checked:border-red-600 has-checked:bg-red-50 has-checked:text-red-800",
};

export function TicketForm({ action, onSuccess }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // e.currentTarget is nulled after the await — keep a real reference.
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const files = (form.getAll("files") as File[]).filter((f) => f.size > 0);
    const input: TicketInput = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      contactName: String(form.get("contactName") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      branch: String(form.get("branch") ?? "") || undefined,
      source: String(form.get("source") ?? "PHONE") as TicketSource,
      priority: String(form.get("priority") ?? "MEDIUM") as TicketPriority,
      ipAddress: String(form.get("ipAddress") ?? "") || undefined,
      assetId: String(form.get("assetId") ?? "") || undefined,
      category: String(form.get("category") ?? "TECH") as TicketCategory,
    };

    setPending(true);
    let result: Awaited<ReturnType<typeof action>>;
    try {
      result = await action(input);
    } catch {
      toast.error("Couldn't create the ticket. Your session may have expired, so refresh the page.");
      setPending(false);
      return;
    }

    if (!result.ok) {
      toast.error(result.error);
      setPending(false);
      return;
    }

    let uploadFailed = false;
    if (files.length > 0) {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      try {
        const uploadResult = await uploadAttachments(result.id, fd);
        if (!uploadResult.ok) {
          uploadFailed = true;
          toast.error(`Ticket created, but the attachment failed: ${uploadResult.error}`);
        }
      } catch {
        uploadFailed = true;
        toast.error("Ticket created, but the attachment upload failed. Your session may have expired.");
      }
    }
    setPending(false);

    if (!uploadFailed) toast.success("Ticket created");
    formEl.reset();
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">The problem</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">What's the problem?</Label>
          <Input id="title" name="title" required minLength={3} autoFocus placeholder="e.g. Lab 2 printer not printing" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Details {optional}</Label>
          <Textarea id="description" name="description" rows={2} placeholder="Error messages, what was tried already…" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Choice name="priority" legend="Priority" options={TICKET_PRIORITIES} defaultValue="MEDIUM" tone={PRIORITY_TONE} />
          <Choice name="category" legend="Category" options={TICKET_CATEGORIES} defaultValue="TECH" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t pt-4">
        <legend className="float-left mb-3 w-full text-xs font-semibold text-muted-foreground">Who reported it</legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactName">Name</Label>
            <Input id="contactName" name="contactName" required autoComplete="off" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Phone</Label>
            <Input id="contactPhone" name="contactPhone" type="tel" inputMode="tel" required placeholder="10-digit mobile" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="branch">Branch {optional}</Label>
            <Input id="branch" name="branch" />
          </div>
          <Choice name="source" legend="Came in via" options={TICKET_SOURCES} defaultValue="PHONE" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 border-t pt-4">
        <legend className="float-left mb-3 w-full text-xs font-semibold text-muted-foreground">
          Device and files <span className="font-normal">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ipAddress">IP address</Label>
            <Input id="ipAddress" name="ipAddress" inputMode="decimal" className="font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assetId">Asset / device ID</Label>
            <Input id="assetId" name="assetId" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="files">Attachments</Label>
          <Input
            id="files"
            name="files"
            type="file"
            multiple
            className="h-auto py-1.5"
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
          <p className="text-xs text-muted-foreground">Up to 5 files, 5 MB each: images, PDF, Word, Excel or text.</p>
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  );
}
