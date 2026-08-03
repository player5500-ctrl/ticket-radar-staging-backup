import type { PlatformAdapter } from "./types";

type DisabledAdapterOptions = {
  id: string;
  name: string;
  domains: readonly string[];
  decisionNote: string;
};

function isAllowedHostname(hostname: string, domains: readonly string[]) {
  const normalizedHostname = hostname.toLowerCase().replace(/\.$/, "");
  return domains.some((domain) => {
    const normalizedDomain = domain.toLowerCase();
    return (
      normalizedHostname === normalizedDomain ||
      normalizedHostname.endsWith(`.${normalizedDomain}`)
    );
  });
}

export function createDisabledEvaluationAdapter({
  id,
  name,
  domains,
  decisionNote,
}: DisabledAdapterOptions): PlatformAdapter {
  return {
    id,
    name,
    version: "0.1.0-evaluation",
    status: "disabled",
    reviewedAt: "2026-07-29",
    domains,
    decisionNote,
    supportedFields: [],
    capabilities: {
      recognizeHost: true,
      inspectPurchasePage: false,
      fillContactFields: false,
      selectTicketOrSeat: false,
      acceptTerms: false,
      submitOrder: false,
      handlePayment: false,
      handleChallenge: false,
      capturePurchaseResult: false,
    },
    matchesUrl(input) {
      try {
        const url = typeof input === "string" ? new URL(input) : input;
        return url.protocol === "https:" && isAllowedHostname(url.hostname, domains);
      } catch {
        return false;
      }
    },
    detectPage() {
      return false;
    },
    fillProfile() {
      return [];
    },
    detectSuccess() {
      return false;
    },
    redactSuccess() {
      return { reliable: false, count: 0 };
    },
    clearRedaction() {
      // Disabled adapters never change the page.
    },
  };
}
