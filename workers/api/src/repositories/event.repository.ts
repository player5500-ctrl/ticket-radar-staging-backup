import type {
  ArtistSummary,
  EventDetail,
  EventSummary,
  HomeResponse,
  SearchQuery,
  SearchResponse,
  TicketPlatformSummary,
  TicketSaleWindow,
  VenueSummary,
} from "@ticket-radar/shared";
import { escapeLikePattern, normalizeSearchTerm } from "@ticket-radar/shared";

type ArtistRow = {
  id: string;
  name: string;
  artist_type: ArtistSummary["artistType"];
  image_url: string | null;
  aliases_json: string;
  is_followed: number;
};

type VenueRow = {
  id: string;
  name: string;
  city: string;
  timezone: string;
};

type PlatformRow = {
  id: string;
  name: string;
  slug: string;
};

type EventRow = {
  id: string;
  name: string;
  starts_at_utc: string;
  ends_at_utc: string | null;
  city: string;
  timezone: string;
  status: EventSummary["status"];
  image_url: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_timezone: string | null;
  platform_id: string | null;
  platform_name: string | null;
  platform_slug: string | null;
  artists_json: string;
  is_admin_verified: number;
  last_verified_at_utc: string | null;
  created_at_utc: string;
  organizer_name?: string;
  official_event_url?: string | null;
  official_ticket_url?: string | null;
  source_type?: EventDetail["sourceType"];
  source_url?: string | null;
  is_favorited: number;
};

type SaleWindowRow = {
  id: string;
  event_id: string;
  sale_type: TicketSaleWindow["saleType"];
  title: string;
  starts_at_utc: string;
  ends_at_utc: string | null;
  eligibility_note: string | null;
  official_url: string | null;
  status: TicketSaleWindow["status"];
};

export interface EventRepository {
  search(query: SearchQuery, userId: string | null): Promise<SearchResponse>;
  getHome(userId: string | null, nowUtc: string): Promise<HomeResponse>;
  findById(id: string, userId: string | null): Promise<EventDetail | null>;
  favorite(eventId: string, userId: string): Promise<boolean>;
  unfavorite(eventId: string, userId: string): Promise<boolean>;
  followArtist(artistId: string, userId: string): Promise<boolean>;
  unfollowArtist(artistId: string, userId: string): Promise<boolean>;
}

const eventSelect = `
  SELECT
    e.id,
    e.name,
    e.starts_at_utc,
    e.ends_at_utc,
    e.city,
    e.timezone,
    e.status,
    e.image_url,
    e.is_admin_verified,
    e.last_verified_at_utc,
    e.created_at_utc,
    e.organizer_name,
    e.official_event_url,
    e.official_ticket_url,
    e.source_type,
    e.source_url,
    v.id AS venue_id,
    v.name AS venue_name,
    v.city AS venue_city,
    v.timezone AS venue_timezone,
    tp.id AS platform_id,
    tp.name AS platform_name,
    tp.slug AS platform_slug,
    COALESCE((
      SELECT json_group_array(json_object('id', artist.id, 'name', artist.name))
      FROM event_artists link
      JOIN artists artist ON artist.id = link.artist_id
      WHERE link.event_id = e.id
      ORDER BY link.billing_order
    ), '[]') AS artists_json,
    EXISTS(
      SELECT 1
      FROM user_event_favorites favorite
      WHERE favorite.event_id = e.id AND favorite.user_id = ?
    ) AS is_favorited
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN ticket_platforms tp ON tp.id = e.ticket_platform_id
`;

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapArtist(row: ArtistRow): ArtistSummary {
  return {
    id: row.id,
    name: row.name,
    artistType: row.artist_type,
    aliases: parseJsonArray<string>(row.aliases_json),
    imageUrl: row.image_url,
    isFollowed: Boolean(row.is_followed),
  };
}

function mapVenue(row: VenueRow): VenueSummary {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    timezone: row.timezone,
  };
}

function mapPlatform(row: PlatformRow): TicketPlatformSummary {
  return { id: row.id, name: row.name, slug: row.slug };
}

function mapEvent(row: EventRow): EventSummary {
  return {
    id: row.id,
    name: row.name,
    startsAtUtc: row.starts_at_utc,
    endsAtUtc: row.ends_at_utc,
    city: row.city,
    timezone: row.timezone,
    status: row.status,
    imageUrl: row.image_url,
    venue:
      row.venue_id && row.venue_name && row.venue_city && row.venue_timezone
        ? {
            id: row.venue_id,
            name: row.venue_name,
            city: row.venue_city,
            timezone: row.venue_timezone,
          }
        : null,
    platform:
      row.platform_id && row.platform_name && row.platform_slug
        ? {
            id: row.platform_id,
            name: row.platform_name,
            slug: row.platform_slug,
          }
        : null,
    artists: parseJsonArray<Pick<ArtistSummary, "id" | "name">>(row.artists_json),
    isAdminVerified: Boolean(row.is_admin_verified),
    lastVerifiedAtUtc: row.last_verified_at_utc,
    createdAtUtc: row.created_at_utc,
  };
}

