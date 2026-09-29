export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function buildWaLink(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function ticketNo(num: number): string {
  return `T-${String(num).padStart(3, "0")}`;
}

const IST_STAMP = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function solvedMessage(t: {
  contactName: string;
  num: number;
  title: string;
  resolutionNote: string;
  solvedAt: Date;
}): string {
  const stamp = IST_STAMP.format(t.solvedAt).replace(" at ", ", ");
  return `Hi ${t.contactName}, your complaint ${ticketNo(t.num)} — ${t.title} has been resolved on ${stamp} IST. Resolution: ${t.resolutionNote}. — G-TEC Tech Team`;
}

/** 919847012345 → "+91 98470 12345"; other countries just get a leading "+". */
export function displayPhone(normalized: string): string {
  if (normalized.length === 12 && normalized.startsWith("91")) {
    return `+91 ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
  }
  return `+${normalized}`;
}

const PRIORITY_WORD: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "URGENT" };
const DUE = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

export function taskAssignedMessage(t: {
  assigneeName: string;
  managerName: string;
  num: number;
  title: string;
  priority: string;
  dueDate: string | null; // YYYY-MM-DD
  url: string;
}): string {
  const first = t.assigneeName.split(/\s+/)[0] || t.assigneeName;
  const lines = [
    `Hi ${first}, ${t.managerName} assigned you a task on G-TEC Activity Reporting:`,
    ``,
    `*#${t.num} ${t.title}*`,
    `Priority: ${PRIORITY_WORD[t.priority] ?? t.priority}`,
  ];
  if (t.dueDate) lines.push(`Due: ${DUE.format(new Date(`${t.dueDate}T00:00:00Z`))}`);
  lines.push(``, `Open it and post updates here: ${t.url}`);
  return lines.join("\n");
}
