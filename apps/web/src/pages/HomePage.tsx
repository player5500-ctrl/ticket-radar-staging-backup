import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { EventCard } from "../components/EventCard";
import { LoadingState } from "../components/LoadingState";
import { SearchBar } from "../components/SearchBar";
import { api } from "../services/api";

export function HomePage() {
  const navigate = useNavigate();
  const homeQuery = useQuery({
    queryKey: ["home"],
    queryFn: api.home,
  });

  return (
    <>
      <section className="hero">
        <div className="hero__noise" aria-hidden="true" />
        <div className="hero__content page-container">
          <p className="hero__kicker">
            <span aria-hidden="true">●</span> 演出訊號已上線
          </p>
          <h1>
            重要售票時間，
            <br />
            不再錯過。
          </h1>
          <p>
            搜尋活動、整理官方公告與售票時間。
            <strong>最後選票、驗證與送出都由你親自完成。</strong>
          </p>
          <SearchBar
            onSearch={(query) =>
              navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search")
            }
          />
          <div className="hero__principles" aria-label="產品安全原則">
            <span>不監控票量</span>
            <span>不自動送單</span>
            <span>只整理官方資訊</span>
          </div>
        </div>
      </section>

      <div className="page-container home-content">
        <aside className="official-notice">
          <span aria-hidden="true">i</span>
          <p>
            <strong>官方資訊優先</strong>
            活動資料請以主辦單位及售票平台官方公告為準。
          </p>
        </aside>

        {homeQuery.isPending && <LoadingState />}
        {homeQuery.isError && (
          <ErrorState
            error={homeQuery.error}
            subject="活動資料"
            onRetry={() => void homeQuery.refetch()}
          />
        )}

        {homeQuery.data && (
          <>
            <section className="content-section" aria-labelledby="upcoming-title">
              <div className="section-heading">
                <div>
                  <span className="section-heading__eyebrow">NEXT SIGNALS</span>
                  <h2 id="upcoming-title">即將登場</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("/search")}
                  type="button"
                >
                  查看全部
                </button>
              </div>
              <div className="event-grid">
                {homeQuery.data.upcomingEvents.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            </section>

            <section className="content-section" aria-labelledby="follow-title">
              <div className="section-heading">
                <div>
                  <span className="section-heading__eyebrow">MY FREQUENCY</span>
                  <h2 id="follow-title">我的追蹤</h2>
                </div>
              </div>
              {homeQuery.data.followedArtists.length > 0 ? (
                <div className="artist-strip">
                  {homeQuery.data.followedArtists.map((artist) => (
                    <button
                      type="button"
                      key={artist.id}
                      className="artist-chip"
                      onClick={() =>
                        navigate(`/search?q=${encodeURIComponent(artist.name)}`)
                      }
                    >
                      <span aria-hidden="true">{artist.name.slice(0, 1)}</span>
                      <strong>{artist.name}</strong>
                      <small>{artist.aliases[0]}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-copy">尚未追蹤歌手，可從搜尋結果開始。</p>
              )}
            </section>

            <section className="content-section" aria-labelledby="recent-title">
              <div className="section-heading">
                <div>
                  <span className="section-heading__eyebrow">JUST IN</span>
                  <h2 id="recent-title">最近新增</h2>
                </div>
              </div>
              <div className="event-grid event-grid--compact">
                {homeQuery.data.recentEvents.map((event) => (
                  <EventCard event={event} key={event.id} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
