export type Bindings = {
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "staging" | "production";
  ALLOW_DEMO_AUTH: string;
  DEMO_USER_ID: string;
  CORS_ORIGIN: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  RATE_LIMIT_SALT: string;
};

export type Variables = {
  requestId: string;
  authenticatedUser?: AuthenticatedUser;
};

export type AuthenticatedUser = {
  id: string;
  email: string | null;
  displayName: string;
  role: "user" | "admin";
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
