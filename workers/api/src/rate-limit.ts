import type { Context, Input } from "hono";

import type { AppEnv } from "./env";
import { failure } from "./http";

type RateLimitKind = "api" | "search" | "auth";

const limits: Record<RateLimitKind, number> = {
  api: 120,
  search: 30,
  auth: 20,
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function enforceRateLimit<P extends string, I extends Input>(
  context: Context<AppEnv, P, I>,
  kind: RateLimitKind,
): Promise<Response | null> {
  if (context.env.ENVIRONMENT === "development") return null;

  const salt = context.env.RATE_LIMIT_SALT?.trim();
  if (!salt) {
    return failure(context, 500, "RATE_LIMIT_NOT_CONFIGURED", "安全設定尚未完成。");
  }

  const clientIp = context.req.header("CF-Connecting-IP")?.trim() || "unknown";
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const keyHash = await sha256(`${salt}:${kind}:${clientIp}`);
  const result = await context.env.DB.prepare(
    `INSERT INTO rate_limit_windows (
       key_hash,limit_kind,window_started_at_utc,request_count,expires_at_utc
     ) VALUES (?,?,?,?,?)
     ON CONFLICT(key_hash,limit_kind,window_started_at_utc)
     DO UPDATE SET request_count=request_count+1
     RETURNING request_count`,
  )
    .bind(
      keyHash,
      kind,
      new Date(windowStart).toISOString(),
      1,
      new Date(windowStart + 120_000).toISOString(),
    )
    .first<{ request_count: number }>();

  const limit = limits[kind];
  const count = result?.request_count ?? limit;
  context.header("X-RateLimit-Limit", String(limit));
  context.header("X-RateLimit-Remaining", String(Math.max(0, limit - count)));
  if (count <= limit) return null;

  context.header("Retry-After", String(Math.ceil((windowStart + 60_000 - now) / 1000)));
  return failure(context, 429, "RATE_LIMITED", "請求過於頻繁，請稍後再試。");
}
