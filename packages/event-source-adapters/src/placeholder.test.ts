import { describe, expect, it } from "vitest";
import { createPhase0Adapters, PHASE0_SOURCE_KEYS } from "./placeholder";

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
});
