"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveExamRecord, deleteExamRecord } from "@/app/exam-records/actions";
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

export type ExamRecordValue = {
  id: string;
  date: string;
  exam: string;
  certificateName: string | null;
  center: string | null;
  vendor: string | null;
  conducted: number;
  passed: number;
  failed: number;
  reassessed: number;
  urgent: number;
  normal: number;
  source: string | null;
  note: string | null;
};

function Num({ name, label, def }: { name: string; label: string; def?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`exam-${name}`}>{label}</Label>
      <Input
        id={`exam-${name}`}
        name={name}
        type="number"
        inputMode="numeric"
        min={0}
        max={100000}
        step={1}
        defaultValue={def ?? 0}
        required
      />
    </div>
  );
}

/** Add a new exam record, or edit an existing one when `record` is given. */
export function ExamRecordDialog({
  today,
  exams,
  record,
}: {
  today: string;
  exams: string[];
  record?: ExamRecordValue;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const editing = !!record;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const num = (k: string) => Number(fd.get(k));
    setPending(true);
    try {
      const r = await saveExamRecord({
        id: record?.id,
        date: String(fd.get("date")),
        exam: String(fd.get("exam") ?? ""),
        certificateName: String(fd.get("certificateName") ?? ""),
        center: String(fd.get("center") ?? ""),
        vendor: String(fd.get("vendor") ?? ""),
        conducted: num("conducted"),
        passed: num("passed"),
        failed: num("failed"),
        reassessed: num("reassessed"),
        urgent: num("urgent"),
        normal: num("normal"),
        source: (String(fd.get("source") ?? "") || undefined) as "GEMS" | "Forms" | undefined,
        note: String(fd.get("note") ?? ""),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(editing ? "Record updated" : "Exam record saved");
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
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${record!.exam} on ${record!.date}`} title="Edit" />
          ) : (
            <Button />
          )
        }
      >
        {editing ? <Pencil /> : <><Plus className="size-4" aria-hidden />Add exam record</>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit exam record" : "Add exam record"}</DialogTitle>
          <DialogDescription>
            One exam batch: how many sat, the results, and the certificates dispatched. Urgent + normal make up the dispatched total. Your
            manager sees the totals per exam.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-exam">Certificate group</Label>
              <Input
                id="exam-exam"
                name="exam"
                list="exam-kinds"
                required
                maxLength={40}
                autoComplete="off"
                defaultValue={record?.exam}
                placeholder="e.g. TALLY, IBMA"
              />
              <datalist id="exam-kinds">
                {exams.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-date">Date</Label>
              <Input id="exam-date" name="date" type="date" defaultValue={record?.date ?? today} max={today} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-cert-name">
              Certificate name <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="exam-cert-name"
              name="certificateName"
              maxLength={120}
              autoComplete="off"
              defaultValue={record?.certificateName ?? ""}
              placeholder="e.g. Tally ERP 9 — Level 1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-center">
                Centre <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="exam-center" name="center" maxLength={120} autoComplete="off" defaultValue={record?.center ?? ""} placeholder="Centre" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exam-vendor">
                Vendor <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="exam-vendor" name="vendor" maxLength={120} autoComplete="off" defaultValue={record?.vendor ?? ""} placeholder="Vendor" />
            </div>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm leading-none font-medium">Source</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["GEMS", "Forms"] as const).map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                >
                  <input type="radio" name="source" value={s} required defaultChecked={record?.source === s} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-border/70 p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Students</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Num name="conducted" label="Conducted" def={record?.conducted} />
              <Num name="passed" label="Passed" def={record?.passed} />
              <Num name="failed" label="Failed" def={record?.failed} />
              <Num name="reassessed" label="Re-assessed" def={record?.reassessed} />
            </div>
          </fieldset>
          <fieldset className="rounded-lg border border-border/70 p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Certificates dispatched</legend>
            <div className="grid grid-cols-2 gap-3">
              <Num name="urgent" label="Urgent" def={record?.urgent} />
              <Num name="normal" label="Normal" def={record?.normal} />
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exam-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="exam-note"
              name="note"
              maxLength={300}
              autoComplete="off"
              defaultValue={record?.note ?? ""}
              placeholder="e.g. a note about the centre or vendor"
            />
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Save record"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteExamRecordButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function onConfirm() {
    try {
      const r = await deleteExamRecord(id);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Record removed");
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
        title="Remove this record?"
        description={label}
        confirmLabel="Remove"
        onConfirm={onConfirm}
      />
    </>
  );
}
