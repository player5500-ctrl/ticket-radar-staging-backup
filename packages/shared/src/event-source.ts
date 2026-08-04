import { z } from "zod";

export const SOURCE_CATEGORIES = [
  "ticketing_platform",
  "venue",
  "organizer",
  "artist_site",
  "international_api",
  "general_search",
  "user_submitted",
] as const;
export const SYNC_METHODS = [
  "json_api",
  "atom_feed",
  "json_ld_scrape",
  "html_scrape_limited",
  "partner_feed",
  "manual_entry",
] as const;
export const DATA_SOURCE_STATUSES = [
  "active",
  "paused",
  "disabled",
  "pending_agreement",
] as const;
export const AGREEMENT_STATUSES = [
  "not_required",
  "not_contacted",
  "contacted",
  "in_discussion",
  "agreed",
  "declined",
] as const;
export const SOURCE_SYNC_JOB_TYPES = [
  "scheduled",
  "manual",
  "backfill",
  "search_fallback",
] as const;
export const SOURCE_SYNC_JOB_STATUSES = [
  "queued",
  "running",
  "success",
  "partial_success",
  "failed",
  "circuit_open",
] as const;
export const SOURCE_SYNC_TRIGGERS = ["cron", "queue", "search_miss", "admin"] as const;
export const RAW_PARSER_STATUSES = [
  "pending",
  "parsed",
  "parse_failed",
  "ignored",
] as const;
export const CANDIDATE_STATUSES = [
  "pending_review",
  "auto_verified",
  "confirmed",
  "rejected",
  "duplicate",
  "expired",
] as const;
export const CHANGE_SOURCES = ["sync", "admin", "user_report"] as const;
export const VERIFICATION_STATUSES = [
  "unverified",
  "parsing_failed",
  "ai_parsed",
  "source_verified",
  "admin_verified",
  "rejected",
  "duplicate_pending",
  "published",
] as const;
export const DUPLICATE_RESULTS = [
  "exact_match",
  "probable_match",
  "possible_match",
  "no_match",
] as const;

const utc = z.string().datetime({ offset: true });
const nullableUtc = utc.nullable();

export const DataSourceSchema = z.object({
  id: z.string(),
  key: z.string().min(1),
  name: z.string().min(1),
  sourceCategory: z.enum(SOURCE_CATEGORIES),
  baseUrl: z.string().url().nullable(),
  syncMethod: z.enum(SYNC_METHODS),
  status: z.enum(DATA_SOURCE_STATUSES),
  agreementStatus: z.enum(AGREEMENT_STATUSES),
  requiresAgreement: z.boolean(),
  termsUrl: z.string().url().nullable(),
  termsSummary: z.string().nullable(),
  contactEmail: z.string().email().nullable(),
  rateLimitPerHour: z.number().int().positive().nullable(),
  syncFrequencyMinutes: z.number().int().positive().nullable(),
  credibilityBaseScore: z.number().int().min(0).max(100),
  enabled: z.boolean().default(false),
  trustLevel: z.enum(["low", "medium", "high", "unverified"]).default("unverified"),
  termsStatus: z
    .enum(["unknown", "review_required", "allowed", "prohibited"])
    .default("unknown"),
  robotsStatus: z
    .enum(["unknown", "review_required", "allowed", "prohibited"])
    .default("unknown"),
  timeoutMs: z.number().int().positive().default(5000),
  retryLimit: z.number().int().nonnegative().default(1),
  adapterVersion: z.string().default("phase0-placeholder"),
  lastSyncAtUtc: nullableUtc,
  lastSuccessAtUtc: nullableUtc,
  lastError: z.string().nullable(),
  notes: z.string().nullable(),
  createdAtUtc: utc,
  updatedAtUtc: utc,
});

export const SourceSyncJobSchema = z.object({
  id: z.string(),
  dataSourceId: z.string(),
  jobType: z.enum(SOURCE_SYNC_JOB_TYPES),
  status: z.enum(SOURCE_SYNC_JOB_STATUSES),
  triggerSource: z.enum(SOURCE_SYNC_TRIGGERS),
  requestParams: z.record(z.unknown()).nullable(),
  startedAtUtc: nullableUtc,
  finishedAtUtc: nullableUtc,
  itemsFetched: z.number().int().nonnegative(),
  itemsNew: z.number().int().nonnegative(),
  itemsUpdated: z.number().int().nonnegative(),
  itemsFailed: z.number().int().nonnegative(),
  errorSummary: z.string().nullable(),
  createdAtUtc: utc,
});

export const RawEventSourceSchema = z.object({
  id: z.string(),
  dataSourceId: z.string(),
  sourceSyncJobId: z.string().nullable(),
  externalId: z.string().nullable(),
  sourceUrl: z.string().url(),
  contentHash: z.string().nullable(),
  rawPayload: z.string().nullable(),
  rawPayloadR2Key: z.string().nullable(),
  fetchedAtUtc: utc,
  parserStatus: z.enum(RAW_PARSER_STATUSES),
  parseError: z.string().nullable(),
  retentionExpiresAtUtc: utc,
  createdAtUtc: utc,
});

