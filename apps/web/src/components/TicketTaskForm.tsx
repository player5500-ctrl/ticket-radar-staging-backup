import { Button } from "@ticket-radar/ui";
import { useEffect, useId, useRef, useState } from "react";

import type { TicketTaskInput } from "@ticket-radar/shared";

import { resolveApiError } from "../services/apiErrors";

/** 送出時只交出 eventId 以外的欄位，eventId 由呼叫端補上。 */
export type TicketTaskFormValues = Omit<TicketTaskInput, "eventId">;

const MAX_SESSIONS = 8;
const MAX_AREAS = 3;
const MAX_TICKETS = 20;
const MAX_BUDGET = 1_000_000;

/** 順位輸入：文字輸入 + 新增，結果是一組有序的 chip，可調整順序或移除。 */
function OrderedListField({
  label,
  hint,
  placeholder,
  max,
  values,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  max: number;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const isFull = values.length >= max;

  function add() {
    const value = draft.trim();
    if (!value || isFull || values.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  }

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    const moved = next[index];
    const swapped = next[target];
    if (moved === undefined || swapped === undefined) return;
    next[index] = swapped;
    next[target] = moved;
    onChange(next);
  }

  return (
    <div className="task-form__field">
      <label htmlFor={inputId}>{label}</label>
      <p className="task-form__hint">{hint}</p>
      <div className="task-form__adder">
        <input
          id={inputId}
          value={draft}
          placeholder={placeholder}
          disabled={isFull}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            // 避免在對話框裡按 Enter 直接送出整份表單。
            event.preventDefault();
            add();
          }}
        />
        <Button variant="secondary" disabled={isFull || !draft.trim()} onClick={add}>
          新增
        </Button>
      </div>
      {values.length > 0 && (
        <ol className="task-form__chips">
          {values.map((value, index) => (
            <li key={value}>
              <span className="task-form__chip-rank">{index + 1}</span>
              <span className="task-form__chip-label">{value}</span>
              <button
                type="button"
                aria-label={`${value} 往前一位`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${value} 往後一位`}
                disabled={index === values.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`移除 ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
      {isFull && <p className="task-form__hint">已達上限 {max} 項。</p>}
    </div>
  );
}

/**
 * 建立購票任務的表單對話框（TASK-02）。
 * 只收集「準備資訊」：預算、張數、可接受場次順位、可接受區域順位、備註。
 * 不收集帳密、付款或驗證資料。
 */
export function TicketTaskForm({
  eventName,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: {
  eventName: string;
  isSubmitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (values: TicketTaskFormValues) => void;
}) {
  const titleId = useId();
  const budgetId = useId();
  const ticketCountId = useId();
  const notesId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState("");
  const [ticketCount, setTicketCount] = useState("2");
  const [sessions, setSessions] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function submit() {
    const parsedBudget = budget.trim() ? Number.parseInt(budget, 10) : null;
    const parsedCount = ticketCount.trim() ? Number.parseInt(ticketCount, 10) : null;
    onSubmit({
      budgetTwd: Number.isFinite(parsedBudget) ? parsedBudget : null,
      maxTicketCount: Number.isFinite(parsedCount) ? parsedCount : null,
      acceptableSessions: sessions,
      areaPreferences: areas,
      notes: notes.trim(),
    });
  }

  return (
    <div className="task-form__backdrop" onClick={onClose}>
      <div
        className="task-form"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="task-form__header">
          <div>
            <p className="section-heading__eyebrow">NEW TICKET TASK</p>
            <h2 id={titleId}>建立購票任務</h2>
            <p className="task-form__event">{eventName}</p>
          </div>
          <button
            className="task-form__close"
            type="button"
            aria-label="關閉"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <form
          className="task-form__body"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="task-form__row">
            <div className="task-form__field">
              <label htmlFor={budgetId}>每張預算上限（NT$）</label>
              <p className="task-form__hint">選填，只用來提醒你自己的上限。</p>
              <input
                id={budgetId}
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_BUDGET}
                step={100}
                value={budget}
                placeholder="例如 4800"
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
            <div className="task-form__field">
              <label htmlFor={ticketCountId}>最多購買張數</label>
              <p className="task-form__hint">1 至 {MAX_TICKETS} 張。</p>
              <input
                id={ticketCountId}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_TICKETS}
                value={ticketCount}
                onChange={(event) => setTicketCount(event.target.value)}
              />
            </div>
          </div>

          <OrderedListField
            label="可接受場次順位"
            hint={`最多 ${MAX_SESSIONS} 項，順序即優先順位。`}
            placeholder="例如 7/12 19:30 台北場"
            max={MAX_SESSIONS}
            values={sessions}
            onChange={setSessions}
          />

          <OrderedListField
            label="可接受區域順位"
            hint={`最多 ${MAX_AREAS} 項，順序即優先順位。`}
            placeholder="例如 搖滾區"
            max={MAX_AREAS}
            values={areas}
            onChange={setAreas}
          />

          <div className="task-form__field">
            <label htmlFor={notesId}>備註</label>
            <p className="task-form__hint">
              選填。請不要填入帳號、密碼、信用卡或驗證碼。
            </p>
            <textarea
              id={notesId}
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error != null && (
            <p className="task-form__error" role="alert">
              {resolveApiError(error, "購票任務").message}
            </p>
          )}

          <footer className="task-form__actions">
            <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "建立中…" : "送出任務設定"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
