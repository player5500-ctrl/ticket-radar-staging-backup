import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { api } from "../services/api";

const countLabels = {
  artists: "歌手／團體",
  events: "活動",
  unverifiedEvents: "待確認活動",
  openReports: "待處理回報",
  notificationFailures: "通知失敗",
} as const;

const adapterStatusLabels = {
  draft: "草稿",
  disabled: "停用",
  testing: "測試中",
  active: "啟用",
  deprecated: "已淘汰",
} as const;

export function AdminPage() {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
  });
  const verification = useMutation({
    mutationFn: ({ eventId, isVerified }: { eventId: string; isVerified: boolean }) =>
      api.setAdminEventVerified(eventId, isVerified),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });

  if (overview.isLoading) {
    return <LoadingState label="正在載入管理雷達…" />;
  }
  if (overview.isError || !overview.data) {
    return (
      <ErrorState
        error={overview.error}
        subject="管理後台"
        onRetry={() => void overview.refetch()}
      />
    );
  }

  return (
    <div className="page-container admin-page">
      <header className="page-heading">
        <p className="section-heading__eyebrow">PHASE 6 ADAPTER REVIEW</p>
        <h1>管理後台</h1>
        <p>管理權限由 Worker 檢查使用者角色，前端不自行宣告管理員身分。</p>
      </header>

      <section className="admin-metrics" aria-label="管理摘要">
        {Object.entries(overview.data.counts).map(([key, value]) => (
          <article className="admin-metric" key={key}>
            <strong>{value}</strong>
            <span>{countLabels[key as keyof typeof countLabels]}</span>
          </article>
        ))}
      </section>

      <section className="admin-audit-panel" aria-labelledby="adapters-heading">
        <div className="section-heading">
          <p className="section-heading__eyebrow">PLATFORM SAFETY</p>
          <h2 id="adapters-heading">售票平台 Adapter 狀態</h2>
          <p>停用項目不會取得網站權限、讀取購票頁或填入任何資料。</p>
        </div>
        <ul className="admin-adapter-list">
          {overview.data.adapterVersions.map((adapter) => (
            <li key={adapter.id}>
              <div>
                <strong>{adapter.platformName}</strong>
                <span>
                  {adapter.adapterId} · {adapter.version}
                </span>
                <p>{adapter.notes}</p>
              </div>
              <span
                className={`admin-adapter-status admin-adapter-status--${adapter.status}`}
              >
                {adapterStatusLabels[adapter.status]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-audit-panel" aria-labelledby="events-heading">
        <div className="section-heading">
          <p className="section-heading__eyebrow">EVENT VERIFICATION</p>
          <h2 id="events-heading">活動確認狀態</h2>
        </div>
        <ul className="admin-event-list">
          {overview.data.recentEvents.map((event) => (
            <li key={event.id}>
              <div>
                <strong>{event.name}</strong>
                <span>{formatEventDate(event.startsAtUtc, "Asia/Taipei")}</span>
              </div>
              <button
                className="tr-button tr-button--secondary"
                type="button"
                disabled={verification.isPending}
                onClick={() =>
                  verification.mutate({
                    eventId: event.id,
                    isVerified: !event.isAdminVerified,
                  })
                }
              >
                {event.isAdminVerified ? "改為待確認" : "標記已確認"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-audit-panel" aria-labelledby="audit-heading">
        <div className="section-heading">
          <p className="section-heading__eyebrow">AUDIT LOG</p>
          <h2 id="audit-heading">最近稽核紀錄</h2>
        </div>
        {overview.data.recentAuditLogs.length === 0 ? (
          <p>目前沒有稽核紀錄。</p>
        ) : (
          <ul className="admin-audit-list">
            {overview.data.recentAuditLogs.map((log) => (
              <li key={log.id}>
                <strong>{log.action}</strong>
                <span>
                  {log.entityType} ·{" "}
                  {new Date(log.createdAtUtc).toLocaleString("zh-TW")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
