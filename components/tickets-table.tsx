"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  CheckCheck,
  Copy,
  Hand,
  MessageCircle,
  MessageSquarePlus,
  MoreHorizontal,
  RotateCcw,
  SearchX,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  takeUpTicket,
  solveTicket,
  markDuplicate,
  reopenTicket,
  deleteTicket,
  forwardTicket,
  takeBackTicket,
  followUpTicket,
} from "@/app/tickets/actions";
import { buildWaLink, solvedMessage, ticketNo } from "@/lib/whatsapp";
import { formatDuration, istStamp } from "@/lib/duration";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  label as fmtLabel,
  type TicketSource,
  type TicketPriority,
  type TicketStatus,
  type TicketCategory,
} from "@/components/ticket-badges";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type TicketRow = {
  id: string;
  num: number;
  title: string;
  description: string | null;
  contactName: string;
  contactPhone: string;
  branch: string | null;
  source: TicketSource;
  ipAddress: string | null;
  assetId: string | null;
  priority: TicketPriority;
  category: TicketCategory;
  status: TicketStatus;
  forwardedTo: string | null;
  forwardedAt: string | null;
  takenByName: string | null;
  takenAt: string | null;
  solvedByName: string | null;
  solvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  createdByName: string;
  needsFollowUp: boolean;
};

type ActionResult = { ok: true } | { ok: false; error: string };

const SESSION_ERROR = "Request failed. Your session may have expired, so refresh the page.";

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function timeLine(row: TicketRow, now: number): string {
  const created = Date.parse(row.createdAt);
  const taken = row.takenAt ? Date.parse(row.takenAt) : created;
  switch (row.status) {
    case "SOLVED":
      return row.solvedAt ? `Resolved in ${formatDuration(Date.parse(row.solvedAt) - created)}` : "";
    case "TAKEN_UP":
      return `In progress ${formatDuration(now - taken)}`;
    case "FORWARDED": {
      const since = row.forwardedAt ? Date.parse(row.forwardedAt) : taken;
      return `With ${truncate(row.forwardedTo ?? "—", 16)} ${formatDuration(now - since)}`;
    }
    case "DUPLICATE":
      return "Closed as duplicate";
    default:
      return `Waiting ${formatDuration(now - created)}`;
  }
}

function waLinkFor(row: TicketRow) {
  return row.status === "SOLVED" && row.solvedAt
    ? buildWaLink(
        row.contactPhone,
        solvedMessage({
          contactName: row.contactName,
          num: row.num,
          title: row.title,
          resolutionNote: row.resolutionNote ?? "",
          solvedAt: new Date(row.solvedAt),
        })
      )
    : null;
}

/** Ink weight follows priority: urgent is the brightest thing on the counter. */
const TITLE_INK: Record<TicketPriority, string> = {
  URGENT: "font-semibold text-foreground",
  HIGH: "font-semibold text-foreground",
  MEDIUM: "font-medium text-foreground",
  LOW: "font-medium text-muted-foreground",
};

