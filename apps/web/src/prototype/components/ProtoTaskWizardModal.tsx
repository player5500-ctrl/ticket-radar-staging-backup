import React, { useState } from "react";
import type { TicketTaskInput } from "@ticket-radar/shared";

export type TaskWizardValues = Omit<TicketTaskInput, "eventId">;

export function ProtoTaskWizardModal({
  eventName,
  onClose,
  onSubmit,
}: {
  eventName: string;
  onClose: () => void;
  onSubmit: (values: TaskWizardValues) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Budget & Tickets
  const [budget, setBudget] = useState("4800");
  const [ticketCount, setTicketCount] = useState("2");

  // Step 2: Sessions & Areas
  const [sessionInput, setSessionInput] = useState("");
  const [sessions, setSessions] = useState<string[]>(["2026-10-24 19:30 首場", "2026-10-25 18:00 加場"]);
  const [areaInput, setAreaInput] = useState("");
  const [areas, setAreas] = useState<string[]>(["搖滾 A 區", "看台 2 區"]);

  // Step 3: Notes & Consent
  const [notes, setNotes] = useState("");
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(true);

  function addSession() {
    if (!sessionInput.trim() || sessions.length >= 8) return;
    setSessions([...sessions, sessionInput.trim()]);
    setSessionInput("");
  }

  function addArea() {
    if (!areaInput.trim() || areas.length >= 3) return;
    setAreas([...areas, areaInput.trim()]);
    setAreaInput("");
  }

  function handleSubmit() {
    const parsedBudget = budget.trim() ? parseInt(budget, 10) : null;
    const parsedCount = ticketCount.trim() ? parseInt(ticketCount, 10) : null;
    onSubmit({
      budgetTwd: parsedBudget,
      maxTicketCount: parsedCount,
      acceptableSessions: sessions,
      areaPreferences: areas,
      notes: notes.trim(),
    });
  }

  return (
    <div className="proto-modal-backdrop" onClick={onClose}>
      <div
        className="proto-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ color: "#f8fafc" }}
      >
        {/* Step Indicator */}
        <div className="proto-wizard-steps">
          <div className={`proto-wizard-step-dot ${step >= 1 ? "proto-wizard-step-dot--active" : ""}`}>1</div>
          <div style={{ flex: 1, height: "2px", background: step >= 2 ? "var(--proto-neon-cyan)" : "#334155", margin: "0 8px" }} />
          <div className={`proto-wizard-step-dot ${step >= 2 ? "proto-wizard-step-dot--active" : ""}`}>2</div>
          <div style={{ flex: 1, height: "2px", background: step >= 3 ? "var(--proto-neon-cyan)" : "#334155", margin: "0 8px" }} />
          <div className={`proto-wizard-step-dot ${step >= 3 ? "proto-wizard-step-dot--active" : ""}`}>3</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "var(--proto-neon-cyan)", fontWeight: 900 }}>
              STEP {step} OF 3
            </span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 900, margin: "2px 0 0 0" }}>
              {step === 1 && "1. 設定預算與購票張數"}
              {step === 2 && "2. 排定場次與座位區域順位"}
              {step === 3 && "3. 備註與操作確認"}
            </h2>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "2px 0 0 0" }}>{eventName}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #334155",
              color: "#cbd5e1",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              fontSize: "1.1rem",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "6px" }}>
                💰 單張預算上限 (TWD)
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="例如: 4800"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#0b1329",
                  border: "1.5px solid var(--proto-border)",
                  color: "#fff",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "6px" }}>
                🎫 最大需求張數
              </label>
              <select
                value={ticketCount}
                onChange={(e) => setTicketCount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#0b1329",
                  border: "1.5px solid var(--proto-border)",
                  color: "#fff",
                  fontSize: "1rem",
                }}
              >
                {[1, 2, 3, 4, 6, 8].map((num) => (
                  <option key={num} value={num}>
                    {num} 張
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                className="proto-btn proto-btn-primary"
                onClick={() => setStep(2)}
                style={{ width: "100%" }}
              >
                下一步：設定區域順位 →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "6px" }}>
                🗓️ 可接受場次 (至多 8 項)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value)}
                  placeholder="如: 10/24 加場"
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    background: "#0b1329",
                    border: "1px solid var(--proto-border)",
                    color: "#fff",
                  }}
                />
                <button className="proto-btn proto-btn-secondary" onClick={addSession}>
                  ＋ 新增
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {sessions.map((s, idx) => (
                  <span
                    key={s}
                    style={{
                      background: "rgba(0, 242, 254, 0.15)",
                      border: "1px solid var(--proto-neon-cyan)",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      color: "var(--proto-neon-cyan)",
                    }}
                  >
                    #{idx + 1} {s}{" "}
                    <button
                      onClick={() => setSessions(sessions.filter((item) => item !== s))}
                      style={{ background: "none", border: "none", color: "#ff7597", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "6px" }}>
                📍 區域志願順位 (至多 3 項)
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="如: 搖滾A區"
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "10px",
                    background: "#0b1329",
                    border: "1px solid var(--proto-border)",
                    color: "#fff",
                  }}
                />
                <button className="proto-btn proto-btn-secondary" onClick={addArea}>
                  ＋ 新增
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {areas.map((a, idx) => (
                  <span
                    key={a}
                    style={{
                      background: "rgba(168, 85, 247, 0.2)",
                      border: "1px solid var(--proto-neon-violet)",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "0.8rem",
                      color: "#e9d5ff",
                    }}
                  >
                    順位 {idx + 1}: {a}{" "}
                    <button
                      onClick={() => setAreas(areas.filter((item) => item !== a))}
                      style={{ background: "none", border: "none", color: "#ff7597", cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button className="proto-btn proto-btn-ghost" onClick={() => setStep(1)} style={{ flex: 1 }}>
                ← 上一步
              </button>
              <button className="proto-btn proto-btn-primary" onClick={() => setStep(3)} style={{ flex: 2 }}>
                下一步：確認條款與送出 →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, marginBottom: "6px" }}>
                📝 任務備註與注意事項
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="提醒自己開賣前 10 分鐘完成認證登入..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "12px",
                  background: "#0b1329",
                  border: "1px solid var(--proto-border)",
                  color: "#fff",
                }}
              />
            </div>

            <div className="proto-disclaimer">
              <span className="proto-disclaimer-icon">⚠️</span>
              <div style={{ fontSize: "0.82rem", lineHeight: 1.4 }}>
                <strong>明確合規聲明：</strong>
                <p style={{ margin: "4px 0 0 0" }}>
                  本任務僅保存您的購票目標資訊與檢查清單，<strong>Ticket Radar 不會進行自動搶票、選位或付款</strong>。開賣時請由您親自於官方平台完成選票與結帳。
                </p>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agreedDisclaimer}
                onChange={(e) => setAgreedDisclaimer(e.target.checked)}
              />
              已了解並明白實際購票仍需手動操作
            </label>

            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button className="proto-btn proto-btn-ghost" onClick={() => setStep(2)} style={{ flex: 1 }}>
                ← 上一步
              </button>
              <button
                className="proto-btn proto-btn-battle"
                disabled={!agreedDisclaimer}
                onClick={handleSubmit}
                style={{ flex: 2, opacity: agreedDisclaimer ? 1 : 0.5 }}
              >
                🚀 完成建立任務
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
