import type { NormalizedEventCandidate } from "@ticket-radar/shared";

export type AliasMatch = {
  canonicalId: string | null;
  confidence: number;
  needsReview: boolean;
  normalized: string;
};
export class ArtistAliasResolver {
  constructor(private readonly aliases: Map<string, string> = new Map()) {}
  resolve(name: string): AliasMatch {
    const normalized = normalizeLabel(name);
    const canonicalId = this.aliases.get(normalized) ?? null;
    return {
      canonicalId,
      confidence: canonicalId ? 1 : 0,
      needsReview: !canonicalId,
      normalized,
    };
  }
}
export class VenueResolver {
  constructor(
    private readonly aliases: Map<string, { id: string; city?: string }> = new Map(),
  ) {}
  resolve(name: string, city?: string): AliasMatch {
    const normalized = normalizeLabel(name);
    const match = this.aliases.get(normalized);
    const cityMatches = Boolean(
      match &&
      (!city || !match.city || normalizeLabel(match.city) === normalizeLabel(city)),
    );
    return {
      canonicalId: cityMatches ? match!.id : null,
      confidence: cityMatches ? 1 : 0,
      needsReview: !cityMatches,
      normalized,
    };
  }
}
export function normalizeLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
export function eventFingerprint(
  candidate: Pick<
    NormalizedEventCandidate,
    | "externalId"
    | "officialUrl"
    | "artistNames"
    | "startDateTime"
    | "venueName"
    | "title"
  >,
): string {
  const stable = candidate.externalId
    ? `external:${candidate.externalId}`
    : candidate.officialUrl
      ? `url:${candidate.officialUrl}`
      : [
          candidate.artistNames.map(normalizeLabel).sort().join(","),
          candidate.startDateTime ?? "",
          normalizeLabel(candidate.venueName ?? ""),
          normalizeLabel(candidate.title),
        ].join("|");
  let hash = 2166136261;
  for (const char of stable) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${(hash >>> 0).toString(16).padStart(8, "0")}${normalizeLabel(stable)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 56)
    .padEnd(56, "0")}`;
}
export type DuplicateMatch =
  "exact_match" | "probable_match" | "possible_match" | "no_match";
export function classifyDuplicate(
  a: NormalizedEventCandidate,
  b: NormalizedEventCandidate,
): DuplicateMatch {
  if (a.externalId && b.externalId && a.externalId === b.externalId)
    return "exact_match";
  if (a.officialUrl && b.officialUrl && a.officialUrl === b.officialUrl)
    return "exact_match";
  const sameArtist = a.artistNames.some((x) =>
    b.artistNames.map(normalizeLabel).includes(normalizeLabel(x)),
  );
  const sameDate = Boolean(
    a.startDateTime &&
    b.startDateTime &&
    a.startDateTime.slice(0, 10) === b.startDateTime.slice(0, 10),
  );
  const sameVenue = Boolean(
    a.venueName &&
    b.venueName &&
    normalizeLabel(a.venueName) === normalizeLabel(b.venueName),
  );
  if (sameArtist && sameDate && sameVenue) return "probable_match";
  if (sameArtist && sameDate) return "possible_match";
  return "no_match";
}
