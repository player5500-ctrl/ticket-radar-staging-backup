export const EVENT_STATUSES = [
  "announced",
  "registration",
  "presale",
  "on_sale",
  "sold_out",
  "postponed",
  "cancelled",
  "completed",
  "unconfirmed",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const SALE_TYPES = [
  "fan_registration_deadline",
  "member_presale",
  "card_presale",
  "organizer_presale",
  "lottery_registration_start",
  "lottery_registration_end",
  "lottery_result",
  "general_sale",
  "payment_deadline",
  "pickup_start",
  "event_reminder",
] as const;

export type SaleType = (typeof SALE_TYPES)[number];

export type ArtistSummary = {
  id: string;
  name: string;
  artistType: "solo" | "group" | "other";
  aliases: string[];
  imageUrl: string | null;
  isFollowed: boolean;
};

export type VenueSummary = {
  id: string;
  name: string;
  city: string;
  timezone: string;
};

export type TicketPlatformSummary = {
  id: string;
  name: string;
  slug: string;
};

export type EventSummary = {
  id: string;
  name: string;
  startsAtUtc: string;
  endsAtUtc: string | null;
  city: string;
  timezone: string;
  status: EventStatus;
  imageUrl: string | null;
  venue: VenueSummary | null;
  platform: TicketPlatformSummary | null;
  artists: Pick<ArtistSummary, "id" | "name">[];
  isAdminVerified: boolean;
  lastVerifiedAtUtc: string | null;
  createdAtUtc: string;
};

export type TicketSaleWindow = {
  id: string;
  eventId: string;
  saleType: SaleType;
  title: string;
  startsAtUtc: string;
  endsAtUtc: string | null;
  eligibilityNote: string | null;
  officialUrl: string | null;
  status: "scheduled" | "open" | "closed" | "cancelled";
};

export type EventDetail = EventSummary & {
  organizerName: string;
  officialEventUrl: string | null;
  officialTicketUrl: string | null;
  sourceType: "admin_manual" | "user_manual" | "official_url" | "mock_parser";
  sourceUrl: string | null;
  saleWindows: TicketSaleWindow[];
  isFavorited: boolean;
};

export type SearchResponse = {
  query: string;
  artists: ArtistSummary[];
  events: EventSummary[];
  venues: VenueSummary[];
  platforms: TicketPlatformSummary[];
};

export type HomeResponse = {
  upcomingEvents: EventSummary[];
  recentEvents: EventSummary[];
  followedArtists: ArtistSummary[];
};

export type ApiSuccess<T> = {
  data: T;
  requestId: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};
