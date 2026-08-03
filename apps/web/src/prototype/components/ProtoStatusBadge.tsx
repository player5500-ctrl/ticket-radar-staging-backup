import React from "react";
import type { EventStatus } from "@ticket-radar/shared";

const statusMeta: Record<
  EventStatus,
  { label: string; icon: string; className: string }
> = {
  announced: { label: "已公告", icon: "📢", className: "proto-badge-announced" },
  registration: { label: "登記/抽選中", icon: "🎟️", className: "proto-badge-presale" },
  presale: { label: "預售中", icon: "⏳", className: "proto-badge-presale" },
  on_sale: { label: "一般售票", icon: "⚡", className: "proto-badge-onsale" },
  sold_out: { label: "已完售", icon: "🚫", className: "proto-badge-soldout" },
  postponed: { label: "延期", icon: "⚠️", className: "proto-badge-warning" },
  cancelled: { label: "取消", icon: "❌", className: "proto-badge-soldout" },
  completed: { label: "已結束", icon: "✅", className: "proto-badge-announced" },
  unconfirmed: { label: "狀態待確認", icon: "🔍", className: "proto-badge-warning" },
};

export function ProtoStatusBadge({ status }: { status: EventStatus }) {
  const meta = statusMeta[status] || statusMeta.unconfirmed;
  return (
    <span className={`proto-badge ${meta.className}`}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.95rem",
          filter: "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.7))",
        }}
      >
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </span>
  );
}
