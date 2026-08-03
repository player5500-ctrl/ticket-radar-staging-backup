import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ZodError } from "zod";

import {
  reminderInputSchema,
  purchaseRecordInputSchema,
  resourceIdSchema,
  searchQuerySchema,
  ticketTaskInputSchema,
  ticketTaskUpdateSchema,
} from "@ticket-radar/shared";

import {
  getOptionalUser,
  getOptionalUserId,
  requireAdminId,
  requireUserId,
} from "./auth";
import type { AppEnv } from "./env";
import { failure, success } from "./http";
import {
  D1EventRepository,
  type EventRepository,
} from "./repositories/event.repository";
import { EventService } from "./services/event.service";
import { D1TicketTaskRepository } from "./repositories/ticket-task.repository";
import { TicketTaskService } from "./services/ticket-task.service";
import { D1PurchaseRepository } from "./repositories/purchase.repository";
import { D1AdminRepository } from "./repositories/admin.repository";
import { enforceRateLimit } from "./rate-limit";

type AppDependencies = {
  repositoryFactory?: (database: D1Database) => EventRepository;
};

export function createApp(dependencies: AppDependencies = {}) {
  const app = new Hono<AppEnv>();

  app.use("*", async (context, next) => {
    context.set("requestId", crypto.randomUUID());
    await next();
    context.header("X-Request-Id", context.get("requestId"));
  });
  app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
  app.use("*", async (context, next) => {
    const origin = context.req.header("Origin");
    const isAllowedOrigin = Boolean(origin && origin === context.env.CORS_ORIGIN);
    const isMutation = ["POST", "PATCH", "DELETE", "PUT"].includes(context.req.method);

    if (context.req.method === "OPTIONS") {
      if (!isAllowedOrigin || !origin) {
        return new Response(
          JSON.stringify({
            error: {
              code: "CORS_ORIGIN_DENIED",
              message: "不允許的請求來源。",
              requestId: context.get("requestId"),
            },
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json; charset=UTF-8" },
          },
        );
      }
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Headers": "Content-Type, X-Demo-User-Id",
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Max-Age": "600",
          "Access-Control-Allow-Credentials": "true",
          Vary: "Origin",
        },
      });
    }

    if (context.env.ENVIRONMENT !== "development" && isMutation && !isAllowedOrigin) {
      return failure(context, 403, "CSRF_ORIGIN_DENIED", "不允許的請求來源。");
    }

    await next();
    if (isAllowedOrigin && origin) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Access-Control-Allow-Credentials", "true");
      context.header("Vary", "Origin");
    }
  });
  app.use("/api/v1/*", async (context, next) => {
    const limited = await enforceRateLimit(context, "api");
    if (limited) return limited;
    await next();
  });
  app.use("/api/v1/search", async (context, next) => {
    const limited = await enforceRateLimit(context, "search");
    if (limited) return limited;
    await next();
  });
  app.use("/api/v1/auth/*", async (context, next) => {
    const limited = await enforceRateLimit(context, "auth");
    if (limited) return limited;
    await next();
  });

  const serviceFor = (database: D1Database) =>
    new EventService(
      dependencies.repositoryFactory?.(database) ?? new D1EventRepository(database),
    );
  const taskServiceFor = (database: D1Database) =>
    new TicketTaskService(new D1TicketTaskRepository(database));

  app.get("/health", (context) =>
    success(context, {
      status: "ok",
      environment: context.env.ENVIRONMENT,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/api/v1/home", async (context) => {
    const data = await serviceFor(context.env.DB).home(
      await getOptionalUserId(context),
    );
    return success(context, data);
  });

  app.get("/api/v1/search", async (context) => {
    const query = searchQuerySchema.parse(context.req.query());
    const data = await serviceFor(context.env.DB).search(
      query,
      await getOptionalUserId(context),
    );
    return success(context, data);
  });

  app.get("/api/v1/events/:id", async (context) => {
    const id = resourceIdSchema.parse(context.req.param("id"));
    const event = await serviceFor(context.env.DB).getEvent(
      id,
      await getOptionalUserId(context),
    );
    return event
      ? success(context, event)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.post("/api/v1/events/:id/favorite", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const eventId = resourceIdSchema.parse(context.req.param("id"));
    const result = await serviceFor(context.env.DB).setFavorite(eventId, userId, true);
    return result
      ? success(context, result)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.delete("/api/v1/events/:id/favorite", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const eventId = resourceIdSchema.parse(context.req.param("id"));
    const result = await serviceFor(context.env.DB).setFavorite(eventId, userId, false);
    return result
      ? success(context, result)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.post("/api/v1/artists/:id/follow", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const artistId = resourceIdSchema.parse(context.req.param("id"));
    const result = await serviceFor(context.env.DB).setFollow(artistId, userId, true);
    return result
      ? success(context, result)
      : failure(context, 404, "ARTIST_NOT_FOUND", "找不到指定歌手。");
  });

  app.delete("/api/v1/artists/:id/follow", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const artistId = resourceIdSchema.parse(context.req.param("id"));
    const result = await serviceFor(context.env.DB).setFollow(artistId, userId, false);
    return result
      ? success(context, result)
      : failure(context, 404, "ARTIST_NOT_FOUND", "找不到指定歌手。");
  });

  app.get("/api/v1/ticket-tasks", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    return success(context, await taskServiceFor(context.env.DB).listTasks(userId));
  });

  app.post("/api/v1/ticket-tasks", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const input = ticketTaskInputSchema.parse(await context.req.json());
    const task = await taskServiceFor(context.env.DB).createTask(userId, input);
    return task
      ? success(context, task, 201)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.patch("/api/v1/ticket-tasks/:id", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const taskId = resourceIdSchema.parse(context.req.param("id"));
    const task = await taskServiceFor(context.env.DB).updateTask(
      taskId,
      userId,
      ticketTaskUpdateSchema.parse(await context.req.json()),
    );
    return task
      ? success(context, task)
      : failure(context, 404, "TICKET_TASK_NOT_FOUND", "找不到指定購票任務。");
  });

  app.patch("/api/v1/ticket-tasks/:taskId/checklist/:itemId", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const taskId = resourceIdSchema.parse(context.req.param("taskId"));
    const itemId = resourceIdSchema.parse(context.req.param("itemId"));
    const body = await context.req.json<{ isCompleted?: boolean }>();
    if (typeof body.isCompleted !== "boolean") {
      return failure(context, 422, "VALIDATION_ERROR", "請提供清單完成狀態。");
    }
    const task = await taskServiceFor(context.env.DB).setChecklistItem(
      taskId,
      itemId,
      userId,
      body.isCompleted,
    );
    return task
      ? success(context, task)
      : failure(context, 404, "TICKET_TASK_NOT_FOUND", "找不到指定購票任務。");
  });

  app.get("/api/v1/reminders", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    return success(context, await taskServiceFor(context.env.DB).listReminders(userId));
  });

  app.post("/api/v1/reminders", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const reminder = await taskServiceFor(context.env.DB).createReminder(
      userId,
      reminderInputSchema.parse(await context.req.json()),
    );
    return reminder
      ? success(context, reminder, 201)
      : failure(
          context,
          404,
          "REMINDER_TARGET_NOT_FOUND",
          "找不到提醒所屬活動或任務。",
        );
  });
  app.get("/api/v1/purchase-records", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    return success(
      context,
      await new D1PurchaseRepository(context.env.DB).list(userId),
    );
  });
  app.post("/api/v1/purchase-records", async (context) => {
    const userId = await requireUserId(context);
    if (userId instanceof Response) return userId;
    const record = await new D1PurchaseRepository(context.env.DB).create(
      userId,
      purchaseRecordInputSchema.parse(await context.req.json()),
    );
    return record
      ? success(context, record, 201)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.get("/api/v1/admin/overview", async (context) => {
    const adminId = await requireAdminId(context);
    if (adminId instanceof Response) return adminId;

    const repository = new D1AdminRepository(context.env.DB);
    await repository.recordOverviewAccess(adminId, context.get("requestId"));
    return success(context, await repository.overview());
  });

  app.get("/api/v1/auth/session", async (context) => {
    const user = await getOptionalUser(context);
    return user
      ? success(context, { authenticated: true as const, user })
      : failure(context, 401, "AUTH_REQUIRED", "尚未登入或 Session 已失效。");
  });

  app.post("/api/v1/auth/logout", (context) => {
    const teamDomain = context.env.ACCESS_TEAM_DOMAIN.trim();
    if (!teamDomain) {
      return failure(context, 500, "AUTH_NOT_CONFIGURED", "登入服務尚未完成設定。");
    }
    return success(context, {
      logoutUrl: `https://${teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/cdn-cgi/access/logout`,
    });
  });

  app.patch("/api/v1/admin/events/:eventId/verification", async (context) => {
    const adminId = await requireAdminId(context);
    if (adminId instanceof Response) return adminId;
    const eventId = resourceIdSchema.parse(context.req.param("eventId"));
    const body = await context.req.json<{ isVerified?: boolean }>();
    if (typeof body.isVerified !== "boolean") {
      return failure(context, 422, "VALIDATION_ERROR", "請提供活動確認狀態。");
    }

    const event = await new D1AdminRepository(context.env.DB).setEventVerified(
      adminId,
      eventId,
      body.isVerified,
      context.get("requestId"),
    );
    return event
      ? success(context, event)
      : failure(context, 404, "EVENT_NOT_FOUND", "找不到指定活動。");
  });

  app.notFound((context) =>
    failure(context, 404, "ROUTE_NOT_FOUND", "找不到指定 API 路徑。"),
  );

  app.onError((error, context) => {
    if (error instanceof ZodError) {
      return failure(
        context,
        422,
        "VALIDATION_ERROR",
        error.issues[0]?.message ?? "輸入資料格式不正確。",
      );
    }

    console.error(
      JSON.stringify({
        level: "error",
        requestId: context.get("requestId"),
        code: "UNHANDLED_ERROR",
      }),
    );
    return failure(
      context,
      500,
      "INTERNAL_ERROR",
      "系統暫時無法處理請求，請稍後再試。",
    );
  });

  return app;
}
