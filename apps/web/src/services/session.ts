/**
 * 重新登入用的導覽（TASK-04）。
 *
 * 這個 PWA 的 Service Worker 用 `navigateFallback` 把所有導覽都改由快取的 index.html
 * 回應，所以登出後直接開 `/tasks` 仍然拿得到 SPA 外殼，Cloudflare Access 根本沒機會
 * 攔截導向登入頁。要真正回到 Access 登入流程，必須送出一個「不會被 Service Worker
 * 導覽路由接手」的請求。
 *
 * `?reauth=1` 已列入 `vite.config.ts` 的 `navigateFallbackDenylist`（workbox 比對
 * `pathname + search`），所以這個導覽一定會打到網路，交由 Access 接手。
 */
export const REAUTH_URL = "/?reauth=1";

export function startReauthentication(): void {
  window.location.replace(REAUTH_URL);
}
