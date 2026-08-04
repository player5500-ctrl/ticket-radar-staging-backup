import type { DataSource } from "@ticket-radar/shared";
import { DataSourceSchema } from "@ticket-radar/shared";
type SourceRow = Record<string, unknown>;
export class EventSyncRepository {
  constructor(private readonly db: D1Database) {}
  async listSources(): Promise<DataSource[]> {
    const result = await this.db
      .prepare("SELECT * FROM data_sources ORDER BY name")
      .all<SourceRow>();
    return result.results.map((row) =>
      DataSourceSchema.parse({
        id: row.id,
        key: row.key,
        name: row.name,
        sourceCategory: row.source_category,
        baseUrl: row.base_url,
        syncMethod: row.sync_method,
        status: row.status,
        agreementStatus: row.agreement_status,
        requiresAgreement: Boolean(row.requires_agreement),
        termsUrl: row.terms_url,
        termsSummary: row.terms_summary,
        contactEmail: row.contact_email,
        rateLimitPerHour: row.rate_limit_per_hour,
        syncFrequencyMinutes: row.sync_frequency_minutes,
        credibilityBaseScore: row.credibility_base_score,
        enabled: Boolean(row.enabled),
        trustLevel: row.trust_level,
        termsStatus: row.terms_status,
        robotsStatus: row.robots_status,
        timeoutMs: row.timeout_ms,
        retryLimit: row.retry_limit,
        adapterVersion: row.adapter_version,
        lastSyncAtUtc: row.last_sync_at_utc,
        lastSuccessAtUtc: row.last_success_at_utc,
        lastError: row.last_error,
        notes: row.notes,
        createdAtUtc: row.created_at_utc,
        updatedAtUtc: row.updated_at_utc,
      }),
    );
  }
  async createManualJob(
    actorUserId: string,
    sourceKey: string,
  ): Promise<{ id: string; status: string }> {
    const source = await this.db
      .prepare(
        "SELECT id,status,agreement_status,enabled,terms_status,robots_status FROM data_sources WHERE key=?",
      )
      .bind(sourceKey)
      .first<{
        id: string;
        status: string;
        agreement_status: string;
        enabled: number;
        terms_status: string;
        robots_status: string;
      }>();
    if (!source) throw new Error("SOURCE_NOT_FOUND");
    if (
      source.status !== "active" ||
      !["agreed", "not_required"].includes(source.agreement_status) ||
      !source.enabled ||
      source.terms_status !== "allowed" ||
      source.robots_status !== "allowed"
    )
      throw new Error("SOURCE_NOT_ELIGIBLE");
    const id = crypto.randomUUID();
    await this.db
      .prepare(
        "INSERT INTO source_sync_jobs (id,data_source_id,job_type,status,trigger_source,request_params_json,created_at_utc) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        source.id,
        "manual",
        "queued",
        "admin",
        JSON.stringify({ actorUserId }),
        new Date().toISOString(),
      )
      .run();
    return { id, status: "queued" };
  }
  async listCandidates(limit = 50) {
    return (
      await this.db
        .prepare(
          "SELECT id,name,normalized_name AS normalizedName,starts_at_utc AS startsAtUtc,city,status,credibility_score AS credibilityScore,created_at_utc AS createdAtUtc FROM event_candidates ORDER BY created_at_utc DESC LIMIT ?",
        )
        .bind(limit)
        .all()
    ).results;
  }
}
