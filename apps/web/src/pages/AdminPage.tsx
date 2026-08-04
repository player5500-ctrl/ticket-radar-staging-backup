import { useState } from "react";
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
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: api.adminOverview,
  });
  const verification = useMutation({
    mutationFn: ({ eventId, isVerified }: { eventId: string; isVerified: boolean }) =>
      api.setAdminEventVerified(eventId, isVerified),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
  });
  const eventSources = useQuery({
    queryKey: ["admin-event-sources"],
    queryFn: api.adminEventSources,
  });
  const eventCandidates = useQuery({
    queryKey: ["admin-event-candidates"],
    queryFn: api.adminEventCandidates,
  });
  const refreshEventSync = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-event-sources"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-event-candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };
  const sourceUpdate = useMutation({
    mutationFn: ({ sourceKey, enabled }: { sourceKey: string; enabled: boolean }) =>
      api.updateAdminEventSource(sourceKey, { enabled }),
    onSuccess: refreshEventSync,
  });
  const sourceSync = useMutation({
    mutationFn: api.syncAdminEventSource,
    onSuccess: refreshEventSync,
  });
  const candidateApprove = useMutation({
    mutationFn: api.approveAdminEventCandidate,
    onSuccess: refreshEventSync,
  });
  const candidateReject = useMutation({
    mutationFn: (candidateId: string) =>
      api.rejectAdminEventCandidate(candidateId, "Rejected during admin review"),
    onSuccess: refreshEventSync,
  });
  const candidateMerge = useMutation({
    mutationFn: ({
      candidateId,
      targetEventId,
    }: {
      candidateId: string;
      targetEventId: string;
    }) => api.mergeAdminEventCandidate(candidateId, targetEventId),
    onSuccess: refreshEventSync,
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

      <section className="admin-audit-panel" aria-labelledby="event-sources-heading">
        <div className="section-heading">
          <p className="section-heading__eyebrow">EVENT SOURCE CONTROL</p>
          <h2 id="event-sources-heading">外部來源控制</h2>
          <p>僅在條款、robots 與合作狀態皆已核准時，Worker 才允許啟用同步。</p>
        </div>
        {eventSources.isError ? (
          <p>無法載入外部來源清單。</p>
        ) : (
          <ul className="admin-adapter-list">
            {(eventSources.data ?? []).map((source) => (
              <li key={source.key}>
                <div>
                  <strong>{source.name}</strong>
                  <span>
                    {source.sourceCategory} ・ {source.status} ・{" "}
                    {source.agreementStatus}
                  </span>
                  <p>
                    條款：{source.termsStatus}／robots：{source.robotsStatus}／信任：
                    {source.trustLevel}
                    {source.lastError ? "／最近同步失敗" : ""}
                  </p>
                </div>
                <div className="admin-event-actions">
                  <button
                    className="tr-button tr-button--secondary"
                    type="button"
                    disabled={sourceUpdate.isPending}
                    onClick={() =>
                      sourceUpdate.mutate({
                        sourceKey: source.key,
                        enabled: !source.enabled,
                      })
                    }
                  >
                    {source.enabled ? "停用" : "啟用"}
                  </button>
                  <button
                    className="tr-button tr-button--secondary"
                    type="button"
                    disabled={!source.enabled || sourceSync.isPending}
                    onClick={() => sourceSync.mutate(source.key)}
                  >
                    手動排程同步
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-audit-panel" aria-labelledby="event-candidates-heading">
        <div className="section-heading">
          <p className="section-heading__eyebrow">CANDIDATE REVIEW</p>
          <h2 id="event-candidates-heading">活動候選審核</h2>
          <p>候選活動必須經管理員核准、拒絕，或合併到既有活動後才會離開待審狀態。</p>
        </div>
        {eventCandidates.isError ? (
          <p>無法載入活動候選清單。</p>
        ) : (
          <ul className="admin-event-list">
            {(eventCandidates.data ?? []).map((candidate) => (
              <li key={candidate.id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>
                    {candidate.status} ・ {candidate.city} ・ {candidate.startsAtUtc}
                  </span>
                  {candidate.sourceUrl ? (
                    <p>
                      <a href={candidate.sourceUrl} rel="noreferrer" target="_blank">
                        查看原始來源
                      </a>
                    </p>
                  ) : null}
                </div>
                {candidate.status === "pending_review" ? (
                  <div className="admin-event-actions">
                    <button
                      className="tr-button tr-button--secondary"
                      disabled={candidateApprove.isPending}
                      type="button"
                      onClick={() => candidateApprove.mutate(candidate.id)}
                    >
                      核准
                    </button>
                    <button
                      className="tr-button tr-button--secondary"
                      disabled={candidateReject.isPending}
                      type="button"
                      onClick={() => candidateReject.mutate(candidate.id)}
                    >
                      拒絕
                    </button>
                    <input
                      aria-label={`${candidate.name} 的既有活動 ID`}
                      onChange={(event) =>
                        setMergeTargets((current) => ({
                          ...current,
                          [candidate.id]: event.target.value,
                        }))
                      }
                      placeholder="既有活動 ID"
                      value={mergeTargets[candidate.id] ?? ""}
                    />
                    <button
                      className="tr-button tr-button--secondary"
                      disabled={
                        candidateMerge.isPending || !mergeTargets[candidate.id]?.trim()
                      }
                      type="button"
                      onClick={() =>
                        candidateMerge.mutate({
                          candidateId: candidate.id,
                          targetEventId: mergeTargets[candidate.id]!.trim(),
                        })
                      }
                    >
                      合併
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
