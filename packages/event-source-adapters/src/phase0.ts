import type { RawEventSource, RawFetchResult } from "@ticket-radar/shared";
import { RawFetchResultSchema } from "@ticket-radar/shared";
import type { EventSourceAdapter } from "./types";
import { Phase0PlaceholderAdapter } from "./placeholder";
import { extractJsonLdEvents } from "./generic-jsonld/parser";

export type Phase0AdapterContext = {
  fetcher?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  allowedHosts?: string[];
};
export type ResilientFetchOptions = {
  maxRetries?: number;
  backoffMs?: number;
};
export type ResilientFetchOutcome = {
  result: RawFetchResult | null;
  status: "success" | "degraded";
  attempts: number;
  error: string | null;
};

export class MockApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MockApiError";
  }
}

const isRetryableFetchError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown }).status;
  return status === 429 || (typeof status === "number" && status >= 500);
};

export async function resilientFetch(
  fetcher: () => Promise<RawFetchResult>,
  options: ResilientFetchOptions = {},
): Promise<ResilientFetchOutcome> {
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const backoffMs = Math.max(0, options.backoffMs ?? 0);
  let attempts = 0;
  let lastError: unknown = null;
  while (attempts <= maxRetries) {
    attempts += 1;
    try {
      return {
        result: await fetcher(),
        status: "success",
        attempts,
        error: null,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableFetchError(error) || attempts > maxRetries) break;
      if (backoffMs > 0) await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  return {
    result: null,
    status: "degraded",
    attempts,
    error: lastError instanceof Error ? lastError.message : "fetch failed",
  };
}

export type PaginatedFetchOutcome = ResilientFetchOutcome & {
  records: RawFetchResult["records"];
  nextCursor: string | null;
  pagesFetched: number;
};

export async function fetchAllPages(
  adapter: Pick<EventSourceAdapter, "fetchRecent">,
  params: { since?: string; limit: number },
  options: ResilientFetchOptions & { maxPages?: number } = {},
): Promise<PaginatedFetchOutcome> {
  const records: RawFetchResult["records"] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;
  let totalAttempts = 0;
  while (pagesFetched < (options.maxPages ?? 20)) {
    const outcome = await resilientFetch(
      () =>
        adapter.fetchRecent(
          cursor ? { ...params, cursor } : { ...params },
        ),
      options,
    );
    totalAttempts += outcome.attempts;
    if (!outcome.result) {
      return {
        ...outcome,
        attempts: totalAttempts,
        records,
        nextCursor: cursor ?? null,
        pagesFetched,
      };
    }
    pagesFetched += 1;
    records.push(...outcome.result.records);
    cursor = outcome.result.nextCursor ?? undefined;
    if (!cursor) {
      return {
        ...outcome,
        attempts: totalAttempts,
        records,
        nextCursor: null,
        pagesFetched,
      };
    }
  }
  return {
    result: null,
    status: "degraded",
    attempts: totalAttempts,
    error: "maximum page limit reached",
    records,
    nextCursor: cursor ?? null,
    pagesFetched,
  };
}
export class ManualSourceAdapter implements EventSourceAdapter {
  readonly sourceKey = "manual";
  readonly name = "Manual source";
  readonly sourceType = "manual" as const;
  fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve({ records: [], fetchedAtUtc: new Date().toISOString() });
  }
  fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve({ records: [], fetchedAtUtc: new Date().toISOString() });
  }
  submit(url: string, submittedBy: string): RawEventSource {
    void submittedBy;
    return {
      id: `raw-${crypto.randomUUID()}`,
      dataSourceId: "manual",
      sourceSyncJobId: null,
      externalId: null,
      sourceUrl: url,
      contentHash: null,
      rawPayload: null,
      rawPayloadR2Key: null,
      fetchedAtUtc: new Date().toISOString(),
      parserStatus: "pending",
      parseError: null,
      retentionExpiresAtUtc: new Date(Date.now() + 90 * 86400000).toISOString(),
      createdAtUtc: new Date().toISOString(),
    };
  }
}
export class GenericJsonLdEventAdapter implements EventSourceAdapter {
  constructor(
    public readonly sourceKey = "generic_jsonld",
    private readonly context: Phase0AdapterContext = {},
  ) {}
  readonly sourceType = "jsonld" as const;
  fetchRecent(params: { since?: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve({ records: [], fetchedAtUtc: new Date().toISOString() });
  }
  fetchByQuery(params: { query: string; limit: number }): Promise<RawFetchResult> {
    void params;
    return Promise.resolve({ records: [], fetchedAtUtc: new Date().toISOString() });
  }
  async fetchUrl(url: string): Promise<RawFetchResult> {
    const parsed = validatePublicUrl(url, this.context.allowedHosts);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.context.timeoutMs ?? 5000,
    );
    try {
      const response = await (this.context.fetcher ?? fetch)(parsed.toString(), {
        redirect: "manual",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`source responded ${response.status}`);
      const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.toLowerCase();
      if (
        contentType !== "text/html" &&
        contentType !== "application/ld+json" &&
        contentType !== "application/json"
      )
        throw new Error("unsupported content type");
      const text = await response.text();
      if (text.length > (this.context.maxBytes ?? 1_000_000))
        throw new Error("response exceeds size limit");
      const result = {
        records: [
          {
            externalId: null,
            sourceUrl: parsed.toString(),
            payload: text,
            fetchedAtUtc: new Date().toISOString(),
          },
        ],
        fetchedAtUtc: new Date().toISOString(),
      };
      return RawFetchResultSchema.parse(result);
    } finally {
      clearTimeout(timeout);
    }
  }
  parse(raw: unknown) {
    if (!raw || typeof raw !== "object") return Promise.resolve([]);
    const record = raw as { payload?: unknown; sourceUrl?: string };
    return typeof record.payload === "string"
      ? Promise.resolve(
          extractJsonLdEvents(record.payload, {
            sourceId: this.sourceKey,
            sourceUrl: record.sourceUrl ?? "https://invalid.example",
            rawSourceId: "unknown",
          }),
        )
      : Promise.resolve([]);
  }
  normalize(candidate: unknown) {
    return Promise.resolve(candidate);
  }
}
export class MockApiAdapter extends Phase0PlaceholderAdapter {
  private calls = 0;
  private transientFailureReturned = false;
  constructor(
    private readonly options: {
      transientFailureOnce?: boolean;
      rateLimitAfter?: number;
    } = {},
  ) {
    super("mock_api");
  }
  readonly sourceType = "api" as const;
  fetchRecent(params: { since?: string; limit: number; cursor?: string }): Promise<RawFetchResult> {
    void params.since;
    this.calls += 1;
    if (this.options.rateLimitAfter !== undefined && this.calls > this.options.rateLimitAfter)
      throw new MockApiError("mock rate limit exceeded", 429);
    if (this.options.transientFailureOnce && !this.transientFailureReturned) {
      this.transientFailureReturned = true;
      throw new MockApiError("mock temporary upstream failure", 503);
    }
    const page = Number.parseInt(params.cursor ?? "0", 10);
    const start = Number.isFinite(page) ? page : 0;
    const records = Array.from({ length: 5 }, (_, index) => ({
      externalId: `mock-${index + 1}`,
      sourceUrl: `https://mock.ticket-radar.invalid/events/${index + 1}`,
      payload: JSON.stringify({
        id: `mock-${index + 1}`,
        name: `BIGBANG Mock Event ${index + 1}`,
        startDate: "2026-09-01T19:00:00+08:00",
      }),
      fetchedAtUtc: new Date().toISOString(),
    })).slice(start, start + Math.max(1, params.limit));
    const nextStart = start + records.length;
    return Promise.resolve({
      records,
      fetchedAtUtc: new Date().toISOString(),
      nextCursor: nextStart < 5 ? String(nextStart) : null,
    });
  }

  fetchByQuery(params: { query: string; limit: number; cursor?: string }) {
    void params.query;
    return this.fetchRecent(params);
  }
}
export function validatePublicUrl(value: string, allowedHosts?: string[]): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("only https sources are allowed");
  if (url.username || url.password)
    throw new Error("credentials in source URL are not allowed");
  const host = url.hostname.toLowerCase();
  if (allowedHosts && !allowedHosts.includes(host))
    throw new Error("source host is not allowlisted");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  )
    throw new Error("private or metadata host is blocked");
  return url;
}
