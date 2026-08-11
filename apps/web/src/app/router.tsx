import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";

import { AdminGuard } from "../components/AdminGuard";
import { AppLayout } from "../components/AppLayout";
import { LoadingState } from "../components/LoadingState";
import { ProtoHomePage } from "../prototype/pages/ProtoHomePage";
import { ProtoSearchPage } from "../prototype/pages/ProtoSearchPage";
import { ProtoDetailPage } from "../prototype/pages/ProtoDetailPage";
import { ProtoTasksPage } from "../prototype/pages/ProtoTasksPage";
import { ProtoBattleModePage } from "../prototype/pages/ProtoBattleModePage";
import { ProtoRecordsPage } from "../prototype/pages/ProtoRecordsPage";
import { NotFoundPage } from "../pages/NotFoundPage";

const DemoTicketPage = lazy(async () => {
  const module = await import("../pages/DemoTicketPage");
  return { default: module.DemoTicketPage };
});

const FeedbackPage = lazy(async () => {
  const module = await import("../pages/FeedbackPage");
  return { default: module.FeedbackPage };
});

const AdminPage = lazy(async () => {
  const module = await import("../pages/AdminPage");
  return { default: module.AdminPage };
});

function withRouteLoading(page: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="page-container detail-loading">
          <LoadingState />
        </div>
      }
    >
      {page}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <ProtoHomePage /> },
      { path: "/search", element: <ProtoSearchPage /> },
      { path: "/tasks", element: <ProtoTasksPage /> },
      { path: "/battle", element: <ProtoBattleModePage /> },
      { path: "/records", element: <ProtoRecordsPage /> },
      { path: "/events/:eventId", element: <ProtoDetailPage /> },
      { path: "/demo-ticket", element: withRouteLoading(<DemoTicketPage />) },
      { path: "/feedback", element: withRouteLoading(<FeedbackPage />) },
      {
        path: "/admin",
        element: <AdminGuard>{withRouteLoading(<AdminPage />)}</AdminGuard>,
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
