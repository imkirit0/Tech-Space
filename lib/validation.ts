import { z } from "zod";
import { isFutureISO } from "./dates";
import { normalizePhone } from "./whatsapp";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const activitySchema = z
  .object({
    date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
    activity: z.string().trim().min(1, "Activity is required"),
    description: z.string().trim().optional(),
    assignedBy: z.string().trim().min(1, "Assigned By is required"),
    status: z.enum(["NOT_STARTED", "PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
    deadline: iso.optional(),
    timeTaken: z.coerce
      .number()
      .min(0, "Time Taken can't be negative")
      .max(24, "Time Taken cannot be more than 24 hours in a day"),
  })
  .refine((v) => !v.deadline || v.deadline >= v.date, {
    message: "Deadline cannot be earlier than the activity date",
    path: ["deadline"],
  });

export type ActivityInput = z.infer<typeof activitySchema>;

export const lockSchema = z
  .object({
    startDate: iso,
    endDate: iso,
    label: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before start date",
    path: ["endDate"],
  });

export type LockInput = z.infer<typeof lockSchema>;

export const ticketSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().optional(),
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactPhone: z
    .string()
    .trim()
    .refine((p) => normalizePhone(p) !== null, "Enter a valid phone number"),
  branch: z.string().trim().min(1, "Centre is required").max(120, "Centre name is too long"),
  source: z.enum(["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  ipAddress: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
  category: z.enum(["TECH", "NON_TECH"]),
});

export type TicketInput = z.infer<typeof ticketSchema>;

export const solveSchema = z.object({
  note: z.string().trim().min(3, "Describe the resolution (3+ characters)"),
});

export const forwardSchema = z.object({
  to: z.string().trim().min(2, "Say who it was forwarded to"),
  reason: z.string().trim().min(3, "Give the reason for forwarding"),
});

export type ForwardInput = z.infer<typeof forwardSchema>;

export const taskSchema = z.object({
  title: z.string().trim().min(3, "Task title must be at least 3 characters").max(200),
  description: z.string().trim().max(5000).optional(),
  // Empty = nobody yet: the task goes on the team board for anyone to take up.
  assigneeId: z.string().optional(),
  shared: z.boolean().default(false),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: iso.optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

export const taskUpdateSchema = z
  .object({
    body: z.string().trim().max(5000),
    statusTo: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  })
  .refine((v) => v.body.length > 0 || v.statusTo, { message: "Write an update first", path: ["body"] });

export const registrationSchema = z.object({
  date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
  program: z.string().trim().min(1, "Examination is required").max(40, "Examination name is too long"),
  count: z.coerce.number().int("Enter a whole number").min(0, "Count can't be negative").max(10000, "That count looks too high"),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

const examCount = z.coerce.number().int("Enter a whole number").min(0, "Can't be negative").max(100000, "That number looks too high");

export const examRecordSchema = z
  .object({
    id: z.string().optional(),
    date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
    exam: z.string().trim().min(1, "Certificate group is required").max(40, "Name is too long"),
    certificateName: z.string().trim().max(120, "Certificate name is too long").optional(),
    center: z.string().trim().max(120, "Centre name is too long").optional(),
    vendor: z.string().trim().max(120, "Vendor name is too long").optional(),
    conducted: examCount,
    passed: examCount,
    failed: examCount,
    reassessed: examCount,
    urgent: examCount,
    normal: examCount,
    source: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["GEMS", "Forms"]).optional()),
    note: z.string().trim().max(300, "Note is too long").optional(),
  })
  .refine((v) => v.conducted + v.passed + v.failed + v.reassessed + v.urgent + v.normal > 0, {
    message: "Enter at least one figure",
    path: ["conducted"],
  })
  .refine((v) => !!v.source, { message: "Choose GEMS or Forms", path: ["source"] });

export type ExamRecordInput = z.infer<typeof examRecordSchema>;

export const voucherSchema = z
  .object({
    kind: z.enum(["issue", "stock"]),
    date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
    voucher: z.string().trim().min(1, "Voucher is required").max(40, "Voucher name is too long"),
    quantity: z.coerce.number().int("Enter a whole number").min(1, "Enter at least 1").max(10000, "That number looks too high"),
    issuedTo: z.string().trim().max(120, "Name is too long").optional(),
    channel: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["GEMS", "Forms"]).optional()),
    vendor: z.string().trim().max(120, "Vendor name is too long").optional(),
    note: z.string().trim().max(300, "Note is too long").optional(),
  })
  .refine((v) => v.kind !== "issue" || !!v.issuedTo, { message: "Say who the voucher was issued to", path: ["issuedTo"] })
  .refine((v) => v.kind !== "issue" || !!v.channel, { message: "Choose GEMS or Forms", path: ["channel"] });

export type VoucherInput = z.infer<typeof voucherSchema>;

const voucherQuantity = z.coerce.number().int("Enter a whole number").min(1, "Enter at least 1").max(10000, "That number looks too high");

export const voucherOrderSchema = z.object({
  date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
  voucher: z.string().trim().min(1, "Voucher is required").max(40, "Voucher name is too long"),
  quantity: voucherQuantity,
  vendor: z.string().trim().max(120, "Vendor name is too long").optional(),
  note: z.string().trim().max(300, "Note is too long").optional(),
});
export type VoucherOrderInput = z.infer<typeof voucherOrderSchema>;

export const voucherReceiptSchema = z.object({
  orderId: z.string().min(1),
  date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
  quantity: voucherQuantity,
  vendor: z.string().trim().min(1, "Say which vendor it came from").max(120, "Vendor name is too long"),
  note: z.string().trim().max(300, "Note is too long").optional(),
});
export type VoucherReceiptInput = z.infer<typeof voucherReceiptSchema>;

export const activityCommentSchema = z.object({
  comment: z.string().trim().max(1000, "Comment is too long"),
});
