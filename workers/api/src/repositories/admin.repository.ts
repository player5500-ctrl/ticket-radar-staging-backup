import type {
  AdminAdapterVersion,
  AdminAuditLog,
  AdminEvent,
  AdminOverview,
} from "@ticket-radar/shared";

export class D1AdminRepository {
  constructor(private readonly db: D1Database) {}

  async overview(): Promise<AdminOverview> {
    const [artists, events, unverifiedEvents, openReports, notificationFailures] =
      await Promise.all([
        this.count(
          "SELECT COUNT(*) AS count FROM artists WHERE deleted_at_utc IS NULL",
        ),
        this.count("SELECT COUNT(*) AS count FROM events WHERE deleted_at_utc IS NULL"),
        this.count(
          "SELECT COUNT(*) AS count FROM events WHERE is_admin_verified=0 AND deleted_at_utc IS NULL",
        ),
        this.count(
          "SELECT COUNT(*) AS count FROM user_reports WHERE status IN ('open','reviewing')",
        ),
        this.count(
          "SELECT COUNT(*) AS count FROM notification_logs WHERE status='failed'",
        ),
      ]);

    return {
      counts: {
        artists,
        events,
        unverifiedEvents,
        openReports,
        notificationFailures,
      },
      adapterVersions: await this.listAdapterVersions(),
      recentEvents: await this.listEvents(12),
      recentAuditLogs: await this.listAuditLogs(10),
    };
  }

  async recordOverviewAccess(actorUserId: string, requestId: string) {
    await this.db
      .prepare(
        "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,created_at_utc) VALUES (?,?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        actorUserId,
        "admin.overview.read",
        "admin_dashboard",
        null,
        requestId,
        new Date().toISOString(),
      )
      .run();
  }

  async setEventVerified(
    actorUserId: string,
    eventId: string,
    isVerified: boolean,
    requestId: string,
  ): Promise<AdminEvent | null> {
    const before = await this.findEvent(eventId);
    if (!before) return null;

    const now = new Date().toISOString();
    await this.db.batch([
      this.db
        .prepare(
          "UPDATE events SET is_admin_verified=?,last_verified_at_utc=?,updated_at_utc=? WHERE id=? AND deleted_at_utc IS NULL",
        )
        .bind(isVerified ? 1 : 0, isVerified ? now : null, now, eventId),
      this.db
        .prepare(
          "INSERT INTO audit_logs (id,actor_user_id,action,entity_type,entity_id,request_id,before_summary_json,after_summary_json,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          crypto.randomUUID(),
          actorUserId,
          "event.verification.update",
          "event",
          eventId,
          requestId,
          JSON.stringify({ isAdminVerified: before.isAdminVerified }),
          JSON.stringify({ isAdminVerified: isVerified }),
          now,
        ),
    ]);
    return this.findEvent(eventId);
  }

  private async count(sql: string) {
    return (await this.db.prepare(sql).first<{ count: number }>())?.count ?? 0;
  }

  private async listAuditLogs(limit: number): Promise<AdminAuditLog[]> {
    const result = await this.db
      .prepare(
        "SELECT id,action,entity_type AS entityType,entity_id AS entityId,actor_user_id AS actorUserId,request_id AS requestId,created_at_utc AS createdAtUtc FROM audit_logs ORDER BY created_at_utc DESC LIMIT ?",
      )
      .bind(limit)
      .all<AdminAuditLog>();
    return result.results;
  }

  private async listAdapterVersions(): Promise<AdminAdapterVersion[]> {
    const result = await this.db
      .prepare(
        `SELECT pav.id,pav.adapter_id AS adapterId,
                COALESCE(tp.name,pav.adapter_id) AS platformName,
                pav.version,pav.status,
                pav.last_updated_at_utc AS lastUpdatedAtUtc,
                pav.last_verified_at_utc AS lastVerifiedAtUtc,
                pav.notes
         FROM platform_adapter_versions pav
         LEFT JOIN ticket_platforms tp ON tp.id=pav.ticket_platform_id
         ORDER BY CASE pav.status
                    WHEN 'active' THEN 0
                    WHEN 'testing' THEN 1
                    WHEN 'disabled' THEN 2
                    ELSE 3
                  END,
                  pav.adapter_id`,
      )
      .all<AdminAdapterVersion>();
    return result.results;
  }

  private async listEvents(limit: number): Promise<AdminEvent[]> {
    const result = await this.db
      .prepare(
        "SELECT id,name,starts_at_utc AS startsAtUtc,is_admin_verified AS isAdminVerified,last_verified_at_utc AS lastVerifiedAtUtc FROM events WHERE deleted_at_utc IS NULL ORDER BY updated_at_utc DESC LIMIT ?",
      )
      .bind(limit)
      .all<Omit<AdminEvent, "isAdminVerified"> & { isAdminVerified: number }>();
    return result.results.map((event) => ({
      ...event,
      isAdminVerified: Boolean(event.isAdminVerified),
    }));
  }

  private async findEvent(id: string): Promise<AdminEvent | null> {
    const event = await this.db
      .prepare(
        "SELECT id,name,starts_at_utc AS startsAtUtc,is_admin_verified AS isAdminVerified,last_verified_at_utc AS lastVerifiedAtUtc FROM events WHERE id=? AND deleted_at_utc IS NULL",
      )
      .bind(id)
      .first<Omit<AdminEvent, "isAdminVerified"> & { isAdminVerified: number }>();
    return event ? { ...event, isAdminVerified: Boolean(event.isAdminVerified) } : null;
  }
}
