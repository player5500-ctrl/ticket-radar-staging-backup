import type { RawFetchResult } from "@ticket-radar/shared";

export interface EventSourceAdapter {
  readonly sourceKey: string;
  fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult>;
  fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult>;
}
