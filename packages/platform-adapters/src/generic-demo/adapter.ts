import { ticketProfileSchema, type TicketProfile } from "@ticket-radar/shared";
import type { FieldResult, PlatformAdapter } from "../types";

const DEMO_ROOT = "[data-ticket-radar-demo='ticket-form']";
const allowedFields = ["purchaserName", "email", "phone"] as const;
export type DemoField = (typeof allowedFields)[number];

export function detectDemoPage(document: Document) {
  return Boolean(document.querySelector(DEMO_ROOT));
}

export function detectDemoSuccess(document: Document) {
  return Boolean(document.querySelector("[data-ticket-radar-demo='success']"));
}

export function redactDemoSuccess(document: Document) {
  const targets = document.querySelectorAll<HTMLElement>("[data-tr-sensitive]");
  targets.forEach((target) => {
    target.dataset.trRedacted = "true";
    target.style.background = "#111827";
    target.style.color = "#111827";
  });
  return { reliable: targets.length > 0, count: targets.length };
}

export function clearDemoRedaction(document: Document) {
  document
    .querySelectorAll<HTMLElement>("[data-tr-redacted='true']")
    .forEach((target) => {
      target.style.background = "";
      target.style.color = "";
      delete target.dataset.trRedacted;
    });
}

export const genericDemoAdapter: PlatformAdapter = {
  id: "generic-demo",
  name: "Ticket Radar 受控 Demo",
  version: "0.1.0",
  status: "demo",
  reviewedAt: "2026-07-29",
  domains: ["127.0.0.1"],
  decisionNote: "僅限本機受控 Demo，使用者主動觸發聯絡資料填入。",
  supportedFields: allowedFields,
  capabilities: {
    recognizeHost: true,
    inspectPurchasePage: true,
    fillContactFields: true,
    selectTicketOrSeat: false,
    acceptTerms: false,
    submitOrder: false,
    handlePayment: false,
    handleChallenge: false,
    capturePurchaseResult: true,
  },
  matchesUrl(input) {
    try {
      const url = typeof input === "string" ? new URL(input) : input;
      return (
        url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port === "5173"
      );
    } catch {
      return false;
    }
  },
  detectPage: detectDemoPage,
  fillProfile: fillDemoProfile,
  detectSuccess: detectDemoSuccess,
  redactSuccess: redactDemoSuccess,
  clearRedaction: clearDemoRedaction,
};

export function fillDemoProfile(document: Document, candidate: unknown): FieldResult[] {
  const parsed = ticketProfileSchema.safeParse(candidate);
  if (!parsed.success || !detectDemoPage(document)) {
    return allowedFields.map((field) => ({ field, status: "invalid" }));
  }
  const profile: TicketProfile = parsed.data;
  return allowedFields.map((field) => {
    const input = document.querySelector<HTMLInputElement>(
      `${DEMO_ROOT} [data-tr-field='${field}']`,
    );
    if (!input) return { field, status: "missing" };
    input.value = profile[field];
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { field, status: "filled" };
  });
}
