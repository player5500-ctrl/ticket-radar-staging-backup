# Ticket Radar Staging 部署與修復

本文件只適用於獨立測試環境，禁止把 Production D1 ID 或正式使用者資料帶入。

## 資源

- Pages：`ticket-radar-web-staging`
- Worker：`ticket-radar-api-staging`
- D1：`ticket-radar-db-staging`
- D1 Database ID：`4cca7519-2ad0-45e6-91d5-156e11098782`

## 必要設定

`workers/api/wrangler.toml` 的 `env.staging` 必須設定：

- `CORS_ORIGIN`：Staging Pages 的唯一 Origin。
- `ACCESS_TEAM_DOMAIN`：Cloudflare Access team domain。
- `ACCESS_AUD`：保護 Staging API 的 Access Application Audience tag。
- `RATE_LIMIT_SALT`：只以 Wrangler Secret 設定，不得提交。

Staging 禁止 `ALLOW_DEMO_AUTH=true`。前端正式建置也不得傳送
`X-Demo-User-Id`。

## 部署順序

```powershell
cd "D:\cowork files\projects\18_ticket-radar\workers\api"
wrangler d1 migrations apply ticket-radar-db-staging --env staging --remote
wrangler d1 execute ticket-radar-db-staging --env staging --remote --file seeds/seed.sql
wrangler secret put RATE_LIMIT_SALT --env staging
wrangler deploy --env staging --no-bundle

cd "D:\cowork files\projects\18_ticket-radar"
$env:VITE_API_BASE_URL = "https://ticket-radar-api-staging.vannyai.workers.dev"
pnpm --filter @ticket-radar/web build
wrangler pages deploy apps/web/dist --project-name ticket-radar-web-staging --branch staging
```

## Migration 重跑與修復

1. `wrangler d1 migrations list ticket-radar-db-staging --env staging --remote`
   先確認 pending 清單。
2. 已成功記錄於 `d1_migrations` 的 migration 不會再次套用；不得手動刪除
   該表紀錄。
3. migration 失敗時先保存 Wrangler 的 migration 名稱與 D1 bookmark，不要重建
   或刪除資料庫。
4. 向前新增一個修復 migration，例如 `0008_repair_x.sql`；修復 SQL 必須可安全重跑，
   並先在本機 D1 驗證。
5. D1 不支援傳統向下 migration。需要資料復原時使用 Cloudflare D1 Time Travel
   在獨立資料庫驗證復原點，再由人工確認是否切換 binding。
6. seed 使用 `INSERT OR IGNORE`，可重跑且不會以外鍵連鎖刪除使用者任務；
   它不是清空或還原資料庫的工具。

## 驗收閘門

只有在 Access 登入／登出、使用者隔離、管理員權限、CRUD、CORS、Rate Limit、
PWA、Extension、遮罩截圖及完整核心流程都在真實網址通過後，才能標記
`Staging Ready`。
