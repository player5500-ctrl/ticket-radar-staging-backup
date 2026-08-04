import type { DataSource } from "@ticket-radar/shared";
import { DataSourceSchema } from "@ticket-radar/shared";

type SourceRow = Record<string, unknown>;

export type ManualSubmissionInput = {
  sourceUrl: string;
  submittedByUserId: string;
  rawPayload?: string | null;
};

export type CandidateApprovalInput = {
  candidateId: string;
  adminUserId: string;
  requestId: string;
};

const now = () => new Date().toISOString();
const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const normalizeContactEmail = (value: unknown) => {
  if (typeof value !== "string") return null;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};
const contentHash = (payload: string) => {
  let hash = 2166136261;
  for (const char of payload) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `fnv1a-${(hash >>> 0).toString(16)}`;
};
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
        contactEmail: normalizeContactEmail(row.contact_email),
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

  async updateSourceControls(
    sourceKey: string,
    input: {
      enabled?: boolean | undefined;
      termsStatus?:
        "unknown" | "review_required" | "allowed" | "prohibited" | undefined;
      robotsStatus?:
        "unknown" | "review_required" | "allowed" | "prohibited" | undefined;
      trustLevel?: "low" | "medium" | "high" | "unverified" | undefined;
    },
    actorUserId: string,
    requestId: string,
  ) {
    const source = await this.db
      .prepare(
        "SELECT id,status,agreement_status,enabled,terms_status,robots_status,trust_level FROM data_sources WHERE key=?",
      )
      .bind(sourceKey)
      .first<{
        id: string;
        status: string;
        agreement_status: string;
        enabled: number;
        terms_status: string;
        robots_status: string;
        trust_level: string;
      }>();
    if (!source) throw new Error("SOURCE_NOT_FOUND");
    const termsStatus = input.termsStatus ?? source.terms_status;
    const robotsStatus = input.robotsStatus ?? source.robots_status;
    const enabling = input.enabled === true;
    if (
      enabling &&
      (source.status !== "active" ||
        !["agreed", "not_required"].includes(source.agreement_status) ||
        termsStatus !== "allowed" ||
        robotsStatus !== "allowed")
    )
      throw new Error("SOURCE_NOT_ELIGIBLE");
    const updatedAtUtc = now();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE data_sources SET enabled=?,terms_status=?,robots_status=?,trust_level=?,updated_at_utc=? WHERE id=?",
        )
        .bind(
          input.enabled === undefined ? source.enabled : input.enabled ? 1 : 0,
          termsStatus,
          robotsStatus,
          input.trustLevel ?? source.trust_level,
          updatedAtUtc,
          source.id,
        ),
      this.db
        .prepare(
          "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,before_summary_json,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          actorUserId,
          "event_source.controls.update",
          "data_source",
          source.id,
          requestId,
          JSON.stringify({
            enabled: Boolean(source.enabled),
            termsStatus: source.terms_status,
            robotsStatus: source.robots_status,
            trustLevel: source.trust_level,
          }),
          JSON.stringify({
            enabled:
              input.enabled === undefined ? Boolean(source.enabled) : input.enabled,
            termsStatus,
            robotsStatus,
            trustLevel: input.trustLevel ?? source.trust_level,
          }),
          updatedAtUtc,
        ),
    ]);
  }
  async listCandidates(limit = 50) {
    return (
      await this.db
        .prepare(
          "SELECT c.id,c.name,c.normalized_name AS normalizedName,c.starts_at_utc AS startsAtUtc,c.city,c.status,c.credibility_score AS credibilityScore,c.created_at_utc AS createdAtUtc,c.raw_event_source_id AS rawSourceId,c.matched_event_id AS matchedEventId,r.source_url AS sourceUrl FROM event_candidates c LEFT JOIN raw_event_sources r ON r.id=c.raw_event_source_id ORDER BY c.created_at_utc DESC LIMIT ?",
        )
        .bind(limit)
        .all()
    ).results;
  }

  async getCandidate(candidateId: string) {
    return this.db
      .prepare(
        "SELECT c.id,c.name,c.status,c.city,c.starts_at_utc AS startsAtUtc,c.organizer_name AS organizerName,c.official_event_url AS officialEventUrl,c.official_ticket_url AS officialTicketUrl,c.credibility_score AS credibilityScore,c.confidence,c.raw_event_source_id AS rawSourceId,r.source_url AS sourceUrl,r.external_id AS externalId FROM event_candidates c LEFT JOIN raw_event_sources r ON r.id=c.raw_event_source_id WHERE c.id=?",
      )
      .bind(candidateId)
      .first<{
        id: string;
        name: string;
        status:
          | "pending_review"
          | "auto_verified"
          | "confirmed"
          | "rejected"
          | "duplicate"
          | "expired";
        city: string | null;
        startsAtUtc: string | null;
        organizerName: string | null;
        officialEventUrl: string | null;
        officialTicketUrl: string | null;
        credibilityScore: number;
        confidence: number;
        rawSourceId: string;
        sourceUrl: string | null;
        externalId: string | null;
      }>();
  }

  async rejectCandidate(
    candidateId: string,
    adminUserId: string,
    requestId: string,
    reason: string,
  ) {
    const candidate = await this.getCandidate(candidateId);
    if (!candidate || candidate.status !== "pending_review")
      throw new Error("CANDIDATE_NOT_REVIEWABLE");
    const decidedAtUtc = now();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE event_candidates SET status='rejected',updated_at_utc=? WHERE id=?",
        )
        .bind(decidedAtUtc, candidateId),
      this.db
        .prepare(
          "INSERT INTO verification_reviews (id,candidate_id,reviewer_type,reviewer_user_id,decision,reason,decided_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          candidateId,
          "admin",
          adminUserId,
          "reject",
          reason,
          decidedAtUtc,
          decidedAtUtc,
        ),
      this.db
        .prepare(
          "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          adminUserId,
          "event_candidate.reject",
          "event_candidate",
          candidateId,
          requestId,
          JSON.stringify({ reason }),
          decidedAtUtc,
        ),
    ]);
  }

  async mergeCandidateIntoEvent(
    candidateId: string,
    targetEventId: string,
    adminUserId: string,
    requestId: string,
  ) {
    const candidate = await this.getCandidate(candidateId);
    const event = await this.db
      .prepare("SELECT id FROM events WHERE id=? AND deleted_at_utc IS NULL")
      .bind(targetEventId)
      .first<{ id: string }>();
    if (!candidate || candidate.status !== "pending_review" || !event)
      throw new Error("CANDIDATE_MERGE_NOT_ALLOWED");
    const link = await this.db
      .prepare("SELECT id FROM event_source_links WHERE candidate_id=? LIMIT 1")
      .bind(candidateId)
      .first<{ id: string }>();
    const resolvedAtUtc = now();
    const statements = [
      this.db
        .prepare(
          "UPDATE event_candidates SET status='duplicate',matched_event_id=?,updated_at_utc=? WHERE id=?",
        )
        .bind(targetEventId, resolvedAtUtc, candidateId),
      this.db
        .prepare(
          "INSERT INTO verification_reviews (id,candidate_id,reviewer_type,reviewer_user_id,decision,reason,decided_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          candidateId,
          "admin",
          adminUserId,
          "approve",
          "Merged into existing event",
          resolvedAtUtc,
          resolvedAtUtc,
        ),
      this.db
        .prepare(
          "INSERT INTO event_duplicates (id,candidate_a_id,existing_event_id,similarity_score,match_method,status,resolved_by,resolved_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          candidateId,
          targetEventId,
          1,
          "admin_manual",
          "confirmed_duplicate",
          "admin",
          resolvedAtUtc,
          resolvedAtUtc,
        ),
      this.db
        .prepare(
          "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          adminUserId,
          "event_candidate.merge",
          "event",
          targetEventId,
          requestId,
          JSON.stringify({ candidateId }),
          resolvedAtUtc,
        ),
    ];
    if (link)
      statements.push(
        this.db
          .prepare(
            "UPDATE event_source_links SET event_id=?,candidate_id=NULL,last_confirmed_at_utc=?,updated_at_utc=? WHERE id=?",
          )
          .bind(targetEventId, resolvedAtUtc, resolvedAtUtc, link.id),
      );
    await this.db.batch(statements);
  }

  async submitManualSource(input: ManualSubmissionInput) {
    const source = await this.db
      .prepare(
        "SELECT id, credibility_base_score FROM data_sources WHERE key='manual_submission'",
      )
      .first<{ id: string; credibility_base_score: number }>();
    if (!source) throw new Error("MANUAL_SOURCE_NOT_CONFIGURED");
    const createdAtUtc = now();
    const rawId = crypto.randomUUID();
    const payload = input.rawPayload ?? null;
    const hash = payload ? contentHash(payload) : null;
    try {
      await this.db.batch([
        this.db
          .prepare(
            "INSERT INTO raw_event_sources (id,data_source_id,source_sync_job_id,external_id,source_url,content_hash,raw_payload,raw_payload_r2_key,fetched_at_utc,parser_status,retention_expires_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            rawId,
            source.id,
            null,
            null,
            input.sourceUrl,
            hash,
            payload,
            null,
            createdAtUtc,
            payload ? "pending" : "ignored",
            new Date(Date.now() + 90 * 86400000).toISOString(),
            createdAtUtc,
          ),
        this.db
          .prepare(
            "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            input.submittedByUserId,
            "event_source.manual.submit",
            "raw_event_source",
            rawId,
            crypto.randomUUID(),
            JSON.stringify({
              sourceUrl: input.sourceUrl,
              hasPayload: Boolean(payload),
            }),
            createdAtUtc,
          ),
      ]);
    } catch (error) {
      if (
        hash &&
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed")
      )
        throw new Error("DUPLICATE_RAW_SOURCE");
      throw error;
    }
    return {
      rawId,
      parserStatus: payload ? "pending" : "ignored",
      retentionExpiresAtUtc: new Date(Date.now() + 90 * 86400000).toISOString(),
    };
  }

  async createCandidateFromNormalized(input: {
    rawSourceId: string;
    sourceId: string;
    sourceUrl: string;
    externalId: string | null;
    title: string;
    artistNames: string[];
    venueName: string | null;
    city: string | null;
    startsAtUtc: string;
    endsAtUtc: string | null;
    timezone: string;
    organizerName: string | null;
    officialUrl: string | null;
    ticketUrl: string | null;
    confidence: number;
    credibilityScore: number;
  }) {
    const id = crypto.randomUUID();
    const createdAtUtc = now();
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO event_candidates (id,raw_event_source_id,name,normalized_name,artist_raw_json,venue_raw_json,city,starts_at_utc,ends_at_utc,timezone,organizer_name,official_event_url,official_ticket_url,credibility_score,confidence,status,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          input.rawSourceId,
          input.title,
          normalize(input.title),
          JSON.stringify(input.artistNames),
          input.venueName ? JSON.stringify({ name: input.venueName }) : null,
          input.city,
          input.startsAtUtc,
          input.endsAtUtc,
          input.timezone,
          input.organizerName,
          input.officialUrl,
          input.ticketUrl,
          input.credibilityScore,
          input.confidence,
          "pending_review",
          createdAtUtc,
          createdAtUtc,
        ),
      this.db
        .prepare(
          "UPDATE raw_event_sources SET parser_status='parsed',parse_error=NULL WHERE id=?",
        )
        .bind(input.rawSourceId),
      this.db
        .prepare(
          "INSERT INTO event_source_links (id,event_id,candidate_id,data_source_id,external_id,source_url,credibility_score,is_primary,first_seen_at_utc,last_seen_at_utc,last_confirmed_at_utc,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          null,
          id,
          input.sourceId,
          input.externalId,
          input.sourceUrl,
          input.credibilityScore,
          1,
          createdAtUtc,
          createdAtUtc,
          null,
          createdAtUtc,
          createdAtUtc,
        ),
    ]);
    return { id, status: "pending_review" as const };
  }

  async getRawSource(rawSourceId: string) {
    return this.db
      .prepare(
        "SELECT r.id,r.data_source_id AS dataSourceId,r.external_id AS externalId,r.source_url AS sourceUrl,r.raw_payload AS rawPayload,d.credibility_base_score AS credibilityScore FROM raw_event_sources r JOIN data_sources d ON d.id=r.data_source_id WHERE r.id=?",
      )
      .bind(rawSourceId)
      .first<{
        id: string;
        dataSourceId: string;
        externalId: string | null;
        sourceUrl: string;
        rawPayload: string | null;
        credibilityScore: number;
      }>();
  }

  async markRawParseFailed(rawSourceId: string, message: string) {
    await this.db
      .prepare(
        "UPDATE raw_event_sources SET parser_status='parse_failed',parse_error=? WHERE id=?",
      )
      .bind(message.slice(0, 500), rawSourceId)
      .run();
  }

  async approveCandidate(input: CandidateApprovalInput) {
    const candidate = await this.db
      .prepare(
        "SELECT c.*,r.data_source_id AS dataSourceId,r.external_id AS externalId,r.source_url AS sourceUrl FROM event_candidates c LEFT JOIN raw_event_sources r ON r.id=c.raw_event_source_id WHERE c.id=? AND c.status='pending_review'",
      )
      .bind(input.candidateId)
      .first<Record<string, unknown>>();
    if (
      !candidate ||
      typeof candidate.starts_at_utc !== "string" ||
      !candidate.city ||
      !candidate.organizer_name
    )
      throw new Error("CANDIDATE_NOT_PUBLISHABLE");
    const eventId = crypto.randomUUID();
    const createdAtUtc = now();
    let artistNames: string[] = [];
    if (typeof candidate.artist_raw_json === "string") {
      try {
        const parsed: unknown = JSON.parse(candidate.artist_raw_json);
        artistNames = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === "string")
          : [];
      } catch {
        artistNames = [];
      }
    }
    const artists = await Promise.all(
      artistNames.map(async (name) =>
        this.db
          .prepare(
            `SELECT a.id
               FROM artists a
               LEFT JOIN artist_aliases aa ON aa.artist_id=a.id
              WHERE a.deleted_at_utc IS NULL
                AND (a.normalized_name=? OR aa.normalized_alias=?)
              LIMIT 1`,
          )
          .bind(normalize(name), normalize(name))
          .first<{ id: string }>(),
      ),
    );
    let venueId: string | null = null;
    if (typeof candidate.venue_raw_json === "string") {
      try {
        const venue = JSON.parse(candidate.venue_raw_json) as { name?: unknown };
        if (typeof venue.name === "string" && candidate.city) {
          const matchedVenue = await this.db
            .prepare(
              "SELECT id FROM venues WHERE normalized_name=? AND city=? AND deleted_at_utc IS NULL LIMIT 1",
            )
            .bind(normalize(venue.name), candidate.city)
            .first<{ id: string }>();
          venueId = matchedVenue?.id ?? null;
        }
      } catch {
        venueId = null;
      }
    }
    const link = await this.db
      .prepare("SELECT id FROM event_source_links WHERE candidate_id=? LIMIT 1")
      .bind(input.candidateId)
      .first<{ id: string }>();
    const statements: D1PreparedStatement[] = [
      this.db
        .prepare(
          "INSERT INTO events (id,name,normalized_name,starts_at_utc,ends_at_utc,venue_id,city,timezone,organizer_name,official_event_url,official_ticket_url,status,source_type,source_url,last_verified_at_utc,is_admin_verified,created_by_user_id,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          eventId,
          candidate.name,
          candidate.normalized_name,
          candidate.starts_at_utc,
          candidate.ends_at_utc,
          venueId,
          candidate.city,
          candidate.timezone,
          candidate.organizer_name,
          candidate.official_event_url,
          candidate.official_ticket_url,
          "announced",
          "external_sync",
          candidate.sourceUrl,
          createdAtUtc,
          1,
          input.adminUserId,
          createdAtUtc,
          createdAtUtc,
        ),
      this.db
        .prepare(
          "UPDATE event_candidates SET status='confirmed',matched_event_id=?,updated_at_utc=? WHERE id=?",
        )
        .bind(eventId, createdAtUtc, input.candidateId),
      this.db
        .prepare(
          "INSERT INTO verification_reviews (id,candidate_id,reviewer_type,reviewer_user_id,decision,reason,decided_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          input.candidateId,
          "admin",
          input.adminUserId,
          "approve",
          "Phase 0 manual approval",
          createdAtUtc,
          createdAtUtc,
        ),
      this.db
        .prepare(
          "INSERT INTO event_change_logs (id,event_id,candidate_id,data_source_id,field_name,old_value,new_value,change_source,significant,notified,detected_at_utc,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          eventId,
          input.candidateId,
          candidate.dataSourceId,
          "event.created",
          null,
          String(candidate.name),
          "admin",
          1,
          0,
          createdAtUtc,
          createdAtUtc,
        ),
      this.db
        .prepare(
          "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          input.adminUserId,
          "event_candidate.approve",
          "event",
          eventId,
          input.requestId,
          JSON.stringify({ candidateId: input.candidateId }),
          createdAtUtc,
        ),
    ];
    if (link)
      statements.push(
        this.db
          .prepare(
            "UPDATE event_source_links SET event_id=?,candidate_id=NULL,last_confirmed_at_utc=?,updated_at_utc=? WHERE id=?",
          )
          .bind(eventId, createdAtUtc, createdAtUtc, link.id),
      );
    artists.forEach((artist, index) => {
      if (artist)
        statements.push(
          this.db
            .prepare(
              "INSERT OR IGNORE INTO event_artists (event_id,artist_id,billing_order,is_headliner) VALUES (?,?,?,?)",
            )
            .bind(eventId, artist.id, index, index === 0 ? 1 : 0),
        );
    });
    await this.db.batch(statements);
    return { eventId, candidateId: input.candidateId };
  }
}
