import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { ProtoEventCard } from "../components/ProtoEventCard";

export function ProtoHomePage() {
  const navigate = useNavigate();
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: api.home,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Hero Section */}
      <section className="proto-hero">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(0, 242, 254, 0.12)", border: "1px solid var(--proto-neon-cyan)", padding: "4px 12px", borderRadius: "999px", fontSize: "0.78rem", color: "var(--proto-neon-cyan)", fontWeight: 900 }}>
          <span>●</span> 演出訊號與售票即時雷達
        </div>
        
        <h1 className="proto-hero-title">
          演唱會開賣時刻，<br />
          精準準備，不再錯過。
        </h1>
        
        <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.5, margin: "8px 0 16px 0" }}>
          整理官方售票時間軸、排定志願與提醒。<strong>最後選票與送出完全由您親自完成。</strong>
        </p>

        {/* Rapid Search Bar */}
        <div style={{ display: "flex", gap: "8px", maxWidth: "600px" }}>
          <input
            type="text"
            placeholder="搜尋歌手、活動名稱、場館或城市..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value;
                void navigate(val ? `/search?q=${encodeURIComponent(val)}` : "/search");
              }
            }}
            style={{
              flex: 1,
              padding: "14px 16px",
              borderRadius: "16px",
              background: "rgba(12, 22, 42, 0.9)",
              border: "2px solid var(--proto-border)",
              color: "#fff",
              fontSize: "0.95rem",
              fontFamily: "var(--proto-font)",
              outline: "none",
            }}
          />
          <button
            className="proto-btn proto-btn-primary"
            onClick={() => navigate("/search")}
          >
            ⌕ 搜尋
          </button>
        </div>

        {/* Safety Principles */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
          {["🛡️ 不自動搶票", "⚡ 不自動選位送單", "📌 100% 官方資訊優先"].map((item) => (
            <span
              key={item}
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: "4px 10px",
                borderRadius: "8px",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Official Notice */}
      <div className="proto-disclaimer" style={{ marginBottom: 0 }}>
        <span className="proto-disclaimer-icon">ℹ️</span>
        <div style={{ fontSize: "0.85rem" }}>
          <strong>官方資訊優先告知：</strong>
          活動開賣時間、票價與條款請隨時以主辦單位及官方售票平台最新公告為準。
        </div>
      </div>

      {/* Quick Artist Follows Chips */}
      {homeQuery.data?.followedArtists && homeQuery.data.followedArtists.length > 0 && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 900, color: "var(--proto-neon-yellow)" }}>
              ❤️ 我的追蹤歌手
            </h2>
          </div>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px" }}>
            {homeQuery.data.followedArtists.map((artist) => (
              <button
                key={artist.id}
                onClick={() => navigate(`/search?q=${encodeURIComponent(artist.name)}`)}
                style={{
                  background: "rgba(168, 85, 247, 0.15)",
                  border: "1px solid var(--proto-neon-violet)",
                  borderRadius: "14px",
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#fff",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "var(--proto-font)",
                }}
              >
                <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--proto-neon-violet)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 900 }}>
                  {artist.name.charAt(0)}
                </span>
                <strong>{artist.name}</strong>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Sale Signals */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <span style={{ fontSize: "0.72rem", color: "var(--proto-neon-cyan)", fontWeight: 900, letterSpacing: "0.08em" }}>
              NEXT SALE SIGNALS
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: "2px 0 0 0" }}>⚡ 即將開賣賽道</h2>
          </div>
          <Link to="/search" className="proto-btn proto-btn-ghost" style={{ minHeight: "36px", padding: "4px 12px", fontSize: "0.8rem" }}>
            查看全部 →
          </Link>
        </div>

        {homeQuery.isPending && (
          <div className="proto-card" style={{ textAlign: "center", padding: "30px", color: "var(--proto-neon-cyan)" }}>
            🔄 正在掃描全台售票訊號...
          </div>
        )}

        {homeQuery.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {homeQuery.data.upcomingEvents.map((event) => (
              <ProtoEventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* Battle Mode Shortcut Banner */}
      <div
        className="proto-card"
        style={{
          background: "linear-gradient(135deg, rgba(255, 42, 109, 0.25), rgba(168, 85, 247, 0.25))",
          border: "2px solid var(--proto-neon-pink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <span style={{ fontSize: "0.78rem", color: "var(--proto-neon-yellow)", fontWeight: 900 }}>
            ⚡ COMBAT READY MODE
          </span>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "4px 0" }}>
            開賣臨場作戰模式
          </h3>
          <p style={{ fontSize: "0.85rem", color: "#cbd5e1", margin: 0 }}>
            大字毫秒倒數、官方售票入口直接跳轉、志願順位記憶卡
          </p>
        </div>
        <button
          className="proto-btn proto-btn-battle"
          onClick={() => navigate("/battle")}
        >
          🚀 進入作戰模式
        </button>
      </div>
    </div>
  );
}
