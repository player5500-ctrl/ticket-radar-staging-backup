import { describe, expect, it } from "vitest";
import type { NormalizedEventCandidate } from "@ticket-radar/shared";
import {
  ArtistAliasResolver,
  VenueResolver,
  classifyDuplicate,
  eventFingerprint,
} from "./event-sync.service";
const candidate = (
  overrides: Partial<NormalizedEventCandidate> = {},
): NormalizedEventCandidate => ({
  externalId: "x",
  sourceId: "s",
  sourceUrl: "https://example.com/x",
  artistNames: ["BIGBANG"],
  title: "Show",
  descriptionSummary: null,
  venueName: "TMC",
  city: "Taipei",
  country: "TW",
  startDateTime: "2026-09-01T11:00:00.000Z",
  endDateTime: null,
  timezone: "Asia/Taipei",
  saleStartDateTime: null,
  saleEndDateTime: null,
  ticketPlatform: null,
  officialUrl: "https://example.com/x",
  ticketUrl: null,
  imageUrl: null,
  eventStatus: null,
  confidenceScore: 0.8,
  verificationStatus: "ai_parsed",
  rawSourceId: "r",
  parserVersion: "v1",
  ...overrides,
});
describe("event sync core", () => {
  it("resolves multilingual aliases without unsafe auto merge", () => {
    const resolver = new ArtistAliasResolver(
      new Map([
        ["big bang", "artist-1"],
        ["gd", "artist-2"],
      ]),
    );
    expect(resolver.resolve("Big  Bang").canonicalId).toBe("artist-1");
    expect(resolver.resolve("권지용").needsReview).toBe(true);
  });
  it("resolves venue with city", () => {
    expect(
      new VenueResolver(new Map([["tmc", { id: "venue-1", city: "Taipei" }]])).resolve(
        "TMC",
        "Taipei",
      ).canonicalId,
    ).toBe("venue-1");
  });
  it("classifies exact and probable duplicates", () => {
    expect(classifyDuplicate(candidate(), candidate())).toBe("exact_match");
    expect(
      classifyDuplicate(
        candidate({ externalId: null, officialUrl: "https://a" }),
        candidate({ externalId: null, officialUrl: "https://b" }),
      ),
    ).toBe("probable_match");
    expect(eventFingerprint(candidate())).toHaveLength(64);
  });
});
