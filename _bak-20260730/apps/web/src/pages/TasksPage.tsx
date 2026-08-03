import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEventDate } from "@ticket-radar/shared";
import { Button } from "@ticket-radar/ui";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { downloadReminderIcs } from "../services/ics";
import { api } from "../services/api";

export function TasksPage() {
  const client = useQueryClient();
  const tasks = useQuery({ queryKey: ["ticket-tasks"], queryFn: api.ticketTasks });
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: api.reminders });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["ticket-tasks"] }),
      client.invalidateQueries({ queryKey: ["reminders"] }),
    ]);
  const checklist = useMutation({
    mutationFn: ({
      taskId,
      itemId,
      done,
    }: {
      taskId: string;
      itemId: string;
      done: boolean;
    }) => api.setChecklistItem(taskId, itemId, done),
    onSuccess: refresh,
  });
  const pause = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "paused" }) =>
      api.updateTicketTask(id, { status }),
    onSuccess: refresh,
  });

  if (tasks.isPending || reminders.isPending)
    return (
      <div className="page-container detail-loading">
        <LoadingState label="正在整理你的購票準備…" />
      </div>
    );
  if (tasks.isError || reminders.isError)
    return (
      <div className="page-container detail-loading">
        <ErrorState
          message="無法讀取購票任務，請稍後重試。"
          onRetry={() => {
            void tasks.refetch();
            void reminders.refetch();
          }}
        />
      </div>
    );

  return (
    <div className="page-container tasks-page">
      <header className="page-heading">
        <p className="section-heading__eyebrow">MY MISSION CONTROL</p>
        <h1>購票任務</h1>
        <p>這裡只協助你整理準備與提醒；選票、排隊、送單與付款都由你親自完成。</p>
      </header>
      {tasks.data.length === 0 ? (
        <section className="empty-state">
          <span>✓</span>
          <h3>還沒有購票任務</h3>
          <p>從活動詳情建立任務，設定預算、票數與區域順位。</p>
        </section>
      ) : (
        <div className="task-list">
          {tasks.data.map((task) => (
            <article className="task-card" key={task.id}>
              <div className="task-card__heading">
                <div>
                  <p>{task.status === "active" ? "進行中" : "已暫停"}</p>
                  <h2>{task.eventName}</h2>
                  <time>{formatEventDate(task.eventStartsAtUtc, task.timezone)}</time>
                </div>
                <strong>
                  {task.readinessPercent}%<small>準備度</small>
                </strong>
              </div>
              <dl className="task-card__facts">
                <div>
                  <dt>預算</dt>
                  <dd>
                    {task.budgetTwd
                      ? `NT$ ${task.budgetTwd.toLocaleString()}`
                      : "尚未設定"}
                  </dd>
                </div>
                <div>
                  <dt>張數</dt>
                  <dd>
                    {task.maxTicketCount ? `${task.maxTicketCount} 張以內` : "尚未設定"}
                  </dd>
                </div>
                <div>
                  <dt>區域順位</dt>
                  <dd>{task.areaPreferences.join(" → ") || "尚未設定"}</dd>
                </div>
              </dl>
              <div className="task-card__checklist">
                {task.checklist.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      disabled={checklist.isPending}
                      onChange={(event) =>
                        checklist.mutate({
                          taskId: task.id,
                          itemId: item.id,
                          done: event.target.checked,
                        })
                      }
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="task-card__actions">
                <Button
                  variant="secondary"
                  disabled={pause.isPending}
                  onClick={() =>
                    pause.mutate({
                      id: task.id,
                      status: task.status === "active" ? "paused" : "active",
                    })
                  }
                >
                  {task.status === "active" ? "暫停任務" : "恢復任務"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <section className="reminder-section">
        <div className="section-heading">
          <div>
            <span className="section-heading__eyebrow">REMINDERS</span>
            <h2>提醒與行事曆</h2>
          </div>
        </div>
        {reminders.data.length === 0 ? (
          <p className="empty-copy">尚未建立提醒。可在活動詳情選擇售票階段後加入。</p>
        ) : (
          <div className="reminder-list">
            {reminders.data.map((reminder) => (
              <div className="reminder-item" key={reminder.id}>
                <div>
                  <strong>{reminder.eventName}</strong>
                  <p>
                    {formatEventDate(reminder.scheduledAtUtc, reminder.timezone)} ·{" "}
                    {reminder.channel === "ics" ? "行事曆" : "網頁提醒"}
                  </p>
                </div>
                <Button variant="ghost" onClick={() => downloadReminderIcs(reminder)}>
                  匯出 ICS
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
