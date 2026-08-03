import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";

export function ProtoBattleModePage() {
  const homeQuery = useQuery({ queryKey: ["home"], queryFn: api.home });
  const tasksQuery = useQuery({ queryKey: ["ticket-tasks"], queryFn: api.ticketTasks });

  const targetEvent = homeQuery.data?.upcomingEvents[0];
  const activeTask = tasksQuery.data?.[0];

  // Millisecond live countdown
  const [timeLeft, setTimeLeft] = useState({ hours: "01", minutes: "42", seconds: "18", ms: "84" });

  useEffect(() => {
    const timer = setInterval(() => {
      const date = new Date();
      const s = (59 - date.getSeconds()).toString().padStart(2, "0");
      const ms = Math.floor((1000 - date.getMilliseconds()) / 10)
        .toString()
        .padStart(2, "0");
      setTimeLeft((prev) => ({ ...prev, seconds: s, ms }));
    }, 50);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div
        className="proto-card"
        style={{
          background: "linear-gradient(135deg, rgba(255, 42, 109, 0.3), rgba(6, 11, 23, 0.95))",
          border: "2px solid var(--proto-neon-pink)",
          boxShadow: "var(--proto-shadow-pink-glow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.78rem", background: "var(--proto-neon-pink)", color: "#fff", padding: "2px 10px", borderRadius: "999px", fontWeight: 900 }}>
            ⚡ COMBAT READY 臨場作戰
          </span>
          <Link to="/prototype" style={{ color: "#94a3b8", textDecoration: "none", fontSize: "0.8rem" }}>
            ✕ 離開作戰模式
          </Link>
        </div>

        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "10px 0 4px 0" }}>
          {targetEvent ? targetEvent.name : "Night Orbit 2026 世界巡迴演唱會 台北站"}
        </h1>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: 0 }}>
          📍 台北流行音樂中心 · KKTIX 售票平台
        </p>

        {/* Live Millisecond Countdown Display */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            margin: "20px 0 10px 0",
            textAlign: "center",
          }}
        >
          {[
            { label: "時", val: timeLeft.hours },
            { label: "分", val: timeLeft.minutes },
            { label: "秒", val: timeLeft.seconds },
            { label: "毫秒", val: timeLeft.ms },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "rgba(0, 0, 0, 0.6)",
                border: "1.5px solid var(--proto-neon-cyan)",
                borderRadius: "14px",
                padding: "10px 4px",
                boxShadow: "inset 0 0 15px rgba(0, 242, 254, 0.2)",
              }}
            >
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--proto-neon-yellow)", fontFamily: "monospace" }}>
                {item.val}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Direct Launch Official Ticket Site */}
        <a
          href={targetEvent?.platform ? "https://kktix.com" : "https://kktix.com"}
          target="_blank"
          rel="noopener noreferrer"
          className="proto-btn proto-btn-battle"
          style={{ width: "100%", textDecoration: "none", marginTop: "10px", fontSize: "1.1rem" }}
        >
          🚀 立即開啟官方售票網頁 ↗
        </a>
      </div>

      {/* Explicit Non-Automation Disclaimer */}
      <div className="proto-disclaimer" style={{ background: "rgba(255, 42, 109, 0.1)", borderColor: "var(--proto-neon-pink)", color: "#ffccd5" }}>
        <span className="proto-disclaimer-icon">⚠️</span>
        <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
          <strong>作戰模式安全與合規須知：</strong>
          <p style={{ margin: "4px 0 0 0" }}>
            本畫面專為您整理志願順位備忘。<strong>Ticket Radar 不會進行自動刷新、自動選位、自動填表或破解 CAPTCHA</strong>。請於開啟官方售票頁後由您親自操作。
          </p>
        </div>
      </div>

      {/* Quick Area & Session Memory Chips */}
      <section className="proto-card">
        <h2 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 12px 0", color: "var(--proto-neon-cyan)" }}>
          🎯 搶票志願順位備忘
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>首選場次</span>
            <div style={{ fontSize: "1rem", fontWeight: 900, color: "#fff", background: "rgba(0, 242, 254, 0.15)", border: "1px solid var(--proto-neon-cyan)", padding: "8px 12px", borderRadius: "10px", marginTop: "4px" }}>
              📅 2026-10-24 (六) 19:30 首場
            </div>
          </div>

          <div>
            <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>區域志願順位</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {activeTask?.areaPreferences && activeTask.areaPreferences.length > 0 ? (
                activeTask.areaPreferences.map((area, idx) => (
                  <div
                    key={area}
                    style={{
                      background: "rgba(168, 85, 247, 0.2)",
                      border: "1px solid var(--proto-neon-violet)",
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "#e9d5ff",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{`第 ${idx + 1} 志願：${area}`}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--proto-neon-yellow)" }}>單張上限 NT$ 4,800</span>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ background: "rgba(168, 85, 247, 0.2)", border: "1px solid var(--proto-neon-violet)", padding: "8px 12px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 700, color: "#e9d5ff" }}>
                    第 1 志願：搖滾 A 區 (前排)
                  </div>
                  <div style={{ background: "rgba(168, 85, 247, 0.15)", border: "1px solid rgba(168, 85, 247, 0.4)", padding: "8px 12px", borderRadius: "10px", fontSize: "0.92rem", fontWeight: 700, color: "#cbd5e1" }}>
                    第 2 志願：看台 2 區 (中央視野)
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Final Checklist */}
      <section className="proto-card">
        <h2 style={{ fontSize: "1.1rem", fontWeight: 900, margin: "0 0 10px 0", color: "var(--proto-neon-yellow)" }}>
          ☑️ 臨場最後 5 分鐘確認
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.88rem" }}>
          <div>✅ 售票平台帳號已提前登入</div>
          <div>✅ 信用卡/付款資料已準備妥當</div>
          <div>✅ 驗證問答預測題目已閱讀備查</div>
        </div>
      </section>
    </div>
  );
}
