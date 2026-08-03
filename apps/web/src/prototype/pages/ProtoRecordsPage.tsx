import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";
import { api } from "../../services/api";

const orderStatusLabels: Record<string, { label: string; tone: string; icon: string }> = {
  created: { label: "訂單已成立", tone: "var(--proto-neon-green)", icon: "✅" },
  unconfirmed: { label: "狀態待確認", tone: "var(--proto-neon-yellow)", icon: "⏳" },
};

export function ProtoRecordsPage() {
  const records = useQuery({
    queryKey: ["purchase-records"],
    queryFn: api.purchaseRecords,
  });

  if (records.isPending) {
    return (
      <div className="proto-card" style={{ textAlign: "center", padding: "50px" }}>
        <div style={{ fontSize: "2rem" }}>📂</div>
        <h3 style={{ color: "var(--proto-neon-cyan)" }}>正在讀取本機安全購票紀錄...</h3>
      </div>
    );
  }

  if (records.isError) {
    return (
      <div className="proto-card" style={{ border: "2px solid var(--proto-neon-pink)", padding: "20px" }}>
        <h3 style={{ color: "var(--proto-neon-pink)", margin: "0 0 6px 0" }}>⚠️ 無法載入購票紀錄</h3>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1" }}>請確認連線狀態或重新登入。</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: "0.72rem", color: "var(--proto-neon-cyan)", fontWeight: 900, letterSpacing: "0.08em" }}>
          LOCAL-SAFE RECORDS
        </span>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "2px 0 6px 0" }}>
          購票紀錄與本機截圖
        </h1>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: 0 }}>
          雲端僅保存遮罩後訂單參考、張數與本機截圖檔名。<strong>原始個資與截圖絕不上傳。</strong>
        </p>
      </div>

      {records.data && records.data.length === 0 ? (
        <div className="proto-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <span style={{ fontSize: "2.5rem" }}>▤</span>
          <h3 style={{ fontSize: "1.1rem", margin: "10px 0 4px 0" }}>尚無購票紀錄</h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            於受控 Generic Demo 頁面完成手動訂單送出後，系統將自動整理本機紀錄。
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {records.data?.map((rec) => {
            const statusInfo = orderStatusLabels[rec.orderStatus] ?? orderStatusLabels.unconfirmed ?? { label: "訂單已成立", tone: "var(--proto-neon-green)", icon: "✅" };
            return (
              <article key={rec.id} className="proto-card" style={{ border: "1.5px solid var(--proto-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        background: "rgba(255, 255, 255, 0.08)",
                        color: statusInfo.tone,
                        border: "1px solid currentColor",
                        padding: "3px 10px",
                        borderRadius: "999px",
                        fontWeight: 900,
                      }}
                    >
                      {statusInfo.icon} {statusInfo.label}
                    </span>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "8px 0 4px 0" }}>
                      {rec.eventName}
                    </h2>
                    <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>
                      🕒 {formatEventDate(rec.orderCreatedAtUtc, "Asia/Taipei")}
                    </p>
                  </div>

                  <span style={{ fontSize: "0.75rem", background: "rgba(0, 242, 254, 0.15)", color: "var(--proto-neon-cyan)", padding: "4px 8px", borderRadius: "6px" }}>
                    {rec.source === "extension_demo" ? "Demo 驗證" : rec.source}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", background: "rgba(6, 11, 23, 0.6)", padding: "12px", borderRadius: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>遮罩訂單號</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--proto-neon-yellow)" }}>
                      {rec.orderReferenceMasked}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>張數與區域</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                      {rec.ticketCount} 張 · {rec.seatOrAreaMasked || "未記錄"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>本機截圖檔名</span>
                    <div style={{ fontSize: "0.82rem", color: "var(--proto-neon-cyan)", fontFamily: "monospace" }}>
                      🖼️ {rec.screenshotFilename || "未保存本機圖"}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
