import { describe, expect, it, vi } from "vitest";
import { DataSourceRepository } from "./data-source.repository";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "source-1",
  key: "kktix",
  name: "KKTIX",
  source_category: "ticketing_platform",
  base_url: "https://kktix.com",
  sync_method: "atom_feed",
  status: "active",
  agreement_status: "not_required",
  requires_agreement: 0,
  terms_url: null,
  terms_summary: null,
  contact_email: null,
  rate_limit_per_hour: 60,
  sync_frequency_minutes: 60,
  credibility_base_score: 90,
  last_sync_at_utc: null,
  last_success_at_utc: null,
  last_error: null,
  notes: null,
  created_at_utc: "2026-08-04T00:00:00.000Z",
  updated_at_utc: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

function dbFor(results: unknown[], first: unknown = null) {
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({
      first: vi.fn(() => first),
      all: vi.fn(() => ({ results })),
    })),
    all: vi.fn(() => ({ results })),
  }));
  return { prepare } as unknown as D1Database;
}

describe("DataSourceRepository", () => {
  it("only returns active sources with an eligible agreement", async () => {
    const db = dbFor([row()]);
    const sources = await new DataSourceRepository(db).getActiveEligibleSources();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.requiresAgreement).toBe(false);
    expect((db.prepare as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain(
      "agreement_status IN ('agreed','not_required')",
    );
  });

  it("does not expose pending agreement sources through the gate", async () => {
    const db = dbFor([]);
    await expect(
      new DataSourceRepository(db).getActiveEligibleSources(),
    ).resolves.toEqual([]);
  });

  it("gets a source by key", async () => {
    const db = dbFor(
      [],
      row({ agreement_status: "not_contacted", status: "pending_agreement" }),
    );
    await expect(
      new DataSourceRepository(db).getSourceByKey("kktix"),
    ).resolves.toMatchObject({ key: "kktix", status: "pending_agreement" });
  });
});
