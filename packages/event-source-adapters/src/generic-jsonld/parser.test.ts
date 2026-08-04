import { describe, expect, it } from "vitest";
import { extractJsonLdEvents } from "./parser";
describe("generic JSON-LD event parser", () => {
  const input = {
    sourceId: "mock",
    sourceUrl: "https://example.com/event",
    rawSourceId: "raw-1",
  };
  it("parses single event and @graph", () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"MusicEvent","name":"BIGBANG","startDate":"2026-09-01T19:00:00+08:00","location":{"name":"TMC","address":{"addressLocality":"Taipei"}}},{"@type":"Thing","name":"ignore"}]}</script>`;
    const result = extractJsonLdEvents(html, input);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("BIGBANG");
    expect(result[0]?.startDateTime).toBe("2026-09-01T11:00:00.000Z");
  });
  it("extracts performer names for alias resolution", () => {
    const html = `<script type="application/ld+json">{"@type":"MusicEvent","name":"BIGBANG","startDate":"2026-09-01T19:00:00+08:00","performer":[{"@type":"MusicGroup","name":"BIGBANG"},{"name":"VIP Guest"}]}</script>`;
    const result = extractJsonLdEvents(html, input);
    expect(result[0]?.artistNames).toEqual(["BIGBANG", "VIP Guest"]);
  });
  it("ignores invalid JSON and unknown types", () => {
    expect(
      extractJsonLdEvents(
        `<script type="application/ld+json">bad</script><script type="application/ld+json">{"@type":"Thing","name":"x"}</script>`,
        input,
      ),
    ).toEqual([]);
  });
});
