import type {
  ApiError,
  ApiSuccess,
  EventDetail,
  HomeResponse,
  Reminder,
  ReminderInput,
  SearchQuery,
  SearchResponse,
  TicketTask,
  TicketTaskInput,
  TicketTaskUpdate,
  PurchaseRecord,
  PurchaseRecordInput,
  AdminOverview,
  AdminEvent,
} from "@ticket-radar/shared";

/** 單一請求上限。超過就當成連線問題結束，避免 Access 互動式登入流程讓畫面無限 loading。 */
const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Staging／Production 一律走同源 `/api/*`（由 Pages Function 轉發到 Worker），
 * 只有本機開發預設直連 `127.0.0.1:8787`。
 *
 * 非本機 build 若拿到跨網域的絕對網址（例如 Pages 專案裡殘留舊的
 * `VITE_API_BASE_URL=https://ticket-radar-api-staging.vannyai.workers.dev`），
 * 會被忽略並改回同源——跨網域就是 TASK-01 的病灶，不能讓殘留設定把它帶回來。
 */
function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim() ?? "";
  const value = configured || (import.meta.env.DEV ? "http://127.0.0.1:8787" : "");
  const normalized = value.replace(/\/+$/, "");
  if (!normalized || import.meta.env.DEV) return normalized;
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(normalized)) {
    console.warn(
      `[api] 已忽略跨網域 VITE_API_BASE_URL（${normalized}），改用同源 /api 路徑。`,
    );
    return "";
  }
  return normalized;
}

const apiBaseUrl = resolveApiBaseUrl();

const demoHeaders = import.meta.env.DEV
  ? {
      "X-Demo-User-Id": "user-demo",
    }
  : {};

function timeoutSignal(): AbortSignal | null {
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : null;
}

export type AuthSession = {
  authenticated: true;
  user: {
    id: string;
    email: string | null;
    displayName: string;
    role: "user" | "admin";
  };
};

/** 需要重新登入才可能恢復的錯誤碼（不含 ADMIN_REQUIRED——那是權限不足，不是未登入）。 */
const AUTH_ERROR_CODES = new Set(["AUTH_REQUIRED", "SESSION_EXPIRED"]);

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** true 代表「登入 session 沒了」，UI 應該引導重新登入而不是顯示一般錯誤。 */
  get isAuthError(): boolean {
    return this.status === 401 || AUTH_ERROR_CODES.has(this.code);
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiClientError && error.isAuthError;
}

const SESSION_EXPIRED_MESSAGE = "登入 Session 已失效，請重新登入。";

async function request<T>(
  path: string,
  init: RequestInit = {},
  demoUserId = "user-demo",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: "include",
      // Cloudflare Access 未登入時會回 3xx 導向互動式登入頁；fetch 永遠無法完成那個流程，
      // 所以不跟隨導向，直接讓下面的判斷把它轉成明確的 session 失效錯誤。
      redirect: "manual",
      signal: init.signal ?? timeoutSignal(),
      headers: {
        Accept: "application/json",
        ...demoHeaders,
        ...(import.meta.env.DEV ? { "X-Demo-User-Id": demoUserId } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiClientError("連線逾時。", "TIMEOUT", 0);
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiClientError("請求已取消。", "ABORTED", 0);
    }
    // 含 CSP 擋下跨網域 Access 導向、離線、DNS 失敗等。
    throw new ApiClientError("無法連線到伺服器。", "NETWORK_ERROR", 0);
  }

  // redirect: "manual" 下，3xx 會變成 status 0 的 opaqueredirect 回應。
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400)
  ) {
    throw new ApiClientError(SESSION_EXPIRED_MESSAGE, "SESSION_EXPIRED", 401);
  }

  // Access 攔截或轉發層出錯時可能回 HTML；不能直接丟給 response.json()。
  if (!(response.headers.get("Content-Type") ?? "").includes("application/json")) {
    if (response.status === 401 || response.status === 403) {
      throw new ApiClientError(SESSION_EXPIRED_MESSAGE, "SESSION_EXPIRED", 401);
    }
    throw new ApiClientError(
      "API 回應格式不正確。",
      "UNEXPECTED_RESPONSE",
      response.status,
    );
  }

  let payload: ApiSuccess<T> | ApiError;
  try {
    payload = (await response.json()) as ApiSuccess<T> | ApiError;
  } catch {
    throw new ApiClientError(
      "API 回應格式不正確。",
      "UNEXPECTED_RESPONSE",
      response.status,
    );
  }

  if (!response.ok || "error" in payload) {
    const error =
      "error" in payload
        ? payload.error
        : { code: "UNKNOWN_ERROR", message: "API 回應格式不正確。" };
    throw new ApiClientError(error.message, error.code, response.status);
  }

  return payload.data;
}

export const api = {
  home: () => request<HomeResponse>("/api/v1/home"),
  search: (query: SearchQuery) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return request<SearchResponse>(`/api/v1/search?${params.toString()}`);
  },
  event: (id: string) => request<EventDetail>(`/api/v1/events/${id}`),
  favorite: (id: string, shouldFavorite: boolean) =>
    request<{ eventId: string; isFavorited: boolean }>(
      `/api/v1/events/${id}/favorite`,
      { method: shouldFavorite ? "POST" : "DELETE" },
    ),
  follow: (id: string, shouldFollow: boolean) =>
    request<{ artistId: string; isFollowed: boolean }>(`/api/v1/artists/${id}/follow`, {
      method: shouldFollow ? "POST" : "DELETE",
    }),
  ticketTasks: () => request<TicketTask[]>("/api/v1/ticket-tasks"),
  createTicketTask: (input: TicketTaskInput) =>
    request<TicketTask>("/api/v1/ticket-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateTicketTask: (id: string, input: TicketTaskUpdate) =>
    request<TicketTask>(`/api/v1/ticket-tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  setChecklistItem: (taskId: string, itemId: string, isCompleted: boolean) =>
    request<TicketTask>(`/api/v1/ticket-tasks/${taskId}/checklist/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isCompleted }),
    }),
  reminders: () => request<Reminder[]>("/api/v1/reminders"),
  createReminder: (input: ReminderInput) =>
    request<Reminder>("/api/v1/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  purchaseRecords: () => request<PurchaseRecord[]>("/api/v1/purchase-records"),
  createPurchaseRecord: (input: PurchaseRecordInput) =>
    request<PurchaseRecord>("/api/v1/purchase-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  adminOverview: () =>
    request<AdminOverview>("/api/v1/admin/overview", {}, "admin-demo"),
  setAdminEventVerified: (eventId: string, isVerified: boolean) =>
    request<AdminEvent>(
      `/api/v1/admin/events/${eventId}/verification`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified }),
      },
      "admin-demo",
    ),
  session: () => request<AuthSession>("/api/v1/auth/session"),
  logout: () =>
    request<{ logoutUrl: string }>("/api/v1/auth/logout", { method: "POST" }),
};
