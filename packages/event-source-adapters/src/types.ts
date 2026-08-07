import type { RawFetchResult } from "@ticket-radar/shared";

export interface EventSourceAdapter {
  readonly sourceKey: string;
  readonly id?: string;
  readonly name?: string;
  readonly sourceType?: "api" | "jsonld" | "feed" | "public_page" | "manual";
  fetchRecent(params: { since?: string; limit: number; cursor?: string }): Promise<RawFetchResult>;
  fetchByQuery(params: { query: string; limit: number; cursor?: string }): Promise<RawFetchResult>;
  fetch?(input: {
    since?: string;
    query?: string;
    limit: number;
    cursor?: string;
  }): Promise<RawFetchResult>;
  parse?(raw: unknown): Promise<unknown[]>;
  normalize?(candidate: unknown): Promise<unknown>;
  healthCheck?(): Promise<{ ok: boolean; checkedAtUtc: string; error: string | null }>;
}
