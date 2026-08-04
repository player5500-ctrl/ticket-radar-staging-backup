import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventStatus, SearchQuery } from "@ticket-radar/shared";
import { api } from "../../services/api";
import { ProtoEventCard } from "../components/ProtoEventCard";
import { ProtoStatusBadge } from "../components/ProtoStatusBadge";

const statusOptions: { value: EventStatus | ""; label: string }[] = [
  { value: "", label: "全部售票狀態" },
  { value: "announced", label: "已公告" },
  { value: "registration", label: "登記／抽選" },
  { value: "presale", label: "預售" },
  { value: "on_sale", label: "一般售票" },
];

export function ProtoSearchPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const query = useMemo<SearchQuery>(
    () => ({
      q: params.get("q") ?? "",
      city: params.get("city") ?? undefined,
      platform: params.get("platform") ?? undefined,
      status: (params.get("status") as EventStatus) || undefined,
    }),
    [params],
  );

  const searchResult = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
  });

  const followMutation = useMutation({
    mutationFn: ({ id, shouldFollow }: { id: string; shouldFollow: boolean }) =>
      api.follow(id, shouldFollow),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["search"] }),
        queryClient.invalidateQueries({ queryKey: ["home"] }),
      ]);
    },
  });

  const latestSearchMutation = useMutation({
    mutationFn: () => api.requestLatestOfficialSearch(),
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const totalResults =
    (searchResult.data?.events.length ?? 0) + (searchResult.data?.artists.length ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <span
          style={{
            fontSize: "0.72rem",
            color: "var(--proto-neon-cyan)",
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          SIGNAL SEARCH ENGINE
        </span>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "2px 0 6px 0" }}>
          搜尋全台演出訊號
        </h1>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: 0 }}>
          支援中英文歌手、別名、演唱會名稱、場館與城市搜尋
        </p>
      </div>

      {/* Main Search Input */}
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={query.q}
          onChange={(e) => updateParam("q", e.target.value)}
          placeholder="輸入歌手如 Night Orbit、場館如 台北流行音樂中心..."
          style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: "14px",
            background: "rgba(12, 22, 42, 0.9)",
            border: "2px solid var(--proto-border)",
            color: "#fff",
            fontSize: "0.95rem",
            fontFamily: "var(--proto-font)",
            outline: "none",
          }}
        />
        {query.q && (
          <button
            className="proto-btn proto-btn-ghost"
            onClick={() => updateParam("q", "")}
          >
            清空
          </button>
        )}
      </div>

      {/* Multi-criteria Filter Bar */}
      <div
        className="proto-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "10px",
          padding: "14px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            📍 城市
          </label>
          <select
            value={query.city ?? ""}
            onChange={(e) => updateParam("city", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "10px",
              background: "#060b17",
              border: "1px solid var(--proto-border)",
              color: "#fff",
              fontSize: "0.85rem",
            }}
          >
            <option value="">全部城市</option>
            <option value="台北市">台北市</option>
            <option value="高雄市">高雄市</option>
            <option value="台中市">台中市</option>
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            ⚡ 售票狀態
          </label>
          <select
            value={query.status ?? ""}
            onChange={(e) => updateParam("status", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "10px",
              background: "#060b17",
              border: "1px solid var(--proto-border)",
              color: "#fff",
              fontSize: "0.85rem",
            }}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "0.75rem",
              color: "#94a3b8",
              fontWeight: 700,
              marginBottom: "4px",
            }}
          >
            🎟️ 售票平台
          </label>
          <select
            value={query.platform ?? ""}
            onChange={(e) => updateParam("platform", e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "10px",
              background: "#060b17",
              border: "1px solid var(--proto-border)",
              color: "#fff",
              fontSize: "0.85rem",
            }}
          >
            <option value="">全部平台</option>
            {searchResult.data?.platforms.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {searchResult.isPending && (
        <div
          className="proto-card"
          style={{ textAlign: "center", padding: "40px 20px" }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "10px" }}>🔍</div>
          <h3
            style={{ fontSize: "1.1rem", color: "var(--proto-neon-cyan)", margin: 0 }}
          >
            正在掃描全台售票資料與雷達訊號...
          </h3>
        </div>
      )}

      {/* Error state */}
      {searchResult.isError && (
        <div
          className="proto-card"
          style={{ border: "2px solid var(--proto-neon-pink)", padding: "20px" }}
        >
          <h3 style={{ color: "var(--proto-neon-pink)", margin: "0 0 6px 0" }}>
            ⚠️ 搜尋連線中斷
          </h3>
          <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: 0 }}>
            無法讀取演出資料，請確認網路連線或稍後再試。
          </p>
          <button
            className="proto-btn proto-btn-secondary"
            onClick={() => searchResult.refetch()}
            style={{ marginTop: "12px", minHeight: "38px" }}
          >
            🔄 重新試試
          </button>
        </div>
      )}

      {/* Results view */}
      {searchResult.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "0.9rem",
              color: "var(--proto-neon-cyan)",
              fontWeight: 700,
            }}
          >
            🔍 找到 <strong>{totalResults}</strong> 個相關演出訊號
          </div>
          {totalResults === 0 && (
            <div
              className="proto-card"
              style={{ padding: "18px", border: "1px solid var(--proto-neon-cyan)" }}
            >
              <strong>目前資料庫尚未收錄此活動</strong>
              <p style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                可建立「搜尋最新官方公告」同步工作；不會即時掃描全部來源，請以官方公告為準。
              </p>
              <button
                className="proto-btn proto-btn-secondary"
                onClick={() => latestSearchMutation.mutate()}
                disabled={latestSearchMutation.isPending}
              >
                {latestSearchMutation.isPending ? "建立同步中…" : "搜尋最新官方公告"}
              </button>
            </div>
          )}

          {/* Artists */}
          {searchResult.data.artists.length > 0 && (
            <section>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: "10px" }}>
                🎤 歌手與團體
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                }}
              >
                {searchResult.data.artists.map((artist) => (
                  <div
                    key={artist.id}
                    className="proto-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          borderRadius: "50%",
                          background:
                            "linear-gradient(135deg, var(--proto-neon-purple), var(--proto-neon-pink))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.2rem",
                          fontWeight: 900,
                        }}
                      >
                        {artist.name.slice(0, 1)}
                      </div>
                      <div>
                        <h3 style={{ fontSize: "1rem", fontWeight: 900, margin: 0 }}>
                          {artist.name}
                        </h3>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "#94a3b8",
                            margin: "2px 0 0 0",
                          }}
                        >
                          {artist.aliases.join("・")}
                        </p>
                      </div>
                    </div>
                    <button
                      className={`proto-btn ${artist.isFollowed ? "proto-btn-ghost" : "proto-btn-primary"}`}
                      style={{
                        minHeight: "36px",
                        padding: "4px 12px",
                        fontSize: "0.8rem",
                      }}
                      onClick={() =>
                        followMutation.mutate({
                          id: artist.id,
                          shouldFollow: !artist.isFollowed,
                        })
                      }
                    >
                      {artist.isFollowed ? "✓ 已追蹤" : "＋ 追蹤"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Events */}
          <section>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 900, marginBottom: "10px" }}>
              🎟️ 活動節目
            </h2>
            {searchResult.data.events.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "16px",
                }}
              >
                {searchResult.data.events.map((event) => (
                  <ProtoEventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div
                className="proto-card"
                style={{ textAlign: "center", padding: "40px" }}
              >
                <span style={{ fontSize: "2.5rem" }}>📡</span>
                <h3 style={{ fontSize: "1.1rem", margin: "10px 0 4px 0" }}>
                  尚未找到符合的演出
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                  試著調整篩選條件或清空關鍵字再試試看。
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
