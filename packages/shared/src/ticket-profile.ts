import { z } from "zod";

const blockedProfileKeys = new Set([
  "password",
  "otp",
  "oneTimePassword",
  "cardNumber",
  "cvv",
  "captcha",
  "bankAccount",
  "nationalId",
]);

export const ticketProfileSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    purchaserName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(254),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 -]{8,20}$/)
      .max(20),
  })
  .strict();

export type TicketProfile = z.infer<typeof ticketProfileSchema>;

export function hasBlockedProfileField(value: Record<string, unknown>) {
  return Object.keys(value).some((key) => blockedProfileKeys.has(key));
}
