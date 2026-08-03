# TASK-01 部署前人工設定清單 —— Vanny 專用

Claude Code 已完成代碼層面的所有修改（TASK-01~05 都自測通過）。以下 5 項**必須由你在 Cloudflare 後台操作**，才能部署並進行真實 Staging 驗收。

---

## 步驟 1【必做】Pages 專案綁 Service Binding

**位置**：Cloudflare Dashboard → Workers & Pages → `ticket-radar-web-staging` → Settings → Functions → Service bindings

**新增一個 binding**：

| 欄位 | 值 |
|---|---|
| Variable name | `API` |
| Service | `ticket-radar-api-staging` |
| Environment | `production`（Pages 自己的環境） |

**預計時間**：2 分鐘 | **難度**：極低 | **必要性**：是

---

## 步驟 2【必做】Worker 補上 Pages Application 的 AUD

**位置**：Cloudflare Zero Trust → Access → Applications

**操作**：
1. 找到 `ticket-radar-web-staging.pages.dev` 那個 Access Application（不是 API 那個）
2. 點 Overview
3. 複製 **Application Audience (AUD) Tag**（一串 16 進制值，例如 `a1b2c3d4...`）
4. 編輯 `workers/api/wrangler.toml`，找到 `env.staging.vars.ACCESS_AUD`
5. 改成：`ACCESS_AUD = "<pages-aud-值>,6f5d05d11df1e094b7319a0aa97dd24788cb3c85ee0852866747466f9e83f73e"`
   - 前面是 Pages 的 AUD（剛複製的）
   - 逗號分隔
   - 後面是原有的 API 網域 AUD
6. 儲存後，從 `workers/api/` 執行 `wrangler deploy --env staging`

**預計時間**：5 分鐘 | **難度**：低 | **必要性**：是

---

## 步驟 3【必做】清掉 Pages 殘留的環境變數

**位置**：Cloudflare Dashboard → Workers & Pages → `ticket-radar-web-staging` → Settings → Environment variables

**操作**：
- 找 `VITE_API_BASE_URL`
- 刪除它（若有的話）

**預計時間**：1 分鐘 | **難度**：極低 | **必要性**：是（清潔用，邏輯上前端會忽略它，但殘留會誤導）

---

## 步驟 4【必做】部署 Pages

**位置**：從 `apps/web` 資料夾執行

```powershell
cd apps/web
wrangler pages deploy dist --project-name ticket-radar-web-staging --branch staging
```

**注意**：
- **必須從 `apps/web` 執行**（不是從 repo 根目錄）
- Pages Function 才會被納入（工作目錄相對路徑的問題）

**驗證**：部署完後，執行（任何路徑都行）
```powershell
curl -I https://ticket-radar-web-staging.pages.dev/api/v1/home
```
- 若看到 `content-type: application/json`，表示 Pages Function 成功轉發，✅ 沒問題
- 若看到 `content-type: text/html`，表示返回 SPA 殼層，❌ 工作目錄有問題，重讀 TASK-01 說明

**預計時間**：3 分鐘 | **難度**：低 | **必要性**：是

---

## 步驟 5【選做】調整 Access Session 長度

**位置**：Cloudflare Zero Trust → Access → Applications → `ticket-radar-web-staging.pages.dev` → Settings → Session Duration

- 預設通常是 24 小時
- 若驗收時覺得使用者被強制重新登入太頻繁，調整這個值
- TASK-04 的修法是「提示重新登入」，不是延長 session

**預計時間**：1 分鐘 | **難度**：極低 | **必要性**：否（可驗收後再調）

---

## 完成後的驗收流程

1. 所有 5 步都做完，部署 Pages（步驟 4）
2. 通知我部署完成
3. 我用全新無痕視窗走完整流程驗證：登入 → 搜尋 → 建立任務 → 加入提醒 → 登出後重新登入
4. 確認無限 loading、403、其他錯誤都消失

---

## 如果卡住了

- **步驟 1 找不到 Service bindings 選項**：確認 `ticket-radar-web-staging` 是 Pages 專案（不是 Worker）
- **步驟 2 改了 AUD 後仍然 401**：確認新 AUD 值是否正確複製、Worker 是否成功部署（看 Cloudflare 部署紀錄）
- **步驟 4 部署後 `/api/*` 還是 HTML**：確認「從 `apps/web` 執行」、確認 `dist/_routes.json` 內容
- **其他問題**：貼完整錯誤訊息給我

---

## 預期總時間

5 ～ 15 分鐘（主要取決於 Cloudflare 後台搜尋 Application AUD 的時間）

