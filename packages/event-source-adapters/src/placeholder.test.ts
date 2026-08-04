import { describe, expect, it } from "vitest";
import { createPhase0Adapters, PHASE0_SOURCE_KEYS } from "./placeholder";
import { validatePublicUrl } from "./phase0";

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
});
