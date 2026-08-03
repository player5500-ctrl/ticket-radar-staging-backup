import type {
  Reminder,
  ReminderInput,
  TicketTask,
  TicketTaskInput,
  TicketTaskUpdate,
} from "@ticket-radar/shared";

const checklistDefaults = [
  ["platform_account_created", "已確認售票平台帳號", 1],
  ["phone_verified", "已確認手機驗證狀態", 2],
  ["presale_eligibility_confirmed", "已確認預售／登記資格", 3],
  ["payment_method_confirmed", "已準備付款方式", 4],
  ["budget_set", "已設定預算", 5],
  ["area_preferences_set", "已設定區域順位", 6],
  ["acceptable_sessions_set", "已設定可接受場次", 7],
  ["max_ticket_count_set", "已設定最大張數", 8],
  ["notes_reviewed", "已閱讀任務備註", 9],
] as const;

type TaskRow = Omit<
  TicketTask,
  "acceptableSessions" | "areaPreferences" | "checklist" | "readinessPercent"
> & {
  acceptable_sessions_json: string;
  area_preferences_json: string;
};
type ChecklistRow = {
  id: string;
  item_key: string;
  label: string;
  is_applicable: number;
  is_completed: number;
  sort_order: number;
};
type ReminderRow = Omit<
  Reminder,
  "ticketTaskId" | "ticketSaleWindowId" | "scheduledAtUtc" | "customMessage"
> & {
  ticket_task_id: string | null;
  ticket_sale_window_id: string | null;
  scheduled_at_utc: string;
  custom_message: string | null;
};

function parseList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function mapTask(row: TaskRow, checklist: ChecklistRow[]): TicketTask {
  const items = checklist.map((item) => ({
    id: item.id,
    itemKey: item.item_key,
    label: item.label,
    isApplicable: Boolean(item.is_applicable),
    isCompleted: Boolean(item.is_completed),
    sortOrder: item.sort_order,
  }));
  const applicable = items.filter((item) => item.isApplicable);
  return {
    id: row.id,
    eventId: row.eventId,
    eventName: row.eventName,
    eventStartsAtUtc: row.eventStartsAtUtc,
    timezone: row.timezone,
    status: row.status,
    budgetTwd: row.budgetTwd,
    maxTicketCount: row.maxTicketCount,
    acceptableSessions: parseList(row.acceptable_sessions_json),
    areaPreferences: parseList(row.area_preferences_json),
    notes: row.notes,
    checklist: items,
    readinessPercent: applicable.length
      ? Math.round(
          (applicable.filter((item) => item.isCompleted).length / applicable.length) *
            100,
        )
      : 0,
    createdAtUtc: row.createdAtUtc,
    updatedAtUtc: row.updatedAtUtc,
  };
}

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    eventId: row.eventId,
    ticketTaskId: row.ticket_task_id,
    ticketSaleWindowId: row.ticket_sale_window_id,
    channel: row.channel,
    scheduledAtUtc: row.scheduled_at_utc,
    status: row.status,
    customMessage: row.custom_message,
    eventName: row.eventName,
    timezone: row.timezone,
  };
}

export class D1TicketTaskRepository {
  constructor(private readonly db: D1Database) {}

