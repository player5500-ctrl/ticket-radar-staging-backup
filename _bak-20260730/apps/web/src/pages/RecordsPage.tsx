import { useQuery } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { api } from "../services/api";

const orderStatusLabels = {
  created: "訂單已成立",
  unconfirmed: "狀態待確認",
};

export function RecordsPage() {
  const records = useQuery({
    queryKey: ["purchase-records"],
    queryFn: api.purchaseRecords,
  });

  if (records.isPending) {
    return (
      <div className="page-container detail-loading">
        <LoadingState label="正在讀取遮罩後購票紀錄…" />
      </div>
    );
  }

  if (records.isError) {
    return (
      <div className="page-container detail-loading">
        <ErrorState
          message="無法讀取購票紀錄，請稍後重試。"
          onRetry={() => void records.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="page-container records-page">
      <header className="page-heading">
        <p className="section-heading__eyebrow">LOCAL-SAFE RECORDS</p>
        <h1>購票紀錄</h1>
        <p>雲端只保存遮罩後訂單參考、狀態與本機截圖檔名；原始截圖不會上傳。</p>
      </header>

      {records.data.length === 0 ? (
        <section className="empty-state">
          <span>▤</span>
          <h2>尚無購票紀錄</h2>
          <p>完成受控 Demo 後，可選擇保存遮罩後中繼資料。</p>
        </section>
      ) : (
        <div className="record-list">
          {records.data.map((record) => (
            <article className="record-card" key={record.id}>
              <div>
                <p className="record-card__status">
                  {orderStatusLabels[record.orderStatus]}
                </p>
                <h2>{record.eventName}</h2>
                <time dateTime={record.orderCreatedAtUtc}>
                  {formatEventDate(record.orderCreatedAtUtc, "Asia/Taipei")}
                </time>
              </div>
              <dl>
                <div>
                  <dt>訂單參考</dt>
                  <dd>{record.orderReferenceMasked}</dd>
                </div>
                <div>
                  <dt>張數</dt>
                  <dd>{record.ticketCount} 張</dd>
                </div>
                <div>
                  <dt>場次</dt>
                  <dd>{record.sessionLabel ?? "未記錄"}</dd>
                </div>
                <div>
                  <dt>區域</dt>
                  <dd>{record.seatOrAreaMasked ?? "未記錄"}</dd>
                </div>
                <div>
                  <dt>本機截圖</dt>
                  <dd>{record.screenshotFilename ?? "未保存"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
