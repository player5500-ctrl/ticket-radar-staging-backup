import { ApiClientError } from "./api";

/**
 * 把 API 錯誤翻成「給使用者看的文案」（TASK-05）。
 *
 * 規則：Staging／Production 只顯示一般使用者能理解的訊息；技術性線索（錯誤碼、HTTP
 * 狀態、本機服務提示）只在本機開發顯示。所有頁面共用同一組文案與同一個錯誤卡片元件，
 * 避免各頁自己寫一句「請確認本機 Worker 與 D1 已啟動」這種只在本機成立的話。
 */

export type ApiErrorKind =
  | "auth"
  | "forbidden"
  | "not-found"
  | "rate-limit"
  | "network"
  | "timeout"
  | "server"
  | "unknown";

export type ResolvedApiError = {
  kind: ApiErrorKind;
  title: string;
  message: string;
  /** 只有本機開發才會有值：原始錯誤碼／狀態，方便除錯。 */
  technical: string | null;
  /** 這個錯誤重試有意義嗎（沒意義的話不要顯示「重新連線」）。 */
  canRetry: boolean;
};

function classify(error: unknown): ApiErrorKind {
  if (!(error instanceof ApiClientError)) return "unknown";
  if (error.isAuthError) return "auth";
  if (error.code === "TIMEOUT") return "timeout";
  if (error.code === "NETWORK_ERROR") return "network";
  if (error.code === "RATE_LIMITED" || error.status === 429) return "rate-limit";
  if (error.code === "ADMIN_REQUIRED" || error.status === 403) return "forbidden";
  if (error.status === 404) return "not-found";
  if (error.status >= 500 || error.code === "UNEXPECTED_RESPONSE") return "server";
  return "unknown";
}

function technicalDetail(error: unknown): string | null {
  if (!import.meta.env.DEV) return null;
  if (error instanceof ApiClientError) {
    const status = error.status > 0 ? ` · HTTP ${error.status}` : "";
    return `${error.code}${status}：${error.message}`;
  }
  return error instanceof Error ? `${error.name}：${error.message}` : String(error);
}

/**
 * @param subject 這次讀不到的東西，用於組句子，例如「活動」「購票任務」。
 */
export function resolveApiError(error: unknown, subject = "資料"): ResolvedApiError {
  const kind = classify(error);
  const technical = technicalDetail(error);
  const base = { kind, technical };

  switch (kind) {
    case "auth":
      return {
        ...base,
        title: "請重新登入",
        message: "登入 Session 已失效或已登出，請重新登入後再繼續。",
        canRetry: false,
      };
    case "forbidden":
      return {
        ...base,
        title: "沒有存取權限",
        message: `你的帳號沒有檢視${subject}的權限。`,
        canRetry: false,
      };
    case "not-found":
      return {
        ...base,
        title: `找不到${subject}`,
        message: `這筆${subject}可能已被移除，或連結不正確。`,
        canRetry: false,
      };
    case "rate-limit":
      return {
        ...base,
        title: "請求過於頻繁",
        message: "短時間內操作太多次，請稍等一分鐘再試。",
        canRetry: true,
      };
    case "network":
      return {
        ...base,
        title: "連線中斷",
        message: import.meta.env.DEV
          ? "無法連線到本機 Worker，請確認 API（127.0.0.1:8787）與本機 D1 已啟動。"
          : "目前無法連線到伺服器，請確認網路後再試一次。",
        canRetry: true,
      };
    case "timeout":
      return {
        ...base,
        title: "連線逾時",
        message: `伺服器太久沒有回應，暫時無法取得${subject}，請稍後再試。`,
        canRetry: true,
      };
    case "server":
      return {
        ...base,
        title: "暫時無法取得資料",
        message: `伺服器暫時無法提供${subject}，請稍後再試。`,
        canRetry: true,
      };
    default:
      return {
        ...base,
        title: "暫時無法取得資料",
        message: `暫時無法取得${subject}，請稍後再試。`,
        canRetry: true,
      };
  }
}
