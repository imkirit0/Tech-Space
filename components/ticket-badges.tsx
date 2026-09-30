import { cn } from "@/lib/utils";
import { LampBadge, type Lamp } from "@/components/status-badge";

export const TICKET_SOURCES = ["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"] as const;
export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "TAKEN_UP", "SOLVED", "DUPLICATE", "FORWARDED"] as const;
export const TICKET_CATEGORIES = ["TECH", "NON_TECH"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

const LABELS: Record<string, string> = {
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  WALK_IN: "Walk-in",
  OTHER: "Other",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
  OPEN: "Open",
  TAKEN_UP: "Taken up",
  SOLVED: "Solved",
  DUPLICATE: "Duplicate",
  FORWARDED: "Forwarded",
  TECH: "Tech",
  NON_TECH: "Non-tech",
};
export const label = (s: string) => LABELS[s] ?? s.replace("_", " ");

const STATUS_LAMP: Record<TicketStatus, Lamp> = {
  OPEN: "amber",
  TAKEN_UP: "blue",
  FORWARDED: "violet",
  SOLVED: "green",
  DUPLICATE: "slate",
};

export const TicketStatusBadge = ({ status }: { status: TicketStatus }) => (
  <LampBadge lamp={STATUS_LAMP[status]}>{label(status)}</LampBadge>
);

/*
 * Priority reads as brightness: urgent is the brightest mark on the counter,
 * low recedes. Four filled bars, lit from the left.
 */
const PRIORITY_LIT: Record<TicketPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };
// Cool to hot: low green, medium blue, high orange, urgent red.
const PRIORITY_INK: Record<TicketPriority, string> = {
  LOW: "text-emerald-700",
  MEDIUM: "text-blue-700",
  HIGH: "text-orange-700 font-semibold",
  URGENT: "text-red-700 font-semibold",
};

export const TicketPriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", PRIORITY_INK[priority])}>
    <span className="flex items-end gap-px" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn("w-[3px] rounded-[1px]", i < PRIORITY_LIT[priority] ? "bg-current" : "bg-border")}
          style={{ height: 5 + i * 2 }}
        />
      ))}
    </span>
    {label(priority)}
  </span>
);

const neutral = "inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-secondary-foreground";

export const TicketSourceBadge = ({ source }: { source: TicketSource }) => <span className={neutral}>{label(source)}</span>;

export const TicketCategoryBadge = ({ category }: { category: TicketCategory }) => (
  <span className={neutral}>{label(category)}</span>
);
