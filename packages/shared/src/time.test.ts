import { describe, expect, it } from "vitest";

import { formatEventDate, isValidTimeZone } from "./time";

describe("time helpers", () => {
  it("將 UTC 顯示為台北時間", () => {
    expect(formatEventDate("2026-08-15T11:30:00.000Z")).toContain("19:30");
  });

  it("拒絕無效時區", () => {
    expect(isValidTimeZone("Asia/Not-A-City")).toBe(false);
    expect(() =>
      formatEventDate("2026-08-15T11:30:00.000Z", "Asia/Not-A-City"),
    ).toThrow("無效的 IANA 時區");
  });
});
