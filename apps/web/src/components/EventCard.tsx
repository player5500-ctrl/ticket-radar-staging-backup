import type { EventSummary } from "@ticket-radar/shared";
import { formatEventDate } from "@ticket-radar/shared";
import { Card, StatusBadge } from "@ticket-radar/ui";
import { Link } from "react-router-dom";

import { eventStatusMeta } from "../utils/status";

export function EventCard({ event }: { event: EventSummary }) {
  const status = eventStatusMeta[event.status];

  return (
    <Card className="event-card">
      <Link to={`/events/${event.id}`} className="event-card__link">
        <div className="event-card__art" aria-hidden="true">
          <span>{event.artists[0]?.name.slice(0, 1) ?? "票"}</span>
          <div className="event-card__rings" />
        </div>
        <div className="event-card__body">
          <div className="event-card__eyebrow">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {!event.isAdminVerified && (
              <span className="unverified-label">資料待確認</span>
            )}
          </div>
          <h3>{event.name}</h3>
          <p className="event-card__artist">
            {event.artists.map((artist) => artist.name).join("・")}
          </p>
          <dl className="event-card__meta">
            <div>
              <dt>日期</dt>
              <dd>{formatEventDate(event.startsAtUtc, event.timezone)}</dd>
            </div>
            <div>
              <dt>地點</dt>
              <dd>
                {event.city}
                {event.venue ? `・${event.venue.name}` : ""}
              </dd>
            </div>
          </dl>
          <span className="text-link">查看活動與售票時間軸 →</span>
        </div>
      </Link>
    </Card>
  );
}
