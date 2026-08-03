export type AdapterStatus = "demo" | "disabled" | "testing" | "active";

export type ContactField = "purchaserName" | "email" | "phone";

export type FieldResult = {
  field: ContactField;
  status: "filled" | "missing" | "invalid" | "disabled";
};

export type AdapterCapabilities = {
  recognizeHost: boolean;
  inspectPurchasePage: boolean;
  fillContactFields: boolean;
  selectTicketOrSeat: boolean;
  acceptTerms: boolean;
  submitOrder: boolean;
  handlePayment: boolean;
  handleChallenge: boolean;
  capturePurchaseResult: boolean;
};

export type RedactionResult = {
  reliable: boolean;
  count: number;
};

export interface PlatformAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly status: AdapterStatus;
  readonly reviewedAt: string;
  readonly domains: readonly string[];
  readonly decisionNote: string;
  readonly supportedFields: readonly ContactField[];
  readonly capabilities: Readonly<AdapterCapabilities>;
  matchesUrl(input: string | URL): boolean;
  detectPage(document: Document): boolean;
  fillProfile(document: Document, candidate: unknown): FieldResult[];
  detectSuccess(document: Document): boolean;
  redactSuccess(document: Document): RedactionResult;
  clearRedaction(document: Document): void;
}
