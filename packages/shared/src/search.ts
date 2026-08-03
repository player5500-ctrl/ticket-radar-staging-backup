import { z } from "zod";

import { EVENT_STATUSES } from "./domain";

export function normalizeSearchTerm(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const searchQuerySchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    city: z.string().trim().max(80).optional(),
    platform: z.string().trim().max(80).optional(),
    status: z.enum(EVENT_STATUSES).optional(),
    dateFrom: z
      .string()
      .regex(isoDatePattern, "開始日期格式必須為 YYYY-MM-DD")
      .optional(),
    dateTo: z
      .string()
      .regex(isoDatePattern, "結束日期格式必須為 YYYY-MM-DD")
      .optional(),
  })
  .refine(
    (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    {
      message: "結束日期不可早於開始日期",
      path: ["dateTo"],
    },
  );

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const resourceIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/, "資源識別碼格式不正確");
