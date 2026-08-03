import type { PurchaseRecord, PurchaseRecordInput } from "@ticket-radar/shared";
export class D1PurchaseRepository {
  constructor(private readonly db: D1Database) {}

  private async findById(id: string, userId: string): Promise<PurchaseRecord | null> {
    return this.db
      .prepare(
        "SELECT p.id,p.event_id AS eventId,p.order_reference_masked AS orderReferenceMasked,p.ticket_count AS ticketCount,p.session_label AS sessionLabel,p.seat_or_area_masked AS seatOrAreaMasked,p.screenshot_filename AS screenshotFilename,p.notes,p.source,e.name AS eventName,p.order_created_at_utc AS orderCreatedAtUtc,p.order_status AS orderStatus,p.pickup_status AS pickupStatus FROM purchase_records p JOIN events e ON e.id=p.event_id WHERE p.id=? AND p.user_id=? AND p.deleted_at_utc IS NULL",
      )
      .bind(id, userId)
      .first<PurchaseRecord>();
  }

  async list(userId: string): Promise<PurchaseRecord[]> {
    const result = await this.db
      .prepare(
        "SELECT p.id,p.event_id AS eventId,p.order_reference_masked AS orderReferenceMasked,p.ticket_count AS ticketCount,p.session_label AS sessionLabel,p.seat_or_area_masked AS seatOrAreaMasked,p.screenshot_filename AS screenshotFilename,p.notes,p.source,e.name AS eventName,p.order_created_at_utc AS orderCreatedAtUtc,p.order_status AS orderStatus,p.pickup_status AS pickupStatus FROM purchase_records p JOIN events e ON e.id=p.event_id WHERE p.user_id=? AND p.deleted_at_utc IS NULL ORDER BY p.created_at_utc DESC",
      )
      .bind(userId)
      .all<PurchaseRecord>();
    return result.results;
  }
  async create(
    userId: string,
    input: PurchaseRecordInput,
  ): Promise<PurchaseRecord | null> {
    const event = await this.db
      .prepare(
        "SELECT id,ticket_platform_id FROM events WHERE id=? AND deleted_at_utc IS NULL",
      )
      .bind(input.eventId)
      .first<{ id: string; ticket_platform_id: string | null }>();
    if (!event) return null;
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const dedupe = await crypto.subtle
      .digest(
        "SHA-256",
        new TextEncoder().encode(`${input.eventId}:${input.orderReferenceMasked}`),
      )
      .then((x) =>
        Array.from(new Uint8Array(x))
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
      );
    const existing = await this.db
      .prepare(
        "SELECT id FROM purchase_records WHERE user_id=? AND event_id=? AND order_dedupe_hash=? AND deleted_at_utc IS NULL LIMIT 1",
      )
      .bind(userId, input.eventId, dedupe)
      .first<{ id: string }>();
    if (existing) return this.findById(existing.id, userId);

    await this.db
      .prepare(
        "INSERT INTO purchase_records (id,user_id,event_id,ticket_platform_id,order_reference_masked,order_dedupe_hash,session_label,seat_or_area_masked,ticket_count,order_created_at_utc,order_status,pickup_status,screenshot_filename,notes,source,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,? ,?,'created','unconfirmed',?,?,?,?,?)",
      )
      .bind(
        id,
        userId,
        input.eventId,
        event.ticket_platform_id,
        input.orderReferenceMasked,
        dedupe,
        input.sessionLabel ?? null,
        input.seatOrAreaMasked ?? null,
        input.ticketCount,
        now,
        input.screenshotFilename ?? null,
        input.notes,
        input.source,
        now,
        now,
      )
      .run();
    return this.findById(id, userId);
  }
}
