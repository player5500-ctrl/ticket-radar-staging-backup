import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "追票雷達 Ticket Radar",
        short_name: "追票雷達",
        description: "合法合規的演唱會與活動購票準備助手",
        theme_color: "#07111f",
        background_color: "#07111f",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "zh-TW",
        icons: [
          {
            src: "/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Service Worker 不得攔截這些導覽（workbox 比對 pathname + search）：
        // - /api/*：交給 Pages Function 轉發到 Worker，不能被 SPA 外殼吃掉。
        // - /cdn-cgi/*：Cloudflare Access 的登入／登出端點。
        // - ?reauth=1：TASK-04 的重新登入導覽，必須真的打到網路才會觸發 Access 登入。
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//, /[?&]reauth=1/],
        // Authenticated API responses must never be shared through Cache Storage.
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
