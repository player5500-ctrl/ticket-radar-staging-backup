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

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8787";

const demoHeaders = import.meta.env.DEV
  ? {
      "X-Demo-User-Id": "user-demo",
    }
  : {};

export type AuthSession = {
  authenticated: true;
  user: {
    id: string;
    email: string | null;
    displayName: string;
    role: "user" | "admin";
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  demoUserId = "user-demo",
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...demoHeaders,
      ...(import.meta.env.DEV ? { "X-Demo-User-Id": demoUserId } : {}),
      ...init.headers,
    },
  });

  const payload = (await response.json()) as ApiSuccess<T> | ApiError;
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
