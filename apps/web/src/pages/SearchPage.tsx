import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusBadge } from "@ticket-radar/ui";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { EventStatus, SearchQuery } from "@ticket-radar/shared";

import { ErrorState } from "../components/ErrorState";
import { EventCard } from "../components/EventCard";
import { LoadingState } from "../components/LoadingState";
import { SearchBar } from "../components/SearchBar";
import { api } from "../services/api";

const statusOptions: { value: EventStatus | ""; label: string }[] = [
  { value: "", label: "全部狀態" },
  { value: "announced", label: "已公告" },
  { value: "registration", label: "登記／抽選" },
  { value: "presale", label: "預售" },
  { value: "on_sale", label: "一般售票" },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const query = useMemo<SearchQuery>(
    () => ({
      q: params.get("q") ?? "",
      ...(params.get("city") ? { city: params.get("city") ?? undefined } : {}),
      ...(params.get("platform")
        ? { platform: params.get("platform") ?? undefined }
        : {}),
      ...(params.get("status") ? { status: params.get("status") as EventStatus } : {}),
      ...(params.get("dateFrom")
        ? { dateFrom: params.get("dateFrom") ?? undefined }
        : {}),
      ...(params.get("dateTo") ? { dateTo: params.get("dateTo") ?? undefined } : {}),
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

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const resultCount =
    (searchResult.data?.events.length ?? 0) +
    (searchResult.data?.artists.length ?? 0) +
    (searchResult.data?.venues.length ?? 0);

  return (
    <div className="page-container search-page">
      <header className="page-heading">
        <span className="section-heading__eyebrow">SCAN THE SCENE</span>
        <h1>搜尋演出訊號</h1>
        <p>可搜尋中文、英文、日文、韓文別名，以及活動、場館與城市。</p>
      </header>

      <SearchBar
        compact
        initialValue={query.q}
        onSearch={(value) => updateParam("q", value)}
      />

      <section className="filters" aria-label="搜尋篩選">
        <label>
          城市
          <select
            value={query.city ?? ""}
            onChange={(event) => updateParam("city", event.target.value)}
          >
            <option value="">全部城市</option>
            <option value="台北市">台北市</option>
            <option value="高雄市">高雄市</option>
          </select>
        </label>
        <label>
          售票狀態
          <select
            value={query.status ?? ""}
            onChange={(event) => updateParam("status", event.target.value)}
          >
            {statusOptions.map((option) => (
              <option value={option.value} key={option.value || "all"}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          售票平台
          <select
            value={query.platform ?? ""}
            onChange={(event) => updateParam("platform", event.target.value)}
          >
            <option value="">全部平台</option>
            {searchResult.data?.platforms.map((platform) => (
              <option value={platform.slug} key={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          開始日期
          <input
            type="date"
            value={query.dateFrom ?? ""}
            onChange={(event) => updateParam("dateFrom", event.target.value)}
          />
        </label>
        <label>
          結束日期
          <input
            type="date"
            value={query.dateTo ?? ""}
            onChange={(event) => updateParam("dateTo", event.target.value)}
          />
        </label>
      </section>

      {searchResult.isPending && <LoadingState label="正在掃描演出資料…" />}
      {searchResult.isError && (
        <ErrorState
          error={searchResult.error}
          subject="搜尋結果"
          onRetry={() => void searchResult.refetch()}
        />
      )}

      {searchResult.data && (
        <div className="search-results">
          <p className="result-count" aria-live="polite">
            找到 <strong>{resultCount}</strong> 個相關訊號
          </p>

          {searchResult.data.artists.length > 0 && (
            <section aria-labelledby="artist-results">
              <div className="section-heading">
                <h2 id="artist-results">歌手與團體</h2>
              </div>
              <div className="artist-results">
                {searchResult.data.artists.map((artist) => (
                  <article className="artist-result" key={artist.id}>
                    <span className="artist-result__avatar" aria-hidden="true">
                      {artist.name.slice(0, 1)}
                    </span>
                    <div>
                      <h3>{artist.name}</h3>
                      <p>{artist.aliases.join("・")}</p>
                    </div>
                    <Button
                      variant={artist.isFollowed ? "secondary" : "primary"}
                      disabled={followMutation.isPending}
                      aria-pressed={artist.isFollowed}
                      onClick={() =>
                        followMutation.mutate({
                          id: artist.id,
                          shouldFollow: !artist.isFollowed,
                        })
                      }
                    >
                      {artist.isFollowed ? "已追蹤" : "＋ 追蹤"}
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="event-results">
            <div className="section-heading">
              <h2 id="event-results">活動</h2>
              {query.q && <StatusBadge tone="info">關鍵字：{query.q}</StatusBadge>}
            </div>
            {searchResult.data.events.length > 0 ? (
              <div className="event-grid">
                {searchResult.data.events.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span aria-hidden="true">⌁</span>
                <h3>這個頻率暫時沒有活動</h3>
                <p>試著移除部分篩選，或改用歌手別名搜尋。</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
