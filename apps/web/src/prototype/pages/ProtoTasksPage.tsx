import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";
import { api } from "../../services/api";
import { downloadReminderIcs } from "../../services/ics";

export function ProtoTasksPage() {
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ["ticket-tasks"], queryFn: api.ticketTasks });
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: api.reminders });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ticket-tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] }),
    ]);

  const checklistMutation = useMutation({
    mutationFn: ({ taskId, itemId, done }: { taskId: string; itemId: string; done: boolean }) =>
      api.setChecklistItem(taskId, itemId, done),
    onSuccess: refresh,
  });

  const pauseMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      api.updateTicketTask(id, { status }),
    onSuccess: refresh,
  });

  if (tasks.isPending || reminders.isPending) {
    return (
      <div className="proto-card" style={{ textAlign: "center", padding: "50px" }}>
        <div style={{ fontSize: "2rem" }}>📊</div>
        <h3 style={{ color: "var(--proto-neon-cyan)" }}>正在運算購票準備度進度...</h3>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: "0.72rem", color: "var(--proto-neon-cyan)", fontWeight: 900, letterSpacing: "0.08em" }}>
          MISSION CONTROL
        </span>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 900, margin: "2px 0 6px 0" }}>
          購票任務與準備度
        </h1>
        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", margin: 0 }}>
          整理購票準備清單、預算、張數與區域志願。<strong>請手動至官方售票平台完成選票與送出。</strong>
        </p>
      </div>

      {/* Task List */}
      {tasks.data && tasks.data.length === 0 ? (
        <div className="proto-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <span style={{ fontSize: "2.5rem" }}>📋</span>
          <h3 style={{ fontSize: "1.1rem", margin: "10px 0 4px 0" }}>尚無購票任務</h3>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            請從「活動詳情」頁點擊「建立購票任務」，填寫志願與檢查清單。
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {tasks.data?.map((task) => {
            const completedCount = task.checklist.filter((i) => i.isCompleted).length;
            const totalCount = task.checklist.filter((i) => i.isApplicable).length;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            return (
              <article key={task.id} className="proto-card" style={{ border: task.status === "active" ? "2px solid var(--proto-neon-cyan)" : "1px solid #334155" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", background: task.status === "active" ? "rgba(0, 245, 212, 0.2)" : "rgba(148, 163, 184, 0.2)", color: task.status === "active" ? "#00f5d4" : "#94a3b8", padding: "2px 8px", borderRadius: "6px", fontWeight: 900 }}>
                      {task.status === "active" ? "⚡ 進行中" : "⏸️ 已暫停"}
                    </span>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 900, margin: "6px 0 2px 0" }}>
                      {task.eventName}
                    </h2>
                    <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>
                      📅 {formatEventDate(task.eventStartsAtUtc, task.timezone)}
                    </p>
                  </div>

                  {/* Readiness Progress Meter */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.4rem", fontWeight: 900, color: percent === 100 ? "var(--proto-neon-green)" : "var(--proto-neon-yellow)" }}>
                      {percent}%
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                      準備度 ({completedCount}/{totalCount})
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ width: "100%", height: "8px", background: "#060b17", borderRadius: "999px", overflow: "hidden", margin: "14px 0" }}>
                  <div
                    style={{
                      width: `${percent}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, var(--proto-neon-cyan), var(--proto-neon-green))",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* Facts Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", background: "rgba(6, 11, 23, 0.6)", padding: "12px", borderRadius: "12px", marginBottom: "14px" }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>預算上限</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                      {task.budgetTwd ? `NT$ ${task.budgetTwd.toLocaleString()}` : "未設定"}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>張數需求</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                      {task.maxTicketCount ? `${task.maxTicketCount} 張` : "未設定"}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>志願區域</span>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--proto-neon-cyan)" }}>
                      {task.areaPreferences.join(" → ") || "未設定"}
                    </div>
                  </div>
                </div>

                {/* Interactive Checklist */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 900, color: "var(--proto-neon-yellow)" }}>
                    ☑️ 開賣前準備事項 check-list
                  </span>
                  {task.checklist.map((item) => (
                    <label
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "0.88rem",
                        color: item.isCompleted ? "#94a3b8" : "#fff",
                        textDecoration: item.isCompleted ? "line-through" : "none",
                        cursor: "pointer",
                        background: "rgba(255, 255, 255, 0.03)",
                        padding: "8px 12px",
                        borderRadius: "8px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.isCompleted}
                        onChange={(e) =>
                          checklistMutation.mutate({
                            taskId: task.id,
                            itemId: item.id,
                            done: e.target.checked,
                          })
                        }
                        style={{ width: "18px", height: "18px", accentColor: "var(--proto-neon-cyan)" }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
                  <button
                    className="proto-btn proto-btn-ghost"
                    style={{ minHeight: "36px", fontSize: "0.8rem" }}
                    onClick={() =>
                      pauseMutation.mutate({
                        id: task.id,
                        status: task.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {task.status === "active" ? "⏸️ 暫停任務" : "▶️ 恢復任務"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Reminders & Calendar Section */}
      <section className="proto-card">
        <h2 style={{ fontSize: "1.15rem", fontWeight: 900, margin: "0 0 12px 0" }}>
          ⏰ 已設定開賣提醒 (.ics)
        </h2>
        {reminders.data && reminders.data.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {reminders.data.map((rem) => (
              <div
                key={rem.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(6, 11, 23, 0.6)",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(0, 242, 254, 0.2)",
                }}
              >
                <div>
                  <strong style={{ fontSize: "0.9rem" }}>{rem.eventName}</strong>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    🕒 {formatEventDate(rem.scheduledAtUtc, rem.timezone)} · 行事曆頻道
                  </div>
                </div>
                <button
                  className="proto-btn proto-btn-secondary"
                  style={{ minHeight: "34px", padding: "4px 10px", fontSize: "0.78rem" }}
                  onClick={() => downloadReminderIcs(rem)}
                >
                  📥 下載 .ics
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>
            尚未建立提醒，可在活動詳情頁的時間軸選擇售票階段並匯出。
          </p>
        )}
      </section>
    </div>
  );
}
