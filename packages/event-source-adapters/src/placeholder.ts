import type { RawFetchResult } from "@ticket-radar/shared";
import type { EventSourceAdapter } from "./types";

const emptyResult = (): RawFetchResult => ({
  records: [],
  fetchedAtUtc: new Date().toISOString(),
});

export class Phase0PlaceholderAdapter implements EventSourceAdapter {
  constructor(public readonly sourceKey: string) {}
  fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve(emptyResult());
  }
  fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve(emptyResult());
  }
  healthCheck() {
    return Promise.resolve({
      ok: true,
      checkedAtUtc: new Date().toISOString(),
      error: null,
    });
  }
}

export const PHASE0_SOURCE_KEYS = [
  "kktix",
  "tixcraft",
  "ticket_plus",
  "ibon",
  "opentix",
  "kham",
  "era_ticket",
  "live_nation_taiwan",
  "tmc",
  "kpmc",
  "zepp_newtaipei",
  "ticketmaster_discovery",
  "songkick",
] as const;
export const createPhase0Adapters = (): EventSourceAdapter[] =>
  PHASE0_SOURCE_KEYS.map((key) => new Phase0PlaceholderAdapter(key));
