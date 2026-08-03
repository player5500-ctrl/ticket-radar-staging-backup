import { describe, expect, it } from "vitest";

import { escapeLikePattern, normalizeSearchTerm, searchQuerySchema } from "./search";

describe("normalizeSearchTerm", () => {
  it("正規化全形字元、空白與大小寫", () => {
    expect(normalizeSearchTerm("  ＹＯＡＳＯＢＩ   Live  ")).toBe("yoasobi live");
  });

  it("保留中日韓文字", () => {
    expect(normalizeSearchTerm("  새벽  신호 ")).toBe("새벽 신호");
  });
});

describe("escapeLikePattern", () => {
  it("跳脫 SQLite LIKE 萬用字元", () => {
    expect(escapeLikePattern("100%_live\\")).toBe("100\\%\\_live\\\\");
  });
});

describe("searchQuerySchema", () => {
  it("接受合法日期範圍", () => {
    const result = searchQuerySchema.parse({
      q: "夜航星",
      dateFrom: "2026-08-01",
      dateTo: "2026-09-01",
    });
    expect(result.q).toBe("夜航星");
  });

  it("拒絕反向日期範圍", () => {
    const result = searchQuerySchema.safeParse({
      dateFrom: "2026-09-01",
      dateTo: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });
});
