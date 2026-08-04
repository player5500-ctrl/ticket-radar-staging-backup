import { DataSourceSchema, type DataSource } from "@ticket-radar/shared";

type DataSourceRow = {
  id: string;
  key: string;
  name: string;
  source_category: DataSource["sourceCategory"];
  base_url: string | null;
  sync_method: DataSource["syncMethod"];
  status: DataSource["status"];
  agreement_status: DataSource["agreementStatus"];
  requires_agreement: number;
  terms_url: string | null;
  terms_summary: string | null;
  contact_email: string | null;
  rate_limit_per_hour: number | null;
  sync_frequency_minutes: number | null;
  credibility_base_score: number;
  last_sync_at_utc: string | null;
  last_success_at_utc: string | null;
  last_error: string | null;
  notes: string | null;
  created_at_utc: string;
  updated_at_utc: string;
  enabled?: number;
  trust_level?: DataSource["trustLevel"];
  terms_status?: DataSource["termsStatus"];
  robots_status?: DataSource["robotsStatus"];
  timeout_ms?: number;
  retry_limit?: number;
  adapter_version?: string;
};

const SELECT = `SELECT id,key,name,source_category,base_url,sync_method,status,agreement_status,requires_agreement,terms_url,terms_summary,contact_email,rate_limit_per_hour,sync_frequency_minutes,credibility_base_score,last_sync_at_utc,last_success_at_utc,last_error,notes,created_at_utc,updated_at_utc FROM data_sources`;

function mapRow(row: DataSourceRow): DataSource {
  return DataSourceSchema.parse({
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
  });
}

export class DataSourceRepository {
  constructor(private readonly db: D1Database) {}

  async getActiveEligibleSources(): Promise<DataSource[]> {
    const result = await this.db
      .prepare(
        `${SELECT} WHERE status = 'active' AND agreement_status IN ('agreed','not_required') ORDER BY key`,
      )
      .all<DataSourceRow>();
    return result.results.map(mapRow);
  }

  async getSourceByKey(key: string): Promise<DataSource | null> {
    const row = await this.db
      .prepare(`${SELECT} WHERE key = ? LIMIT 1`)
      .bind(key)
      .first<DataSourceRow>();
    return row ? mapRow(row) : null;
  }
}
