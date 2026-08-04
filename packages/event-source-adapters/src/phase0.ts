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
export class ManualSourceAdapter implements EventSourceAdapter {
  readonly sourceKey = "manual";
  readonly name = "Manual source";
  readonly sourceType = "manual" as const;
  async fetchRecent(_params: {
    since?: string;
    limit: number;
  }): Promise<RawFetchResult> {
    return { records: [], fetchedAtUtc: new Date().toISOString() };
  }
  async fetchByQuery(_params: {
    query: string;
    limit: number;
  }): Promise<RawFetchResult> {
    return { records: [], fetchedAtUtc: new Date().toISOString() };
  }
  submit(url: string, _submittedBy: string): RawEventSource {
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
  async fetchRecent(_params: {
    since?: string;
    limit: number;
  }): Promise<RawFetchResult> {
    return { records: [], fetchedAtUtc: new Date().toISOString() };
  }
  async fetchByQuery(_params: {
    query: string;
    limit: number;
  }): Promise<RawFetchResult> {
    return { records: [], fetchedAtUtc: new Date().toISOString() };
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
  async parse(raw: unknown) {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as { payload?: unknown; sourceUrl?: string };
    return typeof record.payload === "string"
      ? extractJsonLdEvents(record.payload, {
          sourceId: this.sourceKey,
          sourceUrl: record.sourceUrl ?? "https://invalid.example",
          rawSourceId: "unknown",
        })
      : [];
  }
  async normalize(candidate: unknown) {
    return candidate;
  }
}
export class MockApiAdapter extends Phase0PlaceholderAdapter {
  constructor() {
    super("mock_api");
  }
  readonly sourceType = "api" as const;
  async fetchRecent(params: {
    since?: string;
    limit: number;
  }): Promise<RawFetchResult> {
    return {
      records: [
        {
          externalId: `mock-${params.limit}`,
          sourceUrl: "https://mock.ticket-radar.invalid/events/1",
          payload: JSON.stringify({
            id: `mock-${params.limit}`,
            name: "BIGBANG Mock Event",
            startDate: "2026-09-01T19:00:00+08:00",
          }),
          fetchedAtUtc: new Date().toISOString(),
        },
      ],
      fetchedAtUtc: new Date().toISOString(),
    };
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
