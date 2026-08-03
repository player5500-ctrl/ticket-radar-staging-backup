import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import { queryClient } from "./app/queryClient";
import { router } from "./app/router";
import "./styles.css";

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("找不到應用程式根節點。");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
