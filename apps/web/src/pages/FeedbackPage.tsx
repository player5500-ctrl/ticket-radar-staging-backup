import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { BetaReportCategory } from "@ticket-radar/shared";
import { useLocation } from "react-router-dom";

import { api } from "../services/api";
import { describeBrowser, describeDevice } from "./feedback-device";

const categoryLabels: Record<BetaReportCategory, string> = {
  search: "搜尋",
  event_data: "活動資料",
  favorite: "收藏",
  ticket_task: "購票任務",
  reminder: "提醒",
  purchase_record: "購票紀錄",
  extension: "Extension",
  login: "登入",
  ui_ux: "UI / UX",
  other: "其他",
};

function initialLocalDateTime() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function readMaskedScreenshot(file: File): Promise<string> {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("截圖只接受 JPEG、PNG 或 WebP。");
  if (file.size > 500 * 1024) {
    throw new Error("請先遮罩、裁切或壓縮截圖至 500 KB 以下。");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("無法讀取截圖。"));
    };
    reader.onerror = () => reject(new Error("無法讀取截圖。"));
    reader.readAsDataURL(file);
  });
}

export function FeedbackPage() {
  const location = useLocation();
  const sourcePath = useMemo(() => {
    const from = new URLSearchParams(location.search).get("from") ?? "/feedback";
    return from.startsWith("/") ? from.split(/[?#]/, 1)[0] || "/" : "/feedback";
  }, [location.search]);
  const [category, setCategory] = useState<BetaReportCategory>("other");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(initialLocalDateTime);
  const [contact, setContact] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [screenshotLabel, setScreenshotLabel] = useState("未附加截圖");
  const [fileError, setFileError] = useState<string | null>(null);
  const session = useQuery({ queryKey: ["auth-session"], queryFn: api.session });
  const browser = describeBrowser(navigator.userAgent);
  const device = describeDevice(navigator.userAgent);
  const report = useMutation({ mutationFn: api.createBetaReport });

  async function onScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileError(null);
    setScreenshotDataUrl(null);
    setScreenshotLabel("未附加截圖");
    if (!file) return;
    try {
      setScreenshotDataUrl(await readMaskedScreenshot(file));
      setScreenshotLabel(`${file.name}（已準備上傳）`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "無法讀取截圖。");
      event.target.value = "";
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    report.mutate({
      pagePath: sourcePath,
      category,
      description,
      occurredAtUtc: new Date(occurredAt).toISOString(),
      browser,
      device,
      screenshotDataUrl,
      contact: contact.trim() || null,
      sensitiveDataConfirmedAbsent: true,
    });
  }

  if (report.isSuccess) {
    return (
      <div className="feedback-page">
        <section className="feedback-card" role="status">
          <p className="section-heading__eyebrow">INTERNAL CLOSED BETA</p>
          <h1>已收到問題回報</h1>
          <p>回報編號：{report.data.id}</p>
          <p>產品團隊會依 P0～P3 分級處理；若涉及資料或權限風險，會立即暫停測試。</p>
          <button
            className="tr-button tr-button--secondary"
            type="button"
            onClick={() => report.reset()}
          >
            再回報一筆
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <header className="page-heading">
        <p className="section-heading__eyebrow">INTERNAL CLOSED BETA</p>
        <h1>Beta 問題回報</h1>
        <p>請只提供重現問題所需的最低限度資訊。</p>
      </header>

      <section className="feedback-card" aria-label="目前測試者">
        <strong>{session.data?.user.displayName ?? "已登入測試者"}</strong>
        <span>
          角色：{session.data?.user.role === "admin" ? "ROLE_ADMIN" : "ROLE_USER"}
        </span>
      </section>

      <form className="feedback-form" onSubmit={onSubmit}>
        <label>
          發生頁面
          <input value={sourcePath} readOnly />
        </label>
        <label>
          問題類型
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as BetaReportCategory)}
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          發生時間
          <input
            type="datetime-local"
            required
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </label>
        <label>
          Browser
          <input value={browser} readOnly />
        </label>
        <label>
          Device
          <input value={device} readOnly />
        </label>
        <label className="feedback-form__wide">
          問題描述
          <textarea
            minLength={10}
            maxLength={2000}
            required
            rows={7}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="feedback-form__wide">
          可選聯絡方式
          <input
            maxLength={200}
            placeholder="Email 或其他可聯絡方式；可留空"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
          />
        </label>
        <label className="feedback-form__wide">
          可選遮罩截圖（JPEG / PNG / WebP，500 KB 以下）
          <input
            accept="image/jpeg,image/png,image/webp"
            type="file"
            onChange={(event) => void onScreenshotChange(event)}
          />
          <span className="feedback-help">{screenshotLabel}</span>
          {fileError ? (
            <span className="feedback-error" role="alert">
              {fileError}
            </span>
          ) : null}
        </label>
        <label className="feedback-confirm feedback-form__wide">
          <input
            checked={confirmed}
            type="checkbox"
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>
            我已確認內容與截圖不含密碼、OTP、信用卡資料、CAPTCHA 或未遮罩票券資訊。
          </span>
        </label>
        {report.isError ? (
          <p className="feedback-error feedback-form__wide" role="alert">
            {report.error.message}
          </p>
        ) : null}
        <button
          className="tr-button tr-button--primary feedback-form__wide"
          disabled={!confirmed || report.isPending}
          type="submit"
        >
          {report.isPending ? "正在送出…" : "送出 Beta 回報"}
        </button>
      </form>
    </div>
  );
}
