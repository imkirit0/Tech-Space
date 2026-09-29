"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Phone, Upload } from "lucide-react";
import { getTicketDetail, uploadAttachments, type TicketDetail } from "@/app/tickets/actions";
import { TicketStatusBadge, TicketPriorityBadge, label as fmtLabel } from "@/components/ticket-badges";
import { ticketNo } from "@/lib/whatsapp";
import { formatDuration } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TicketRow } from "@/components/tickets-table";
import { cn } from "@/lib/utils";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const truncateTitle = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;

/** The lifecycle as one explicit track: where this ticket is, and what it has passed through. */
function LifecycleTrack({ row }: { row: TicketRow }) {
  if (row.status === "DUPLICATE") {
    return (
      <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
        Closed as a duplicate. Reopen it from the list if that was a mistake.
      </p>
    );
  }
  const stages = [
    { key: "OPEN", label: "Open", reached: true },
    { key: "TAKEN_UP", label: "Taken up", reached: !!row.takenAt },
    { key: "FORWARDED", label: "Forwarded", reached: !!row.forwardedAt || row.status === "FORWARDED" },
    { key: "SOLVED", label: "Solved", reached: row.status === "SOLVED" },
  ];
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Ticket progress">
      {stages.map((s) => {
        const current = s.key === row.status;
        return (
          <li key={s.key} className="flex flex-col gap-1.5" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "h-1.5 rounded-full",
                current ? (s.key === "OPEN" ? "bg-amber-500" : s.key === "SOLVED" ? "bg-emerald-600" : "bg-primary") : s.reached ? "bg-primary/35" : "bg-border"
              )}
            />
            <span className={cn("text-xs", current ? "font-semibold text-foreground" : s.reached ? "text-muted-foreground" : "text-muted-foreground/60")}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

export function TicketDetailDialog({
  row,
  onOpenChange,
}: {
  row: TicketRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!row) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    getTicketDetail(row.id)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          toast.error(result.error);
          onOpenChange(false);
          return;
        }
        setDetail(result.detail);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't load the ticket. Your session may have expired, so refresh the page.");
        onOpenChange(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!row) return;
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const hasFile = fd.getAll("files").some((f) => f instanceof File && f.size > 0);
    if (!hasFile) {
      toast.error("Choose at least one file first");
      return;
    }
    setUploading(true);
    let result: Awaited<ReturnType<typeof uploadAttachments>>;
    try {
      result = await uploadAttachments(row.id, fd);
    } catch {
      toast.error("Upload failed. Your session may have expired, so refresh the page.");
      setUploading(false);
      return;
    }
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    formEl.reset();
    toast.success("Attachment uploaded");
    const refreshed = await getTicketDetail(row.id);
    if (refreshed.ok) setDetail(refreshed.detail);
    router.refresh();
  }

  const skeleton = (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
      <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-1/2 animate-pulse rounded bg-muted" />
      <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {row && (
          <>
            <DialogHeader className="pr-8">
              <p className="font-led text-lg leading-none font-black text-primary">{ticketNo(row.num)}</p>
              <DialogTitle className="text-xl">{row.title}</DialogTitle>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <TicketStatusBadge status={row.status} />
                <TicketPriorityBadge priority={row.priority} />
                <span className="text-xs text-muted-foreground">
                  {fmtLabel(row.category)} · via {fmtLabel(row.source)}
                </span>
              </div>
            </DialogHeader>

            <LifecycleTrack row={row} />

            {row.description && <p className="text-sm whitespace-pre-wrap">{row.description}</p>}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border bg-muted/40 p-3.5 sm:grid-cols-4">
              <Fact label="Contact">
                {row.contactName}
                <a
                  href={`tel:${row.contactPhone.replace(/[^\d+]/g, "")}`}
                  className="mt-0.5 flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  <Phone className="size-3" aria-hidden />
                  {row.contactPhone}
                </a>
              </Fact>
              <Fact label="Branch">{row.branch || "—"}</Fact>
              <Fact label="IP address">
                <span className="font-mono text-xs">{row.ipAddress || "—"}</span>
              </Fact>
              <Fact label="Asset / device">{row.assetId || "—"}</Fact>
            </dl>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
              {loading || !detail ? (
                skeleton
              ) : (
                <ol className="flex flex-col gap-3 border-l-2 border-border pl-4 text-sm">
                  <li className="relative">
                    <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-amber-500 ring-2 ring-popover" aria-hidden />
                    Logged by <strong className="font-medium">{row.createdByName}</strong>
                    <span className="block text-xs text-muted-foreground">{fmtDate(row.createdAt)}</span>
                  </li>
                  {row.takenAt && (
                    <li className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary ring-2 ring-popover" aria-hidden />
                      Taken up by <strong className="font-medium">{row.takenByName}</strong>
                      <span className="block text-xs text-muted-foreground">
                        {fmtDate(row.takenAt)} · {formatDuration(Date.parse(row.takenAt) - Date.parse(row.createdAt))} after logging
                      </span>
                    </li>
                  )}
                  {[
                    ...detail.forwards.map((f) => ({ ...f, kind: "forward" as const })),
                    ...detail.notes.map((n) => ({ ...n, kind: "note" as const })),
                  ]
                    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
                    .map((entry, i) =>
                      entry.kind === "forward" ? (
                        <li key={i} className="relative">
                          <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-violet-600 ring-2 ring-popover" aria-hidden />
                          Forwarded to <strong className="font-medium">{entry.to}</strong> by {entry.byName}
                          <span className="block text-muted-foreground">{entry.reason}</span>
                          <span className="block text-xs text-muted-foreground">
                            {fmtDate(entry.at)} · {formatDuration(Date.parse(entry.at) - Date.parse(row.createdAt))} after logging
                          </span>
                        </li>
                      ) : (
                        <li key={i} className="relative">
                          <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-slate-400 ring-2 ring-popover" aria-hidden />
                          Follow-up by <strong className="font-medium">{entry.byName}</strong>
                          <span className="block text-muted-foreground">{entry.note}</span>
                          <span className="block text-xs text-muted-foreground">{fmtDate(entry.at)}</span>
                        </li>
                      )
                    )}
                  {row.solvedAt && (
                    <li className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-emerald-600 ring-2 ring-popover" aria-hidden />
                      Solved by <strong className="font-medium">{row.solvedByName}</strong>
                      <span className="block text-muted-foreground">{row.resolutionNote}</span>
                      <span className="block text-xs text-muted-foreground">
                        {fmtDate(row.solvedAt)} · resolved in {formatDuration(Date.parse(row.solvedAt) - Date.parse(row.createdAt))}
                      </span>
                    </li>
                  )}
                </ol>
              )}
            </section>

            {detail?.estimate && (
              <section className="rounded-lg bg-accent/60 p-3.5">
                <h3 className="text-sm font-semibold text-accent-foreground">
                  Similar issues usually take ~{formatDuration(detail.estimate.avgMs)}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Based on {detail.estimate.count} solved before:</p>
                <ul className="mt-1.5 space-y-0.5 text-sm">
                  {detail.estimate.examples.map((ex) => (
                    <li key={ex.num}>
                      <span className="font-mono text-xs text-muted-foreground">{ticketNo(ex.num)}</span> {truncateTitle(ex.title)}{" "}
                      <span className="text-muted-foreground">· {formatDuration(ex.ms)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Attachments</h3>
              {loading || !detail ? (
                skeleton
              ) : detail.attachments.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {detail.attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={`/api/tickets/attachment/${a.id}`}
                        download
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate font-medium text-primary">{a.filename}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fmtSize(a.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No files yet. Add screenshots or documents below.</p>
              )}
              <form onSubmit={handleUpload} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="file"
                  name="files"
                  multiple
                  aria-label="Choose files to attach"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="h-auto py-1.5"
                />
                <Button type="submit" variant="outline" disabled={uploading} className="shrink-0">
                  <Upload />
                  {uploading ? "Uploading…" : "Upload"}
                </Button>
              </form>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
