import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";
import { Button, StatusBadge } from "@ticket-radar/ui";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { api } from "../services/api";
import { eventStatusMeta, saleTypeLabels } from "../utils/status";

const sourceLabels = {
  admin_manual: "管理員手動建立",
  user_manual: "使用者手動建立",
  official_url: "官方網址",
  mock_parser: "模擬公告解析",
};

export function EventDetailPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    mutationFn: () =>
      api.createTicketTask({
        eventId,
        acceptableSessions: [],
        areaPreferences: [],
        notes: "",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-tasks"] });
      void navigate("/tasks");
    },
  });
  const reminderMutation = useMutation({
    mutationFn: (ticketSaleWindowId: string) => {
      const window = eventQuery.data?.saleWindows.find(
        (item) => item.id === ticketSaleWindowId,
      );
      if (!window) throw new Error("找不到售票階段。");
      return api.createReminder({
        eventId,
        ticketSaleWindowId,
        channel: "ics",
        scheduledAtUtc: window.startsAtUtc,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  if (eventQuery.isPending) {
    return (
      <div className="page-container detail-loading">
        <LoadingState label="正在鎖定活動訊號…" />
      </div>
    );
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <div className="page-container detail-loading">
        <ErrorState
          message="無法讀取活動，可能是連線中斷或活動不存在。"
          onRetry={() => void eventQuery.refetch()}
        />
        <Link className="text-link" to="/search">
          ← 返回搜尋
        </Link>
      </div>
    );
  }

  const event = eventQuery.data;
  const status = eventStatusMeta[event.status];

  return (
    <div className="event-detail">
      <section className="event-detail__hero">
        <div className="event-detail__visual" aria-hidden="true">
          <div className="event-detail__orbit" />
          <span>{event.artists[0]?.name.slice(0, 1) ?? "票"}</span>
        </div>
        <div className="page-container event-detail__hero-content">
          <Link className="back-link" to="/search">
            ← 返回搜尋
          </Link>
          <div className="event-detail__badges">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <StatusBadge tone={event.isAdminVerified ? "success" : "warning"}>
              {event.isAdminVerified ? "管理員已確認" : "資料待確認"}
            </StatusBadge>
          </div>
          <p className="event-detail__artist">
            {event.artists.map((artist) => artist.name).join("・")}
          </p>
          <h1>{event.name}</h1>
          <p className="event-detail__date">
            {formatEventDate(event.startsAtUtc, event.timezone)}
          </p>
          <p className="event-detail__venue">
            {event.city}
            {event.venue ? `・${event.venue.name}` : ""}
          </p>
        </div>
      </section>

      <div className="page-container detail-grid">
        <div className="detail-main">
          <aside className="official-notice official-notice--strong">
            <span aria-hidden="true">!</span>
            <p>
              <strong>購票前請再次核對</strong>
              活動資料請以主辦單位及售票平台官方公告為準。
            </p>
          </aside>

          <section className="detail-section" aria-labelledby="timeline-title">
            <div className="section-heading">
              <div>
                <span className="section-heading__eyebrow">SALE TIMELINE</span>
                <h2 id="timeline-title">售票時間軸</h2>
              </div>
            </div>
            <ol className="timeline">
              {event.saleWindows.map((window, index) => (
                <li key={window.id}>
                  <span className="timeline__marker" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="timeline__content">
                    <p className="timeline__type">
                      {saleTypeLabels[window.saleType] ?? window.title}
                    </p>
                    <h3>{window.title}</h3>
                    <time dateTime={window.startsAtUtc}>
                      {formatEventDate(window.startsAtUtc, event.timezone)}
                    </time>
                    {window.eligibilityNote && <p>{window.eligibilityNote}</p>}
                    <button
                      className="timeline__reminder"
                      type="button"
                      disabled={reminderMutation.isPending}
                      onClick={() => reminderMutation.mutate(window.id)}
                    >
                      {reminderMutation.isPending ? "建立中…" : "加入行事曆提醒"}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="detail-section" aria-labelledby="source-title">
            <div className="section-heading">
              <div>
                <span className="section-heading__eyebrow">SOURCE CHECK</span>
                <h2 id="source-title">資料來源</h2>
              </div>
            </div>
            <dl className="source-list">
              <div>
                <dt>建立方式</dt>
                <dd>{sourceLabels[event.sourceType]}</dd>
              </div>
              <div>
                <dt>主辦單位</dt>
                <dd>{event.organizerName}</dd>
              </div>
              <div>
                <dt>售票平台</dt>
                <dd>{event.platform?.name ?? "尚未指定"}</dd>
              </div>
              <div>
                <dt>最後確認</dt>
                <dd>
                  {event.lastVerifiedAtUtc
                    ? formatEventDate(event.lastVerifiedAtUtc, event.timezone)
                    : "尚未確認"}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="action-panel" aria-label="活動操作">
          <p className="action-panel__eyebrow">READY WHEN YOU ARE</p>
          <h2>把重要活動放進雷達</h2>
          <Button
            variant={event.isFavorited ? "secondary" : "primary"}
            disabled={favoriteMutation.isPending}
            aria-pressed={event.isFavorited}
            onClick={() => favoriteMutation.mutate(!event.isFavorited)}
          >
            {favoriteMutation.isPending
              ? "更新中…"
              : event.isFavorited
                ? "★ 已收藏"
                : "☆ 收藏活動"}
          </Button>
          <Button
            variant="secondary"
            disabled={taskMutation.isPending}
            onClick={() => taskMutation.mutate()}
          >
            {taskMutation.isPending ? "建立中…" : "建立購票任務"}
          </Button>
          <p className="phase-note">
            任務只保存預算、票數、場次與區域順位等準備資訊，不保存帳密、付款或驗證資料。
          </p>
          {event.officialEventUrl && (
            <a
              className="external-link"
              href={event.officialEventUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              查看活動來源 ↗
            </a>
          )}
          {event.officialTicketUrl && (
            <a
              className="external-link external-link--primary"
              href={event.officialTicketUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              開啟官方購票頁 ↗
            </a>
          )}
          <small>本 Demo 連結使用 example.com，不會執行自動選票、排隊或送單。</small>
        </aside>
      </div>
    </div>
  );
}
