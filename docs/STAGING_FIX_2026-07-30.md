# Staging 修復（TASK-01～05）交付說明｜2026-07-30

對應交辦單：`交辦_Staging修復_2026-07-30.md`。本檔只記「架構怎麼改」與「Vanny 需要在 Cloudflare 後台做什麼」，逐檔改動清單見交辦回報。

---

## 1. TASK-01 架構改動：API 改走 Pages 同源路徑

### 改動前

```
瀏覽器 ──fetch──> https://ticket-radar-api-staging.vannyai.workers.dev/api/v1/*
                  ↑ 獨立的 Access Application（AUD 6f5d05d1…）
                  → 沒有該網域的 session cookie → 503 → 302 到互動式登入頁
                  → fetch 無法完成 OTP 流程 → 請求卡死 → 前端無限 loading
```

還有一個更隱蔽的後果：帶 `Content-Type: application/json` 的 POST/PATCH 會先發 CORS
preflight，而 `OPTIONS` 不帶 cookie，一定被 Access 擋下。DevTools 預設不顯示失敗的
preflight，所以「建立購票任務」「加入行事曆提醒」看起來像**完全沒有送出請求**
（TASK-02／TASK-03 的表象）。相對地，`收藏活動` 那顆 POST 沒有自訂標頭、屬於 simple
request、不需 preflight，所以它在同一次實測裡是好的——這正好交叉驗證了這個推論。

### 改動後

```
瀏覽器 ──fetch──> /api/v1/*（同源，Pages 網域）
                  ↑ 只有 Pages 這一個 Access Application
                  → apps/web/functions/api/[[path]].ts
                  → Service Binding（不經 Cloudflare 邊界，Access 不會二次攔截）
                  → ticket-radar-api-staging Worker
```

同源之後：沒有跨網域、沒有 preflight、一次登入涵蓋 PWA 與 API。

---

## 2. ⚠️ 需要 Vanny 人工操作（程式碼無法完成）

### 2-1【必做】Pages 專案綁 Service Binding

Cloudflare Dashboard → Workers & Pages → `ticket-radar-web-staging` → Settings →
Functions → **Service bindings** → Add binding：

| 欄位          | 值                                                                   |
| ------------- | -------------------------------------------------------------------- |
| Variable name | `API`                                                                |
| Service       | `ticket-radar-api-staging`                                           |
| Environment   | production（Pages 專案自己的 production，不是 Worker 的 production） |

**選這條路的好處**：Service Binding 是 script 直呼，不經過 Cloudflare 邊界，所以
**API 網域上現有的 Access Application 可以原封不動保留**，不需要動 Zero Trust 設定。

> 替代做法（不建議）：改設 Pages 環境變數 `API_ORIGIN=https://ticket-radar-api-staging.vannyai.workers.dev`。
> 這條路徑會經過 Cloudflare 邊界，**必須先把 API 網域的 Access Application 移除或改成允許
> Service Token**，否則 Pages Function 對 Worker 的內部呼叫同樣會被 Access 擋。移除 Access
> 之後 Worker 網址就對外裸奔，只靠應用層 `auth.ts` 的 JWT 驗證把關——而此時 Pages Function
> 轉發過去的 JWT 又是 Pages 那個 Application 簽的，安全性等級明顯低於 Service Binding。
> 兩者都沒設定時，`/api/*` 會回 503 `API_PROXY_NOT_CONFIGURED` 並在訊息裡說明要設什麼，
> 不會靜默失敗。

### 2-2【必做】Worker 的 `ACCESS_AUD` 要補上 Pages Application 的 AUD

同源之後，Worker 收到的 `Cf-Access-Jwt-Assertion` 是 **Pages 網域那個 Access
Application** 簽的，`aud` 與現有的 API 網域 AUD 不同。若不補，`auth.ts` 會驗不過，
所有需要登入的 API 一律 401。

