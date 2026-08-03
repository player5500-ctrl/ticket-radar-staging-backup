import React from "react";
import { Link } from "react-router-dom";
import type { EventSummary } from "@ticket-radar/shared";
import { formatEventDate } from "@ticket-radar/shared";
import { ProtoStatusBadge } from "./ProtoStatusBadge";

export function ProtoEventCard({ event }: { event: EventSummary }) {
  const artistName = event.artists.map((a) => a.name).join("・") || "精選演出";

  return (
    <article className="proto-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <ProtoStatusBadge status={event.status} />
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--proto-neon-yellow)",
            background: "rgba(255, 209, 102, 0.12)",
            padding: "4px 8px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 209, 102, 0.3)",
          }}
        >
          📍 {event.city} {event.venue ? `· ${event.venue.name}` : ""}
        </span>
      </div>

      <div>
        <span style={{ fontSize: "0.85rem", color: "var(--proto-neon-cyan)", fontWeight: 700 }}>
          🎤 {artistName}
        </span>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 900, margin: "4px 0 8px 0", color: "#ffffff" }}>
          {event.name}
        </h3>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", display: "flex", alignItems: "center", gap: "6px" }}>
          📅 <strong>{formatEventDate(event.startsAtUtc, event.timezone)}</strong>
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        {event.platform ? (
          <span style={{ fontSize: "0.75rem", color: "var(--proto-neon-blue)" }}>
            🎟️ {event.platform.name}
          </span>
        ) : (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>🎟️ 平台開賣處理中</span>
        )}

        <Link
          to={`/prototype/event/${event.id}`}
          className="proto-btn proto-btn-secondary"
          style={{ minHeight: "38px", padding: "6px 14px", fontSize: "0.82rem" }}
        >
          詳情與任務 →
        </Link>
      </div>
    </article>
  );
}
