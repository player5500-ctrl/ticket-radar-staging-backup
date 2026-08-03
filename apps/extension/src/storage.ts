import {
  hasBlockedProfileField,
  ticketProfileSchema,
  type TicketProfile,
} from "@ticket-radar/shared";
import type { EncryptedEnvelope } from "./crypto";
const key = "ticketRadar.profileEnvelope";
export async function saveEnvelope(envelope: EncryptedEnvelope) {
  await chrome.storage.local.set({ [key]: envelope });
}
export async function loadEnvelope() {
  return (await chrome.storage.local.get(key))[key] as EncryptedEnvelope | undefined;
}
export function validateProfile(value: Record<string, unknown>): TicketProfile {
  if (hasBlockedProfileField(value))
    throw new Error("資料組不得包含密碼、OTP、卡號、CVV、CAPTCHA 或身分證資料。");
  return ticketProfileSchema.parse(value);
}
