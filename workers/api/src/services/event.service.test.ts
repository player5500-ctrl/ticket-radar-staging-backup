import { describe, expect, it, vi } from "vitest";

import type { EventDetail, HomeResponse, SearchResponse } from "@ticket-radar/shared";

import type { EventRepository } from "../repositories/event.repository";
import { EventService } from "./event.service";

const emptySearch: SearchResponse = {
  query: "",
  artists: [],
  events: [],
  venues: [],
  platforms: [],
};

const emptyHome: HomeResponse = {
  upcomingEvents: [],
  recentEvents: [],
  followedArtists: [],
};

function createRepository(): EventRepository {
  return {
    search: vi.fn().mockResolvedValue(emptySearch),
    getHome: vi.fn().mockResolvedValue(emptyHome),
    findById: vi.fn().mockResolvedValue(null),
    favorite: vi.fn().mockResolvedValue(true),
    unfavorite: vi.fn().mockResolvedValue(true),
    followArtist: vi.fn().mockResolvedValue(true),
    unfollowArtist: vi.fn().mockResolvedValue(true),
  };
}

describe("EventService", () => {
  it("以 UTC 傳入首頁查詢", async () => {
    const repository = createRepository();
    const service = new EventService(repository);
    await service.home("user-demo", new Date("2026-07-29T00:00:00.000Z"));

    expect(repository.getHome).toHaveBeenCalledWith(
      "user-demo",
      "2026-07-29T00:00:00.000Z",
    );
  });

  it("收藏結果保持 idempotent 狀態", async () => {
    const repository = createRepository();
    const service = new EventService(repository);

    await expect(service.setFavorite("event-neon", "user-demo", true)).resolves.toEqual(
      {
        eventId: "event-neon",
        isFavorited: true,
      },
    );
    expect(repository.favorite).toHaveBeenCalledWith("event-neon", "user-demo");
  });

  it("不存在活動時回傳 null", async () => {
    const repository = createRepository();
    repository.favorite = vi.fn().mockResolvedValue(false);
    const service = new EventService(repository);

    await expect(service.setFavorite("missing", "user-demo", true)).resolves.toBeNull();
  });

  it("保留活動成立與付款狀態以外的詳情資料", async () => {
    const repository = createRepository();
    const detail = {
      id: "event-neon",
      name: "星際航線",
      startsAtUtc: "2026-08-15T11:30:00.000Z",
      endsAtUtc: null,
      city: "台北市",
      timezone: "Asia/Taipei",
      status: "presale",
      imageUrl: null,
      venue: null,
      platform: null,
      artists: [],
      isAdminVerified: false,
      lastVerifiedAtUtc: null,
      createdAtUtc: "2026-07-20T00:00:00.000Z",
      organizerName: "Ticket Radar Demo",
      officialEventUrl: null,
      officialTicketUrl: null,
      sourceType: "mock_parser",
      sourceUrl: null,
      saleWindows: [],
      isFavorited: false,
    } satisfies EventDetail;
    repository.findById = vi.fn().mockResolvedValue(detail);

    const service = new EventService(repository);
    await expect(service.getEvent("event-neon", null)).resolves.toEqual(detail);
  });
});
