import type { Context } from "hono";
import { Jwt } from "hono/utils/jwt";

import { failure } from "./http";
import type { AppEnv, AuthenticatedUser } from "./env";

type AccessClaims = {
  sub: string;
  email: string;
};

function normalizedTeamDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function isAccessClaims(payload: Record<string, unknown>): payload is AccessClaims {
  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.email === "string" &&
    payload.email.includes("@")
  );
}

async function resolveAccessUser(
  context: Context<AppEnv>,
): Promise<AuthenticatedUser | null> {
  const token = context.req.header("Cf-Access-Jwt-Assertion")?.trim();
  const teamDomain = normalizedTeamDomain(context.env.ACCESS_TEAM_DOMAIN || "");
  const audience = context.env.ACCESS_AUD?.trim();
  if (!token || !teamDomain || !audience) return null;

  let payload: Record<string, unknown>;
  try {
    payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `https://${teamDomain}/cdn-cgi/access/certs`,
      allowedAlgorithms: ["RS256"],
      verification: {
        aud: audience,
        iss: `https://${teamDomain}`,
        exp: true,
        nbf: true,
        iat: true,
      },
    });
  } catch {
    return null;
  }

  if (!isAccessClaims(payload)) return null;
  const email = payload.email.trim().toLowerCase();
  const existing = await context.env.DB.prepare(
    `SELECT u.id,u.email_normalized,u.display_name,u.role,u.status
       FROM user_auth_identities i
       JOIN users u ON u.id=i.user_id
      WHERE i.provider='cloudflare_access' AND i.subject=?
        AND u.deleted_at_utc IS NULL`,
  )
    .bind(payload.sub)
    .first<{
      id: string;
      email_normalized: string | null;
      display_name: string;
      role: "user" | "admin";
      status: string;
    }>();

  if (existing) {
    if (existing.status !== "active") return null;
    return {
      id: existing.id,
      email: existing.email_normalized,
      displayName: existing.display_name,
      role: existing.role,
    };
  }

  const now = new Date().toISOString();
  const matchedUser = await context.env.DB.prepare(
    `SELECT id,email_normalized,display_name,role,status
       FROM users
      WHERE email_normalized=? AND deleted_at_utc IS NULL`,
  )
    .bind(email)
    .first<{
      id: string;
      email_normalized: string;
      display_name: string;
      role: "user" | "admin";
      status: string;
    }>();

  if (matchedUser?.status !== undefined && matchedUser.status !== "active") return null;
  const userId = matchedUser?.id ?? crypto.randomUUID();
  if (!matchedUser) {
    await context.env.DB.prepare(
      `INSERT INTO users (
         id,email_normalized,display_name,role,timezone,locale,status,
         created_at_utc,updated_at_utc,deleted_at_utc
       ) VALUES (?,?,?,'user','Asia/Taipei','zh-TW','active',?,?,NULL)`,
    )
      .bind(userId, email, email.split("@")[0] || "Ticket Radar 使用者", now, now)
      .run();
  }
  await context.env.DB.prepare(
    `INSERT INTO user_auth_identities (
       id,provider,subject,user_id,email_normalized,created_at_utc,last_seen_at_utc
     ) VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(provider,subject) DO UPDATE SET
       email_normalized=excluded.email_normalized,
       last_seen_at_utc=excluded.last_seen_at_utc`,
  )
    .bind(
      crypto.randomUUID(),
      "cloudflare_access",
      payload.sub,
      userId,
      email,
      now,
      now,
    )
    .run();

  return {
    id: userId,
    email,
    displayName:
      matchedUser?.display_name ?? email.split("@")[0] ?? "Ticket Radar 使用者",
    role: matchedUser?.role ?? "user",
  };
}

export async function getOptionalUser(
  context: Context<AppEnv>,
): Promise<AuthenticatedUser | null> {
  const cached = context.get("authenticatedUser");
  if (cached) return cached;

  if (
    context.env.ENVIRONMENT === "development" &&
    context.env.ALLOW_DEMO_AUTH === "true"
  ) {
    const id =
      context.req.header("X-Demo-User-Id")?.trim() || context.env.DEMO_USER_ID || "";
    if (!id) return null;
    const row = await context.env.DB.prepare(
      `SELECT id,email_normalized,display_name,role,status
         FROM users WHERE id=? AND deleted_at_utc IS NULL`,
    )
      .bind(id)
      .first<{
        id: string;
        email_normalized: string | null;
        display_name: string;
        role: "user" | "admin";
        status: string;
      }>();
    if (!row || row.status !== "active") return null;
    const user = {
      id: row.id,
      email: row.email_normalized,
      displayName: row.display_name,
      role: row.role,
    };
    context.set("authenticatedUser", user);
    return user;
  }

  const user = await resolveAccessUser(context);
  if (user) context.set("authenticatedUser", user);
  return user;
}

export async function getOptionalUserId(
  context: Context<AppEnv>,
): Promise<string | null> {
  return (await getOptionalUser(context))?.id ?? null;
}

export async function requireUserId(
  context: Context<AppEnv>,
): Promise<string | Response> {
  const user = await getOptionalUser(context);
  if (!user) {
    return failure(context, 401, "AUTH_REQUIRED", "此操作需要有效的登入 Session。");
  }
  return user.id;
}

export async function requireAdminId(
  context: Context<AppEnv>,
): Promise<string | Response> {
  const userId = await requireUserId(context);
  if (userId instanceof Response) return userId;

  const user = await context.env.DB.prepare(
    "SELECT role,status FROM users WHERE id=? AND deleted_at_utc IS NULL",
  )
    .bind(userId)
    .first<{ role: string; status: string }>();

  if (user?.role !== "admin" || user.status !== "active") {
    return failure(context, 403, "ADMIN_REQUIRED", "此操作需要管理員權限。");
  }
  return userId;
}
