import { z } from "zod";

export const reminderChannelSchema = z.enum(["web_push", "ics", "email", "line"]);
export type ReminderChannel = z.infer<typeof reminderChannelSchema>;

export const ticketTaskInputSchema = z.object({
  eventId: z.string().min(1).max(120),
  budgetTwd: z.number().int().min(0).max(1_000_000).nullable().optional(),
  maxTicketCount: z.number().int().min(1).max(20).nullable().optional(),
  acceptableSessions: z.array(z.string().trim().min(1).max(120)).max(8).default([]),
  areaPreferences: z.array(z.string().trim().min(1).max(120)).max(3).default([]),
  notes: z.string().trim().max(1000).default(""),
});
export type TicketTaskInput = z.infer<typeof ticketTaskInputSchema>;

export const ticketTaskUpdateSchema = ticketTaskInputSchema
  .omit({ eventId: true })
  .partial()
  .extend({
    status: z.enum(["active", "paused", "completed", "cancelled"]).optional(),
  });
export type TicketTaskUpdate = z.infer<typeof ticketTaskUpdateSchema>;

export const reminderInputSchema = z.object({
  eventId: z.string().min(1).max(120),
  ticketTaskId: z.string().min(1).max(120).nullable().optional(),
  ticketSaleWindowId: z.string().min(1).max(120).nullable().optional(),
  channel: reminderChannelSchema,
  scheduledAtUtc: z.string().datetime({ offset: true }),
  customMessage: z.string().trim().max(280).nullable().optional(),
});
export type ReminderInput = z.infer<typeof reminderInputSchema>;

export type TicketTaskChecklistItem = {
  id: string;
  itemKey: string;
  label: string;
  isApplicable: boolean;
  isCompleted: boolean;
  sortOrder: number;
};

export type TicketTask = {
  id: string;
  eventId: string;
  eventName: string;
  eventStartsAtUtc: string;
  timezone: string;
  status: "active" | "paused" | "completed" | "cancelled";
  budgetTwd: number | null;
  maxTicketCount: number | null;
  acceptableSessions: string[];
  areaPreferences: string[];
  notes: string;
  checklist: TicketTaskChecklistItem[];
  readinessPercent: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type Reminder = {
  id: string;
  eventId: string;
  ticketTaskId: string | null;
  ticketSaleWindowId: string | null;
  channel: ReminderChannel;
  scheduledAtUtc: string;
  status: "scheduled" | "cancelled" | "sent" | "failed";
  customMessage: string | null;
  eventName: string;
  timezone: string;
};