  private async checklist(taskId: string) {
    const result = await this.db
      .prepare(
        "SELECT id, item_key, label, is_applicable, is_completed, sort_order FROM ticket_task_checklists WHERE ticket_task_id = ? ORDER BY sort_order",
      )
      .bind(taskId)
      .all<ChecklistRow>();
    return result.results;
  }
  private async taskById(taskId: string, userId: string): Promise<TicketTask | null> {
    const row = await this.db
      .prepare(
        `SELECT t.id, t.event_id AS eventId, e.name AS eventName, e.starts_at_utc AS eventStartsAtUtc, e.timezone, t.status, t.budget_twd AS budgetTwd, t.max_ticket_count AS maxTicketCount, t.acceptable_sessions_json, t.area_preferences_json, t.notes, t.created_at_utc AS createdAtUtc, t.updated_at_utc AS updatedAtUtc FROM ticket_tasks t JOIN events e ON e.id = t.event_id WHERE t.id = ? AND t.user_id = ? AND t.deleted_at_utc IS NULL`,
      )
      .bind(taskId, userId)
      .first<TaskRow>();
    return row ? mapTask(row, await this.checklist(row.id)) : null;
  }
  async listTasks(userId: string): Promise<TicketTask[]> {
    const rows = await this.db
      .prepare(
        `SELECT t.id, t.event_id AS eventId, e.name AS eventName, e.starts_at_utc AS eventStartsAtUtc, e.timezone, t.status, t.budget_twd AS budgetTwd, t.max_ticket_count AS maxTicketCount, t.acceptable_sessions_json, t.area_preferences_json, t.notes, t.created_at_utc AS createdAtUtc, t.updated_at_utc AS updatedAtUtc FROM ticket_tasks t JOIN events e ON e.id = t.event_id WHERE t.user_id = ? AND t.deleted_at_utc IS NULL ORDER BY CASE t.status WHEN 'active' THEN 0 ELSE 1 END, t.updated_at_utc DESC`,
      )
      .bind(userId)
      .all<TaskRow>();
    return Promise.all(
      rows.results.map(async (row) => mapTask(row, await this.checklist(row.id))),
    );
  }
  async createTask(userId: string, input: TicketTaskInput): Promise<TicketTask | null> {
    const event = await this.db
      .prepare("SELECT id FROM events WHERE id = ? AND deleted_at_utc IS NULL")
      .bind(input.eventId)
      .first<{ id: string }>();
    if (!event) return null;
    const existing = await this.db
      .prepare(
        "SELECT id FROM ticket_tasks WHERE user_id = ? AND event_id = ? AND deleted_at_utc IS NULL",
      )
      .bind(userId, input.eventId)
      .first<{ id: string }>();
    // 同一個使用者對同一個活動只有一筆任務。以前這裡直接回傳既有任務，代表使用者在
    // 表單裡重新填的預算／張數／順位會被靜默丟掉；改成把新設定套用上去。
    if (existing) {
      return this.updateTask(existing.id, userId, {
        budgetTwd: input.budgetTwd ?? null,
        maxTicketCount: input.maxTicketCount ?? null,
        acceptableSessions: input.acceptableSessions,
        areaPreferences: input.areaPreferences,
        notes: input.notes,
      });
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      this.db
        .prepare(
          "INSERT INTO ticket_tasks (id, user_id, event_id, budget_twd, max_ticket_count, acceptable_sessions_json, area_preferences_json, notes, created_at_utc, updated_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          id,
          userId,
          input.eventId,
          input.budgetTwd ?? null,
          input.maxTicketCount ?? null,
          JSON.stringify(input.acceptableSessions),
          JSON.stringify(input.areaPreferences),
          input.notes,
          now,
          now,
        ),
      ...checklistDefaults.map(([key, label, sort]) =>
        this.db
          .prepare(
            "INSERT INTO ticket_task_checklists (id, ticket_task_id, item_key, label, sort_order, created_at_utc, updated_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(crypto.randomUUID(), id, key, label, sort, now, now),
      ),
    ];
    await this.db.batch(statements);
    return this.taskById(id, userId);
  }
  async updateTask(
    taskId: string,
    userId: string,
    input: TicketTaskUpdate,
  ): Promise<TicketTask | null> {
    const current = await this.taskById(taskId, userId);
    if (!current) return null;
    const next = {
      ...current,
      ...input,
      acceptableSessions: input.acceptableSessions ?? current.acceptableSessions,
      areaPreferences: input.areaPreferences ?? current.areaPreferences,
      notes: input.notes ?? current.notes,
    };
    await this.db
      .prepare(
        "UPDATE ticket_tasks SET status = ?, budget_twd = ?, max_ticket_count = ?, acceptable_sessions_json = ?, area_preferences_json = ?, notes = ?, updated_at_utc = ? WHERE id = ? AND user_id = ?",
      )
      .bind(
        next.status,
        next.budgetTwd,
        next.maxTicketCount,
        JSON.stringify(next.acceptableSessions),
        JSON.stringify(next.areaPreferences),
        next.notes,
        new Date().toISOString(),
        taskId,
        userId,
      )
      .run();
    return this.taskById(taskId, userId);
  }
  async setChecklistItem(
    taskId: string,
    itemId: string,
    userId: string,
    completed: boolean,
  ): Promise<TicketTask | null> {
    const task = await this.taskById(taskId, userId);
    if (!task) return null;
    await this.db
      .prepare(
        "UPDATE ticket_task_checklists SET is_completed = ?, completed_at_utc = ?, updated_at_utc = ? WHERE id = ? AND ticket_task_id = ? ",
      )
      .bind(
        completed ? 1 : 0,
        completed ? new Date().toISOString() : null,
        new Date().toISOString(),
        itemId,
        taskId,
      )
      .run();
    return this.taskById(taskId, userId);
  }
  async listReminders(userId: string): Promise<Reminder[]> {
    const rows = await this.db
      .prepare(
        "SELECT r.id, r.event_id AS eventId, r.ticket_task_id, r.ticket_sale_window_id, r.channel, r.scheduled_at_utc, r.status, r.custom_message, e.name AS eventName, e.timezone FROM reminders r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? ORDER BY r.scheduled_at_utc",
      )
      .bind(userId)
      .all<ReminderRow>();
    return rows.results.map(mapReminder);
  }
  async createReminder(userId: string, input: ReminderInput): Promise<Reminder | null> {
    const event = await this.db
      .prepare("SELECT id FROM events WHERE id = ? AND deleted_at_utc IS NULL")
      .bind(input.eventId)
      .first<{ id: string }>();
    if (!event) return null;
    if (input.ticketTaskId) {
      const task = await this.taskById(input.ticketTaskId, userId);
      if (!task || task.eventId !== input.eventId) return null;
    }
    if (input.ticketSaleWindowId) {
      const saleWindow = await this.db
        .prepare("SELECT id FROM ticket_sale_windows WHERE id = ? AND event_id = ?")
        .bind(input.ticketSaleWindowId, input.eventId)
        .first<{ id: string }>();
      if (!saleWindow) return null;
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const key = [
      input.eventId,
      input.ticketSaleWindowId ?? "event",
      input.channel,
      input.scheduledAtUtc,
    ].join(":");
    await this.db
      .prepare(
        "INSERT OR IGNORE INTO reminders (id, user_id, event_id, ticket_task_id, ticket_sale_window_id, channel, scheduled_at_utc, custom_message, idempotency_key, created_at_utc, updated_at_utc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        userId,
        input.eventId,
        input.ticketTaskId ?? null,
        input.ticketSaleWindowId ?? null,
        input.channel,
        input.scheduledAtUtc,
        input.customMessage ?? null,
        key,
        now,
        now,
      )
      .run();
    const row = await this.db
      .prepare(
        "SELECT r.id, r.event_id AS eventId, r.ticket_task_id, r.ticket_sale_window_id, r.channel, r.scheduled_at_utc, r.status, r.custom_message, e.name AS eventName, e.timezone FROM reminders r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? AND r.idempotency_key = ?",
      )
      .bind(userId, key)
      .first<ReminderRow>();
    return row ? mapReminder(row) : null;
  }
}