export function TicketsTable({ rows, isManager, now }: { rows: TicketRow[]; isManager: boolean; now: number }) {
  const router = useRouter();
  const [solving, setSolving] = useState<TicketRow | null>(null);
  const [note, setNote] = useState("");
  const [forwarding, setForwarding] = useState<TicketRow | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardReason, setForwardReason] = useState("");
  const [followingUp, setFollowingUp] = useState<TicketRow | null>(null);
  const [followUpNote, setFollowUpNote] = useState("");
  const [deleting, setDeleting] = useState<TicketRow | null>(null);
  const [detailRow, setDetailRow] = useState<TicketRow | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function runAction(id: string, action: () => Promise<ActionResult>, successMsg: string) {
    setBusyId(id);
    let result: ActionResult;
    try {
      result = await action();
    } catch {
      toast.error(SESSION_ERROR);
      return false;
    } finally {
      setBusyId(null);
    }
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(successMsg);
    router.refresh();
  }

  async function submitDialog(e: FormEvent<HTMLFormElement>, action: () => Promise<ActionResult>, successMsg: string, close: () => void) {
    e.preventDefault();
    setPending(true);
    let result: ActionResult;
    try {
      result = await action();
    } catch {
      toast.error(SESSION_ERROR);
      setPending(false);
      return;
    }
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(successMsg);
    close();
    router.refresh();
  }

  const openSolve = (row: TicketRow) => {
    setSolving(row);
    setNote("");
  };
  const openForward = (row: TicketRow) => {
    setForwarding(row);
    setForwardTo("");
    setForwardReason("");
  };
  const openFollowUp = (row: TicketRow) => {
    setFollowingUp(row);
    setFollowUpNote("");
  };


  if (rows.length === 0) {
    return (
      <EmptyState icon={<SearchX />} title="No tickets match">
        Change the status tab or filters, or log a new ticket with “New ticket”.
      </EmptyState>
    );
  }

  /** The one action that moves this ticket forward, shown as a button. */
  function PrimaryAction({ row }: { row: TicketRow }) {
    const no = ticketNo(row.num);
    const busy = busyId === row.id;
    switch (row.status) {
      case "OPEN":
        return (
          <Button
            size="sm"
            disabled={busy}
            aria-label={`Take up ${no}`}
            onClick={() => runAction(row.id, () => takeUpTicket(row.id), `${no} taken up`)}
          >
            <Hand />
            {busy ? "Taking…" : "Take up"}
          </Button>
        );
      case "TAKEN_UP":
        return (
          <Button size="sm" aria-label={`Solve ${no}`} onClick={() => openSolve(row)}>
            <CheckCheck />
            Solve
          </Button>
        );
      case "FORWARDED":
        return row.needsFollowUp ? (
          <Button size="sm" aria-label={`Follow up ${no}`} onClick={() => openFollowUp(row)}>
            <MessageSquarePlus />
            Follow up
          </Button>
        ) : (
          <Button size="sm" variant="outline" aria-label={`Solve ${no}`} onClick={() => openSolve(row)}>
            <CheckCheck />
            Solve
          </Button>
        );
      case "SOLVED": {
        const wa = waLinkFor(row);
        return wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener"
            aria-label={`Send WhatsApp update for ${no}`}
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <MessageCircle />
            WhatsApp
          </a>
        ) : null;
      }
      case "DUPLICATE":
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={`Reopen ${no}`}
            onClick={() => runAction(row.id, () => reopenTicket(row.id), `${no} reopened`)}
          >
            <RotateCcw />
            Reopen
          </Button>
        );
    }
  }

  function MoreActions({ row }: { row: TicketRow }) {
    const no = ticketNo(row.num);
    const active = row.status === "OPEN" || row.status === "TAKEN_UP" || row.status === "FORWARDED";
    const items: React.ReactNode[] = [];
    if (active && row.status !== "TAKEN_UP" && !(row.status === "FORWARDED" && !row.needsFollowUp))
      items.push(
        <DropdownMenuItem key="solve" onClick={() => openSolve(row)}>
          <CheckCheck /> Solve
        </DropdownMenuItem>
      );
    if (active)
      items.push(
        <DropdownMenuItem key="fwd" onClick={() => openForward(row)}>
          <ArrowRightLeft /> {row.status === "FORWARDED" ? "Forward again" : "Forward"}
        </DropdownMenuItem>
      );
    if (active && !(row.status === "FORWARDED" && row.needsFollowUp))
      items.push(
        <DropdownMenuItem key="fu" onClick={() => openFollowUp(row)}>
          <MessageSquarePlus /> Add follow-up note
        </DropdownMenuItem>
      );
    if (row.status === "FORWARDED")
      items.push(
        <DropdownMenuItem key="back" onClick={() => runAction(row.id, () => takeBackTicket(row.id), `${no} taken back`)}>
          <Undo2 /> Take back
        </DropdownMenuItem>
      );
    if (row.status === "OPEN" || row.status === "TAKEN_UP")
      items.push(
        <DropdownMenuItem key="dup" onClick={() => runAction(row.id, () => markDuplicate(row.id), `${no} marked duplicate`)}>
          <Copy /> Mark as duplicate
        </DropdownMenuItem>
      );
    if (row.status === "SOLVED")
      items.push(
        <DropdownMenuItem key="reopen" onClick={() => runAction(row.id, () => reopenTicket(row.id), `${no} reopened`)}>
          <RotateCcw /> Reopen
        </DropdownMenuItem>
      );
    if (isManager) {
      if (items.length) items.push(<DropdownMenuSeparator key="sep" />);
      items.push(
        <DropdownMenuItem key="del" variant="destructive" onClick={() => setDeleting(row)}>
          <Trash2 /> Delete ticket
        </DropdownMenuItem>
      );
    }
    if (!items.length) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />} aria-label={`More actions for ${no}`}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent>{items}</DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function TitleButton({ row }: { row: TicketRow }) {
    return (
      <button
        type="button"
        onClick={() => setDetailRow(row)}
        className={cn(
          "text-left break-words underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          TITLE_INK[row.priority]
        )}
      >
        {row.title}
      </button>
    );
  }

  function FollowUpFlag() {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-900">
        Needs follow-up
      </span>
    );
  }

  const meta = (row: TicketRow) =>
    [row.contactName, row.contactPhone, fmtLabel(row.source), fmtLabel(row.category), row.branch].filter(Boolean).join(" · ");

  return (
    <>
      {/* Phones */}
      <ul className="divide-y lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-bold text-primary">{ticketNo(row.num)}</span>
              <div className="flex items-center gap-2">
                <TicketPriorityBadge priority={row.priority} />
                <TicketStatusBadge status={row.status} />
              </div>
            </div>
            <TitleButton row={row} />
            <p className="text-xs text-muted-foreground">{meta(row)}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <span>{timeLine(row, now)}</span>
              {row.takenByName && <span className="text-muted-foreground">· {row.takenByName}</span>}
              {row.needsFollowUp && <FollowUpFlag />}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <PrimaryAction row={row} />
              <MoreActions row={row} />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop */}
      <div className="hidden lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-20 pl-5">No.</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead className="w-28">Priority</TableHead>
              <TableHead className="w-44">Status</TableHead>
              <TableHead className="w-32">Taken by</TableHead>
              <TableHead className="w-44 pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className={cn(row.status === "SOLVED" || row.status === "DUPLICATE" ? "bg-muted/25" : undefined)}>
                <TableCell className="pl-5 align-top font-mono text-sm font-bold text-primary">
                  <span className="leading-6">{ticketNo(row.num)}</span>
                </TableCell>
                <TableCell className="max-w-0 align-top whitespace-normal">
                  <TitleButton row={row} />
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={meta(row)}>
                    {meta(row)}
                  </p>
                </TableCell>
                <TableCell className="align-top">
                  <span className="inline-flex h-6 items-center">
                    <TicketPriorityBadge priority={row.priority} />
                  </span>
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  <TicketStatusBadge status={row.status} />
                  <p className="mt-1 text-xs text-muted-foreground">{timeLine(row, now)}</p>
                  <p className="text-xs text-muted-foreground">Raised {istStamp(new Date(row.createdAt))}</p>
                  {row.needsFollowUp && (
                    <div className="mt-1">
                      <FollowUpFlag />
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top text-sm text-muted-foreground">
                  <span className="leading-6">{row.takenByName ?? "—"}</span>
                </TableCell>
                <TableCell className="pr-5 align-top">
                  <div className="flex items-center justify-end gap-1">
                    <PrimaryAction row={row} />
                    <MoreActions row={row} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!solving} onOpenChange={(open) => !open && setSolving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solve {solving && ticketNo(solving.num)}</DialogTitle>
            <DialogDescription>{solving?.title}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => submitDialog(e, () => solveTicket(solving!.id, note), "Ticket solved", () => setSolving(null))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="resolutionNote">What fixed it?</Label>
              <Textarea
                id="resolutionNote"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                minLength={3}
                required
                autoFocus
                placeholder="This note goes into the WhatsApp update to the contact."
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Mark solved"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!forwarding} onOpenChange={(open) => !open && setForwarding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Forward {forwarding && ticketNo(forwarding.num)}</DialogTitle>
            <DialogDescription>{forwarding?.title}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) =>
              submitDialog(e, () => forwardTicket(forwarding!.id, forwardTo, forwardReason), "Ticket forwarded", () => setForwarding(null))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forwardTo">Forward to</Label>
              <Input
                id="forwardTo"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
                minLength={2}
                required
                autoFocus
                placeholder="Person, vendor or team"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="forwardReason">Why?</Label>
              <Textarea id="forwardReason" value={forwardReason} onChange={(e) => setForwardReason(e.target.value)} minLength={3} required />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Forward ticket"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!followingUp} onOpenChange={(open) => !open && setFollowingUp(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Follow up on {followingUp && ticketNo(followingUp.num)}</DialogTitle>
            <DialogDescription>
              {followingUp?.status === "FORWARDED" && followingUp.forwardedTo
                ? `Currently with ${followingUp.forwardedTo}. Note what you checked or heard back.`
                : followingUp?.title}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) =>
              submitDialog(e, () => followUpTicket(followingUp!.id, followUpNote), "Follow-up added", () => setFollowingUp(null))
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followUpNote">Note</Label>
              <Textarea
                id="followUpNote"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                minLength={3}
                required
                autoFocus
              />
            </div>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Add follow-up"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting ? ticketNo(deleting.num) : ""}?`}
        description={
          deleting
            ? `“${deleting.title}” and its history, notes and attachments will be removed for good. This can't be undone.`
            : ""
        }
        confirmLabel="Delete ticket"
        onConfirm={() => runAction(deleting!.id, () => deleteTicket(deleting!.id), "Ticket deleted")}
      />

      <TicketDetailDialog row={detailRow} onOpenChange={(open) => !open && setDetailRow(null)} />
    </>
  );
}
