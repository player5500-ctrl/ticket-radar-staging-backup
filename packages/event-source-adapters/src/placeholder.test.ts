import { describe, expect, it } from "vitest";
import { createPhase0Adapters, PHASE0_SOURCE_KEYS } from "./placeholder";
import {
  fetchAllPages,
  MockApiAdapter,
  resilientFetch,
  validatePublicUrl,
} from "./phase0";

describe("Phase 0 event source adapters", () => {
  it("registers all matrix sources without making network calls", async () => {
    const adapters = createPhase0Adapters();
    expect(adapters.map((adapter) => adapter.sourceKey)).toEqual([
      ...PHASE0_SOURCE_KEYS,
    ]);
    const adapter = adapters[0];
    expect(adapter).toBeDefined();
    await expect(adapter!.fetchRecent({ limit: 10 })).resolves.toEqual(
      expect.objectContaining({ records: [] }),
    );
    await expect(adapter!.fetchByQuery({ query: "test", limit: 10 })).resolves.toEqual(
      expect.objectContaining({ records: [] }),
    );
  });

  it("blocks SSRF targets and non-HTTPS URLs", () => {
    expect(() => validatePublicUrl("http://127.0.0.1/secret")).toThrow();
    expect(() =>
      validatePublicUrl("https://metadata.google.internal/computeMetadata/v1"),
    ).toThrow();
    expect(() =>
      validatePublicUrl("https://example.com", ["allowed.example"]),
    ).toThrow();
  });

  it("walks MockApiAdapter pages using cursors", async () => {
    const outcome = await fetchAllPages(new MockApiAdapter(), { limit: 2 });
    expect(outcome.status).toBe("success");
    expect(outcome.pagesFetched).toBe(3);
    expect(outcome.records.map((record) => record.externalId)).toEqual([
      "mock-1",
      "mock-2",
      "mock-3",
      "mock-4",
      "mock-5",
    ]);
    expect(outcome.nextCursor).toBeNull();
  });

  it("retries a temporary MockApiAdapter failure", async () => {
    const adapter = new MockApiAdapter({ transientFailureOnce: true });
    const outcome = await resilientFetch(() => adapter.fetchRecent({ limit: 2 }), {
      maxRetries: 2,
    });
    expect(outcome.status).toBe("success");
    expect(outcome.attempts).toBe(2);
    expect(outcome.result?.records).toHaveLength(2);
  });

  it("degrades gracefully after a MockApiAdapter rate limit", async () => {
    const outcome = await fetchAllPages(
      new MockApiAdapter({ rateLimitAfter: 1 }),
      { limit: 2 },
      { maxRetries: 2 },
    );
    expect(outcome.status).toBe("degraded");
    expect(outcome.records).toHaveLength(2);
    expect(outcome.pagesFetched).toBe(1);
    expect(outcome.error).toContain("rate limit");
  });
});
