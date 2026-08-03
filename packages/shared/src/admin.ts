export type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorUserId: string | null;
  requestId: string;
  createdAtUtc: string;
};

export type AdminOverview = {
  counts: {
    artists: number;
    events: number;
    unverifiedEvents: number;
    openReports: number;
    notificationFailures: number;
  };
  adapterVersions: AdminAdapterVersion[];
  recentEvents: AdminEvent[];
  recentAuditLogs: AdminAuditLog[];
};

export type AdminAdapterVersion = {
  id: string;
  adapterId: string;
  platformName: string;
  version: string;
  status: "draft" | "disabled" | "testing" | "active" | "deprecated";
  lastUpdatedAtUtc: string;
  lastVerifiedAtUtc: string | null;
  notes: string;
};

export type AdminEvent = {
  id: string;
  name: string;
  startsAtUtc: string;
  isAdminVerified: boolean;
  lastVerifiedAtUtc: string | null;
};
