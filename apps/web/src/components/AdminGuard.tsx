import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { api } from "../services/api";
import { LoadingState } from "./LoadingState";

export function AdminGuard({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: ["auth-session"],
    queryFn: api.session,
    retry: false,
    staleTime: 60_000,
  });
  if (import.meta.env.DEV) return children;
  if (session.isPending) return <LoadingState />;
  if (session.data?.user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}