1. Zero Trust → Access → Applications → 找 `ticket-radar-web-staging.pages.dev`
   那個 Application → Overview → 複製 **Application Audience (AUD) Tag**。
2. 填進 `workers/api/wrangler.toml` 的 `env.staging.vars.ACCESS_AUD`，用逗號接在現有值前面：

   ```toml
   ACCESS_AUD = "<pages-app-aud>,6f5d05d11df1e094b7319a0aa97dd24788cb3c85ee0852866747466f9e83f73e"
   ```

   `auth.ts` 已改成支援逗號分隔多個 AUD，兩個都留可讓「直接呼叫 Worker 網址測試」的舊路徑繼續通。

3. 重新部署 Worker staging（`wrangler deploy --env staging`）。

### 2-3【必做】清掉 Pages 專案殘留的 `VITE_API_BASE_URL`

Pages → Settings → Environment variables，若還有
`VITE_API_BASE_URL=https://ticket-radar-api-staging.vannyai.workers.dev`，請刪除。

前端已加保險：非本機 build 拿到跨網域絕對網址時會**忽略它並改用同源 `/api`**，同時在
console 記一筆警告。但殘留設定會讓人誤判，建議直接清掉。

### 2-4【選做】檢查 Access Application 的 session 長度

TASK-04 的修法是「session 失效時明確提示重新登入」，不是延長 session。如果驗收時覺得
太常被要求重新登入，那是 Access Application 的 Session Duration 設定，屬 Zero Trust 後台。

---

## 3. 驗收時如果 `/api/*` 回傳 HTML 而不是 JSON

代表請求根本沒有進到 Pages Function。檢查順序：

0. **最可能的原因：部署時的工作目錄不對。** 這個版本的 wrangler 沒有 `--functions`
   旗標，`functions/` 是相對於 CWD 解析的。必須從 `apps/web` 執行
   `wrangler pages deploy dist ...`；從 repo 根目錄執行會去找不存在的
   `<repo>/functions`，Pages Function 會被**靜默忽略**。已同步更新
   `docs/staging-deployment.md` 的部署指令。
1. `apps/web/public/_routes.json` 有沒有進到 build 產物 `dist/_routes.json`
   （Vite 會把 `public/` 原樣複製過去）。內容應為
   `{"version":1,"include":["/api/*"],"exclude":[]}`——已用
   `wrangler pages functions build` 驗證與 wrangler 自動產生的內容一致。
2. `apps/web/public/_redirects` 的 `/* /index.html 200` 是否在 Functions 之前被套用。
   若確認是這個原因，把該行改成不涵蓋 `/api/*` 的寫法（Pages Functions 正常情況下優先於
   靜態資源與 `_redirects`，所以預期不會發生）。

---

## 4. TASK-04 為什麼需要 `?reauth=1`

PWA 的 Service Worker 用 `navigateFallback` 把**所有導覽**都改由快取的 `index.html`
回應，所以登出後直接開 `/tasks` 仍然拿得到 SPA 外殼，Cloudflare Access 根本沒機會攔截
導向登入頁——這才是「無限轉圈」的真正結構原因，不只是前端少一個 401 分支。

修法兩層：

1. `vite.config.ts` 的 `navigateFallbackDenylist` 加入 `/^\/api\//`、`/^\/cdn-cgi\//`、
   `/[?&]reauth=1/`（workbox 比對 `pathname + search`）。
2. 「重新登入」按鈕導到 `/?reauth=1`，因為在 denylist 內，這個導覽一定打到網路，
   由 Access 接手登入流程。

---

## 5. 沒有處理的事

- Production 環境完全沒動（沒有執行任何 `--env production` 指令，`wrangler.toml` 的
  production 區塊未修改）。
- 沒有新增 D1 migration：這五項都不需要改 schema。
- 沒有動 Cloudflare Zero Trust 任何設定（依交辦單硬約束，只提建議）。
- `docs/CODE_FIX_TASKS.md` 的 TASK-06（文件債）不在本次範圍。