export const EventCandidateSchema = z.object({
  id: z.string(),
  rawEventSourceId: z.string().nullable(),
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  artistRaw: z.record(z.unknown()).nullable(),
  venueRaw: z.record(z.unknown()).nullable(),
  venueId: z.string().nullable(),
  city: z.string().nullable(),
  startsAtUtc: utc,
  endsAtUtc: nullableUtc,
  timezone: z.string(),
  organizerName: z.string().nullable(),
  ticketPlatformName: z.string().nullable(),
  officialEventUrl: z.string().url().nullable(),
  officialTicketUrl: z.string().url().nullable(),
  priceLowMinor: z.number().int().nonnegative().nullable(),
  priceHighMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
  credibilityScore: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  status: z.enum(CANDIDATE_STATUSES),
  matchedEventId: z.string().nullable(),
  createdAtUtc: utc,
  updatedAtUtc: utc,
});

export const EventSourceLinkSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  candidateId: z.string().nullable(),
  dataSourceId: z.string(),
  externalId: z.string().nullable(),
  sourceUrl: z.string().url(),
  credibilityScore: z.number().int().min(0).max(100),
  isPrimary: z.boolean(),
  firstSeenAtUtc: utc,
  lastSeenAtUtc: utc,
  lastConfirmedAtUtc: nullableUtc,
  createdAtUtc: utc,
  updatedAtUtc: utc,
});
export const EventDuplicateSchema = z.object({
  id: z.string(),
  candidateAId: z.string(),
  candidateBId: z.string().nullable(),
  existingEventId: z.string().nullable(),
  similarityScore: z.number().min(0).max(1),
  matchMethod: z.enum([
    "exact_key",
    "fuzzy_name_date_venue",
    "artist_date_overlap",
    "admin_manual",
  ]),
  status: z.enum([
    "pending",
    "confirmed_duplicate",
    "confirmed_distinct",
    "auto_merged",
  ]),
  resolvedBy: z.enum(["auto", "admin"]).nullable(),
  resolvedAtUtc: nullableUtc,
  createdAtUtc: utc,
});
export const VerificationReviewSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  reviewerType: z.enum(["auto_rule", "admin"]),
  reviewerUserId: z.string().nullable(),
  decision: z.enum(["approve", "reject", "needs_more_info", "escalate"]),
  reason: z.string().nullable(),
  checklist: z.record(z.unknown()).nullable(),
  decidedAtUtc: nullableUtc,
  createdAtUtc: utc,
});
export const ArtistExternalIdSchema = z.object({
  id: z.string(),
  artistId: z.string(),
  dataSourceId: z.string(),
  externalId: z.string(),
  externalName: z.string().nullable(),
  externalUrl: z.string().url().nullable(),
  confidence: z.number().min(0).max(1),
  verifiedBy: z.enum(["auto", "admin"]).nullable(),
  createdAtUtc: utc,
  updatedAtUtc: utc,
});
export const VenueAliasSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  alias: z.string().min(1),
  normalizedAlias: z.string().min(1),
  dataSourceId: z.string().nullable(),
  language: z.string().nullable(),
  createdAtUtc: utc,
});
export const EventChangeLogSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  candidateId: z.string().nullable(),
  dataSourceId: z.string().nullable(),
  fieldName: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  changeSource: z.enum(CHANGE_SOURCES),
  significant: z.boolean(),
  notified: z.boolean(),
  detectedAtUtc: utc,
  createdAtUtc: utc,
});

export const RawSourceRecordSchema = z.object({
  externalId: z.string().nullable(),
  sourceUrl: z.string().url(),
  payload: z.string(),
  fetchedAtUtc: utc,
});
export const RawFetchResultSchema = z.object({
  records: z.array(RawSourceRecordSchema),
  fetchedAtUtc: utc,
  nextCursor: z.string().nullable().optional(),
});
export type DataSource = z.infer<typeof DataSourceSchema>;
export type RawEventSource = z.infer<typeof RawEventSourceSchema>;
export type RawFetchResult = z.infer<typeof RawFetchResultSchema>;

export const NormalizedEventCandidateSchema = z.object({
  externalId: z.string().nullable(),
  sourceId: z.string(),
  sourceUrl: z.string().url(),
  artistNames: z.array(z.string()),
  title: z.string().min(1),
  descriptionSummary: z.string().nullable(),
  venueName: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string().nullable(),
  startDateTime: utc.nullable(),
  endDateTime: utc.nullable(),
  timezone: z.string().nullable(),
  saleStartDateTime: utc.nullable(),
  saleEndDateTime: utc.nullable(),
  ticketPlatform: z.string().nullable(),
  officialUrl: z.string().url().nullable(),
  ticketUrl: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  eventStatus: z.string().nullable(),
  confidenceScore: z.number().min(0).max(1),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  rawSourceId: z.string(),
  parserVersion: z.string(),
});
export type NormalizedEventCandidate = z.infer<typeof NormalizedEventCandidateSchema>;
export type SourceFetchInput = { since?: string; query?: string; limit: number };
export type SourceHealthResult = {
  ok: boolean;
  checkedAtUtc: string;
  error: string | null;
};
export type SourceFetchResult = RawFetchResult & { nextCursor: string | null };
