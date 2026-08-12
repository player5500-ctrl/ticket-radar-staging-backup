import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";
import { api } from "../../services/api";
import { downloadReminderIcs } from "../../services/ics";
import { ProtoStatusBadge } from "../components/ProtoStatusBadge";
import { ProtoTaskWizardModal } from "../components/ProtoTaskWizardModal";
import type { TaskWizardValues } from "../components/ProtoTaskWizardModal";

export function ProtoDetailPage() {
  const { eventId = "evt-1" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.event(eventId),
    enabled: Boolean(eventId),
  });

  const favoriteMutation = useMutation({
    mutationFn: (shouldFavorite: boolean) => api.favorite(eventId, shouldFavorite),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
        queryClient.invalidateQueries({ queryKey: ["search"] }),
      ]);
    },
  });

  const taskMutation = useMutation({
    mutationFn: (values: TaskWizardValues) => api.createTicketTask({ eventId, ...values }),
    onSuccess: async () => {
      setIsWizardOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["ticket-tasks"] });
      void navigate("/tasks");
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (windowId: string) => {
      const window = eventQuery.data?.saleWindows.find((w) => w.id === windowId);
      if (!window) throw new Error("找不到售票階段");
      return api.createReminder({
        eventId,
        ticketSaleWindowId: windowId,
        channel: "ics",
        scheduledAtUtc: window.startsAtUtc,
      });
    },
    onSuccess: (reminder) => {
      downloadReminderIcs(reminder);
      void queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
  });

  if (eventQuery.isPending) {
    return (
      <div className="proto-card" style={{ textAlign: "center", padding: "50px" }}>
        <div style={{ fontSize: "2rem", marginBottom: "10px" }}>📡</div>
        <h3 style={{ color: "var(--proto-neon-cyan)" }}>正在鎖定活動頻道訊號...</h3>
      </div>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="proto-card" style={{ border: "2px solid var(--proto-neon-pink)", padding: "30px", textAlign: "center" }}>
        <h3 style={{ color: "var(--proto-neon-pink)" }}>⚠️ 無法載入活動資料</h3>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1" }}>找不到此活動或網路發生問題。</p>
        <Link to="/search" className="proto-btn proto-btn-secondary" style={{ marginTop: "12px" }}>
          ← 返回搜尋
        </Link>
      </div>
    );
  }

  const event = eventQuery.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Top Breadcrumb Link */}
      <div>
        <Link to="/search" style={{ color: "var(--proto-neon-cyan)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 700 }}>
          ← 返回搜尋列表
        </Link>
      </div>

      {/* Hero Header */}
      <section className="proto-card" style={{ background: "linear-gradient(135deg, rgba(12, 22, 42, 0.95), rgba(168, 85, 247, 0.2))", border: "2px solid var(--proto-neon-cyan)", padding: "24px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <ProtoStatusBadge status={event.status} />
          <span style={{ background: event.isAdminVerified ? "rgba(0, 245, 212, 0.15)" : "rgba(255, 209, 102, 0.15)", color: event.isAdminVerified ? "#00f5d4" : "#ffd166", border: "1px solid currentColor", padding: "4px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 900 }}>
            {event.isAdminVerified ? "✓ 官方驗證" : "⚠️ 資料待確認"}
          </span>
        </div>

        <span style={{ fontSize: "0.95rem", color: "var(--proto-neon-yellow)", fontWeight: 900 }}>
          🎤 {event.artists.map((a) => a.name).join("・")}
        </span>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "6px 0 12px 0", lineHeight: 1.25 }}>
          {event.name}
        </h1>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem", color: "#cbd5e1" }}>
          <div>📅 演出日期：<strong>{formatEventDate(event.startsAtUtc, event.timezone)}</strong></div>
          <div>📍 演出地點：<strong>{event.city} {event.venue ? `・ ${event.venue.name}` : ""}</strong></div>
        </div>

        {/* Primary Single CTA Button for Mobile */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px" }}>
          <button
            className="proto-btn proto-btn-battle"
            onClick={() => setIsWizardOpen(true)}
            style={{ flex: "2 1 200px" }}
          >
            🚀 建立購票任務與志願順位
          </button>
          <button
            className={`proto-btn ${event.isFavorited ? "proto-btn-ghost" : "proto-btn-secondary"}`}
            onClick={() => favoriteMutation.mutate(!event.isFavorited)}
            style={{ flex: "1 1 120px" }}
          >
            {event.isFavorited ? "★ 已收藏" : "☆ 收藏活動"}
          </button>
        </div>
      </section>

      {/* Official Notice Card */}
      <div className="proto-disclaimer">
        <span className="proto-disclaimer-icon">📢</span>
        <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
          <strong>購票前注意事項：</strong>
          <p style={{ margin: "4px 0 0 0" }}>
            售票時間、票價區間與限制事項請以售票平台官方最終公告為準。本站不代付、不挑位、亦不保證有票。
          </p>
        </div>
      </div>

      {/* Sale Windows Timeline */}
      <section className="proto-card">
        <div style={{ marginBottom: "16px" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--proto-neon-cyan)", fontWeight: 900, letterSpacing: "0.08em" }}>
            TIMELINE RADAR
          </span>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "2px 0 0 0" }}>
            ⏳ 售票時間軸與提醒匯出
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {event.saleWindows.map((win, idx) => (
            <div
              key={win.id}
              style={{
                background: "rgba(6, 11, 23, 0.7)",
                border: "1px solid rgba(0, 242, 254, 0.2)",
                borderRadius: "14px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--proto-neon-cyan)", fontWeight: 900 }}>
                  階段 #{idx + 1}
                </span>
                <span style={{ fontSize: "0.75rem", background: "rgba(168, 85, 247, 0.2)", color: "#e9d5ff", padding: "2px 8px", borderRadius: "6px" }}>
                  {win.saleType}
                </span>
              </div>

              <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: 0 }}>{win.title}</h3>
              <div style={{ fontSize: "0.88rem", color: "#cbd5e1" }}>
                🕒 {formatEventDate(win.startsAtUtc, event.timezone)}
              </div>
              {win.eligibilityNote && (
                <p style={{ fontSize: "0.8rem", color: "var(--proto-neon-yellow)", margin: 0 }}>
                  💡 {win.eligibilityNote}
                </p>
              )}

              <div style={{ paddingTop: "8px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="proto-btn proto-btn-ghost"
                  style={{ minHeight: "36px", padding: "4px 12px", fontSize: "0.8rem" }}
                  onClick={() => reminderMutation.mutate(win.id)}
                >
                  📅 加入行事曆 (下載 .ics)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Official Ticket Site External Link */}
      {event.officialTicketUrl && (
        <section className="proto-card" style={{ border: "1.5px solid var(--proto-neon-violet)" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 900, margin: "0 0 6px 0", color: "#fff" }}>
            🌐 官方售票入口連結
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#94a3b8", margin: "0 0 12px 0" }}>
            提示：點擊連結將開起第三方售票平台頁面，相關購票流程由該平台提供。
          </p>
          <a
            href={event.officialTicketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="proto-btn proto-btn-primary"
            style={{ textDecoration: "none", display: "inline-flex" }}
          >
            前往售票平台頁面 ↗
          </a>
        </section>
      )}

      {/* 3-Step Wizard Modal */}
      {isWizardOpen && (
        <ProtoTaskWizardModal
          eventName={event.name}
          onClose={() => setIsWizardOpen(false)}
          onSubmit={(values) => taskMutation.mutate(values)}
          errorMessage={taskMutation.error ? taskMutation.error.message : null}
          isSubmitting={taskMutation.isPending}
        />
      )}
    </div>
  );
}
