import type { Context, Input } from "hono";

import type { ApiError, ApiSuccess } from "@ticket-radar/shared";

import type { AppEnv } from "./env";

export function success<T, P extends string, I extends Input>(
  context: Context<AppEnv, P, I>,
  data: T,
  status: 200 | 201 = 200,
) {
  const payload: ApiSuccess<T> = {
    data,
    requestId: context.get("requestId"),
  };
  return context.json(payload, status);
}

export function failure<P extends string, I extends Input>(
  context: Context<AppEnv, P, I>,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
  code: string,
  message: string,
) {
  const payload: ApiError = {
    error: {
      code,
      message,
      requestId: context.get("requestId"),
    },
  };
  return context.json(payload, status);
}
