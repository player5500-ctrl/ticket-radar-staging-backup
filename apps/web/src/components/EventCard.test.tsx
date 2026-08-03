import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { EventSummary } from "@ticket-radar/shared";

import { EventCard } from "./EventCard";

const event: EventSummary = {
  id: "event-stellar-route-taipei",
  name: "星際航線：台北站",
  startsAtUtc: "2026-08-15T11:30:00.000Z",
  endsAtUtc: null,
  city: "台北市",
  timezone: "Asia/Taipei",
  status: "presale",
  imageUrl: null,
  venue: {
    id: "venue-demo",
    name: "台北星環館（Demo）",
    city: "台北市",
    timezone: "Asia/Taipei",
  },
  platform: {
    id: "platform-demo",
    name: "Ticket Radar Demo",
    slug: "demo",
  },
  artists: [{ id: "artist-night-orbit", name: "夜航星" }],
  isAdminVerified: false,
  lastVerifiedAtUtc: null,
  createdAtUtc: "2026-07-28T03:00:00.000Z",
};

describe("EventCard", () => {
  it("顯示狀態、日期、場館與資料待確認標示", () => {
    render(
      <MemoryRouter>
        <EventCard event={event} />
      </MemoryRouter>,
    );

    expect(screen.getByText("星際航線：台北站")).toBeTruthy();
    expect(screen.getByText("預售準備")).toBeTruthy();
    expect(screen.getByText("資料待確認")).toBeTruthy();
    expect(screen.getByText(/19:30/)).toBeTruthy();
    expect(screen.getByText(/台北星環館/)).toBeTruthy();
  });
});
