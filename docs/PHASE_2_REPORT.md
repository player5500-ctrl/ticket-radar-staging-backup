# Phase 2 完成報告：購票任務、提醒與 ICS

完成日期：2026-07-29

## 交付內容

- 新增 `0003_ticket_tasks_and_reminders.sql`：購票任務、準備清單與提醒資料表，包含使用者範圍、外鍵與提醒防重 key。
- 新增任務 API：建立／列出／更新任務，以及勾選準備清單。
- 新增提醒 API：列出／建立提醒；售票階段與活動必須一致，避免錯誤關聯。
- 活動詳情可建立任務，並可為售票階段建立 ICS 提醒。
- 新增「任務」頁：準備度、預算／張數／區域摘要、準備清單、暫停／恢復及 ICS 匯出。
- ICS 在瀏覽器端產生，不上傳日曆資料。

## 合規與資料界線

- 任務只保存預算、最大票數、可接受場次、三個區域順位與備註。
- 不保存帳號、密碼、OTP、付款卡資料或身分證號。
- 不提供刷新、排隊、選票、送單、付款或 CAPTCHA 自動化。
- `web_push`、Email、LINE 僅保留 channel 資料模型；本階段實際可用匯出為 ICS。

## 驗證結果

- `pnpm check`：格式、lint、型別檢查、15 個單元／元件測試、PWA build 與 Worker dry-run 全數通過。
- `pnpm test:e2e`：8/8 通過（手機與桌面），包括活動建立購票任務與任務頁顯示。
- 本機 D1 已套用 `0003_ticket_tasks_and_reminders.sql`；未對遠端 D1 執行 migration，未部署 Worker。

## 下一階段

Phase 3 將建立 Extension 與 Generic Demo Adapter。擴充功能的資料組加密與本機保存會留在該階段；PWA 不會取得解密個資。