function mapSaleWindow(row: SaleWindowRow): TicketSaleWindow {
  return {
    id: row.id,
    eventId: row.event_id,
    saleType: row.sale_type,
    title: row.title,
    startsAtUtc: row.starts_at_utc,
    endsAtUtc: row.ends_at_utc,
    eligibilityNote: row.eligibility_note,
    officialUrl: row.official_url,
    status: row.status,
  };
}

export class D1EventRepository implements EventRepository {
  constructor(private readonly db: D1Database) {}

  async search(query: SearchQuery, userId: string | null): Promise<SearchResponse> {
    const normalized = normalizeSearchTerm(query.q);
    const like = `%${escapeLikePattern(normalized)}%`;
    const actor = userId ?? "";

    const artistStatement = this.db
      .prepare(
        `
        SELECT
          a.id,
          a.name,
          a.artist_type,
          a.image_url,
          COALESCE((
            SELECT json_group_array(alias)
            FROM artist_aliases
            WHERE artist_id = a.id
          ), '[]') AS aliases_json,
          EXISTS(
            SELECT 1 FROM user_artist_follows follow
            WHERE follow.artist_id = a.id AND follow.user_id = ?
          ) AS is_followed
        FROM artists a
        WHERE a.deleted_at_utc IS NULL
          AND (
            ? = ''
            OR a.normalized_name LIKE ? ESCAPE '\\'
            OR EXISTS(
              SELECT 1 FROM artist_aliases alias
              WHERE alias.artist_id = a.id
                AND alias.normalized_alias LIKE ? ESCAPE '\\'
            )
          )
        ORDER BY a.name
        LIMIT 20
      `,
      )
      .bind(actor, normalized, like, like);

    const eventConditions = ["e.deleted_at_utc IS NULL"];
    const eventBindings: unknown[] = [actor];

    if (normalized) {
      eventConditions.push(`(
        e.normalized_name LIKE ? ESCAPE '\\'
        OR lower(e.city) LIKE ? ESCAPE '\\'
        OR lower(COALESCE(v.name, '')) LIKE ? ESCAPE '\\'
        OR EXISTS(
          SELECT 1
          FROM event_artists event_link
          JOIN artists event_artist ON event_artist.id = event_link.artist_id
          LEFT JOIN artist_aliases event_alias
            ON event_alias.artist_id = event_artist.id
          WHERE event_link.event_id = e.id
            AND (
              event_artist.normalized_name LIKE ? ESCAPE '\\'
              OR event_alias.normalized_alias LIKE ? ESCAPE '\\'
            )
        )
      )`);
      eventBindings.push(like, like, like, like, like);
    }
    if (query.city) {
      eventConditions.push("e.city = ?");
      eventBindings.push(query.city);
    }
    if (query.platform) {
      eventConditions.push("tp.slug = ?");
      eventBindings.push(query.platform);
    }
    if (query.status) {
      eventConditions.push("e.status = ?");
      eventBindings.push(query.status);
    }
    if (query.dateFrom) {
      eventConditions.push("e.starts_at_utc >= ?");
      eventBindings.push(`${query.dateFrom}T00:00:00.000Z`);
    }
    if (query.dateTo) {
      eventConditions.push("e.starts_at_utc <= ?");
      eventBindings.push(`${query.dateTo}T23:59:59.999Z`);
    }

    const eventStatement = this.db
      .prepare(
        `${eventSelect}
         WHERE ${eventConditions.join(" AND ")}
         ORDER BY e.starts_at_utc
         LIMIT 30`,
      )
      .bind(...eventBindings);

    const venueStatement = this.db
      .prepare(
        `
        SELECT id, name, city, timezone
        FROM venues
        WHERE deleted_at_utc IS NULL
          AND (? = '' OR normalized_name LIKE ? ESCAPE '\\' OR lower(city) LIKE ? ESCAPE '\\')
        ORDER BY city, name
        LIMIT 20
      `,
      )
      .bind(normalized, like, like);

    const platformStatement = this.db.prepare(`
      SELECT id, name, slug
      FROM ticket_platforms
      WHERE status = 'active'
      ORDER BY name
    `);

    const [artistResult, eventResult, venueResult, platformResult] =
      await this.db.batch([
        artistStatement,
        eventStatement,
        venueStatement,
        platformStatement,
      ]);

    if (!artistResult || !eventResult || !venueResult || !platformResult) {
      throw new Error("D1 搜尋批次回應不完整。");
    }

    return {
      query: query.q,
      artists: (artistResult.results as ArtistRow[]).map(mapArtist),
      events: (eventResult.results as EventRow[]).map(mapEvent),
      venues: (venueResult.results as VenueRow[]).map(mapVenue),
      platforms: (platformResult.results as PlatformRow[]).map(mapPlatform),
    };
  }

