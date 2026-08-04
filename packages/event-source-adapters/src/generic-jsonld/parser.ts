import {
  NormalizedEventCandidateSchema,
  type NormalizedEventCandidate,
} from "@ticket-radar/shared";

const EVENT_TYPES = new Set([
  "Event",
  "MusicEvent",
  "TheaterEvent",
  "Festival",
  "SportsEvent",
]);
export function extractJsonLdEvents(
  html: string,
  input: {
    sourceId: string;
    sourceUrl: string;
    rawSourceId: string;
    parserVersion?: string;
  },
): NormalizedEventCandidate[] {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const values: unknown[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1] ?? "null") as unknown;
      values.push(...flatten(parsed));
    } catch {
      /* invalid JSON-LD is ignored and remains reviewable */
    }
  }
  return values
    .flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const type = item["@type"];
      if (
        !(typeof type === "string"
          ? EVENT_TYPES.has(type)
          : Array.isArray(type) &&
            type.some((v) => typeof v === "string" && EVENT_TYPES.has(v)))
      )
        return [];
      return [toCandidate(item, input)];
    })
    .filter((candidate): candidate is NormalizedEventCandidate => candidate !== null);
}
function flatten(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flatten);
  if (value && typeof value === "object") {
    const graph = (value as Record<string, unknown>)["@graph"];
    if (Array.isArray(graph)) return graph.flatMap(flatten);
  }
  return [value];
}
function toCandidate(
  item: Record<string, unknown>,
  input: {
    sourceId: string;
    sourceUrl: string;
    rawSourceId: string;
    parserVersion?: string;
  },
): NormalizedEventCandidate | null {
  const title = typeof item.name === "string" ? item.name.trim() : "";
  const start = normalizeDate(item.startDate);
  if (!title) return null;
  const location =
    item.location && typeof item.location === "object"
      ? (item.location as Record<string, unknown>)
      : {};
  const address =
    location.address && typeof location.address === "object"
      ? (location.address as Record<string, unknown>)
      : {};
  const offers =
    item.offers && typeof item.offers === "object"
      ? (item.offers as Record<string, unknown>)
      : {};
  const artistNames = extractArtistNames(item.performer ?? item.byArtist);
  return NormalizedEventCandidateSchema.parse({
    externalId: typeof item.identifier === "string" ? item.identifier : null,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    artistNames,
    title,
    descriptionSummary:
      typeof item.description === "string" ? item.description.slice(0, 500) : null,
    venueName: typeof location.name === "string" ? location.name : null,
    city: typeof address.addressLocality === "string" ? address.addressLocality : null,
    country: typeof address.addressCountry === "string" ? address.addressCountry : null,
    startDateTime: start,
    endDateTime: normalizeDate(item.endDate),
    timezone: typeof item.timezone === "string" ? item.timezone : null,
    saleStartDateTime: null,
    saleEndDateTime: null,
    ticketPlatform: null,
    officialUrl: typeof item.url === "string" ? item.url : input.sourceUrl,
    ticketUrl: typeof offers.url === "string" ? offers.url : null,
    imageUrl: typeof item.image === "string" ? item.image : null,
    eventStatus: typeof item.eventStatus === "string" ? item.eventStatus : null,
    confidenceScore: start ? 0.75 : 0.4,
    verificationStatus: "ai_parsed",
    rawSourceId: input.rawSourceId,
    parserVersion: input.parserVersion ?? "jsonld-v1",
  });
}

function extractArtistNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return values.flatMap((entry) => {
    if (typeof entry === "string") return [entry.trim()].filter(Boolean);
    if (!entry || typeof entry !== "object") return [];
    const name = (entry as Record<string, unknown>).name;
    return typeof name === "string" ? [name.trim()].filter(Boolean) : [];
  });
}
function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