  async getHome(userId: string | null, nowUtc: string): Promise<HomeResponse> {
    const actor = userId ?? "";
    const upcomingStatement = this.db
      .prepare(
        `${eventSelect}
         WHERE e.deleted_at_utc IS NULL
           AND e.starts_at_utc >= ?
           AND e.status NOT IN ('cancelled', 'completed')
         ORDER BY e.starts_at_utc
         LIMIT 6`,
      )
      .bind(actor, nowUtc);
    const recentStatement = this.db
      .prepare(
        `${eventSelect}
         WHERE e.deleted_at_utc IS NULL
         ORDER BY e.created_at_utc DESC
         LIMIT 6`,
      )
      .bind(actor);
    const followedStatement = this.db
      .prepare(
        `
        SELECT
          a.id,
          a.name,
          a.artist_type,
          a.image_url,
          COALESCE((
            SELECT json_group_array(alias)
            FROM artist_aliases
            WHERE artist_id = a.id
          ), '[]') AS aliases_json,
          1 AS is_followed
        FROM artists a
        JOIN user_artist_follows follow ON follow.artist_id = a.id
        WHERE follow.user_id = ? AND a.deleted_at_utc IS NULL
        ORDER BY follow.created_at_utc DESC
        LIMIT 8
      `,
      )
      .bind(actor);

    const [upcomingResult, recentResult, followedResult] = await this.db.batch([
      upcomingStatement,
      recentStatement,
      followedStatement,
    ]);

    if (!upcomingResult || !recentResult || !followedResult) {
      throw new Error("D1 首頁批次回應不完整。");
    }

    return {
      upcomingEvents: (upcomingResult.results as EventRow[]).map(mapEvent),
      recentEvents: (recentResult.results as EventRow[]).map(mapEvent),
      followedArtists: (followedResult.results as ArtistRow[]).map(mapArtist),
    };
  }

  async findById(id: string, userId: string | null): Promise<EventDetail | null> {
    const actor = userId ?? "";
    const eventRow = await this.db
      .prepare(
        `${eventSelect}
         WHERE e.id = ? AND e.deleted_at_utc IS NULL
         LIMIT 1`,
      )
      .bind(actor, id)
      .first<EventRow>();

    if (!eventRow) {
      return null;
    }

    const saleWindows = await this.db
      .prepare(
        `
        SELECT
          id,
          event_id,
          sale_type,
          title,
          starts_at_utc,
          ends_at_utc,
          eligibility_note,
          official_url,
          status
        FROM ticket_sale_windows
        WHERE event_id = ?
        ORDER BY starts_at_utc
      `,
      )
      .bind(id)
      .all<SaleWindowRow>();

    const summary = mapEvent(eventRow);
    return {
      ...summary,
      organizerName: eventRow.organizer_name ?? "",
      officialEventUrl: eventRow.official_event_url ?? null,
      officialTicketUrl: eventRow.official_ticket_url ?? null,
      sourceType: eventRow.source_type ?? "user_manual",
      sourceUrl: eventRow.source_url ?? null,
      saleWindows: saleWindows.results.map(mapSaleWindow),
      isFavorited: Boolean(eventRow.is_favorited),
    };
  }

  async favorite(eventId: string, userId: string): Promise<boolean> {
    const event = await this.db
      .prepare("SELECT id FROM events WHERE id = ? AND deleted_at_utc IS NULL")
      .bind(eventId)
      .first<{ id: string }>();
    if (!event) return false;

    await this.db
      .prepare(
        `INSERT OR IGNORE INTO user_event_favorites
          (user_id, event_id, created_at_utc)
         VALUES (?, ?, ?)`,
      )
      .bind(userId, eventId, new Date().toISOString())
      .run();
    return true;
  }

  async unfavorite(eventId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM user_event_favorites WHERE user_id = ? AND event_id = ?")
      .bind(userId, eventId)
      .run();
    return result.success;
  }

  async followArtist(artistId: string, userId: string): Promise<boolean> {
    const artist = await this.db
      .prepare("SELECT id FROM artists WHERE id = ? AND deleted_at_utc IS NULL")
      .bind(artistId)
      .first<{ id: string }>();
    if (!artist) return false;

    await this.db
      .prepare(
        `INSERT OR IGNORE INTO user_artist_follows
          (user_id, artist_id, created_at_utc)
         VALUES (?, ?, ?)`,
      )
      .bind(userId, artistId, new Date().toISOString())
      .run();
    return true;
  }

  async unfollowArtist(artistId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM user_artist_follows WHERE user_id = ? AND artist_id = ?")
      .bind(userId, artistId)
      .run();
    return result.success;
  }
}
