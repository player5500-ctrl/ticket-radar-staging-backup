# Ticket Radar — INTERNAL CLOSED BETA

目前版本正式標記為 **INTERNAL CLOSED BETA**。

它不是 Production、Public Beta 或 Production Ready。本階段不建立正式環境、不切正式網域、不公開註冊，也不增加與本次真人測試無關的新功能。

## 1. 測試目的

讓 Product Owner 與 2～3 位指定測試者，在 Cloudflare Access 保護下完成受控真人測試，確認核心流程是否容易理解、資料是否能保存、不同使用者資料是否隔離，並收集可分級處理的問題。

## 2. 測試範圍

一般測試者一律使用 `ROLE_USER`（資料庫值 `user`），可測試：

- 搜尋歌手與活動、查看活動詳情。
- 收藏／取消收藏活動。
- 建立購票任務、設定提醒、查看自己的任務。
- 建立與查看自己的購票紀錄。
- 提交官方活動網址。
- 查看自己的顯示名稱與角色。
- 透過「回報問題」送出 Beta Feedback。

必要管理員使用 `ROLE_ADMIN`（資料庫值 `admin`）。只有後端確認為 Admin 的使用者可進入 `/admin`、審核候選活動、合併活動或修改驗證狀態。

## 3. 已知限制

- 僅有 Staging；沒有 Production 或正式網域。
- Cloudflare Access 白名單外的使用者不能進入。
- 活動與售票資訊可能不完整或延遲，必須以官方公告為準。
- 外部來源同步仍受來源條款、robots、合作狀態與網路狀態限制。
- 提醒目前只驗證系統內資料與排程狀態；未宣稱每個外部通知管道都已正式送達。
- 截圖只接受已遮罩、500 KB 以下的 JPEG／PNG／WebP。
- Extension 只提供 Product Owner 與 1 位熟悉 Chrome 的測試者。

## 4. 不支援功能

- 公開註冊、廣告投放或公開 Extension。
- Ticketmaster Phase 1 或大量外部售票平台串接。
- 原生 App。
- 自動選票、自動排隊、自動送單、自動付款、OTP 或 CAPTCHA 操作。
- 任何「自動搶票」或「Production Ready」承諾。

## 5. 測試者操作流程

1. 使用已列入 Cloudflare Access 白名單的本人 Email 登入 Staging。
2. 確認 Header 顯示 `INTERNAL BETA`，頁尾顯示兩段測試與安全聲明。
3. 依 `BETA_TEST_CHECKLIST.md` 完成核心流程；只操作自己的測試資料。
4. 發現問題時，從 Header 開啟「回報問題」。
5. 填寫發生頁面、類型、描述、時間、Browser、Device；聯絡方式與遮罩截圖可留空。
6. 送出前確認內容不含密碼、OTP、信用卡資料、CAPTCHA 或未遮罩票券資訊。
7. 測試結束後登出 Cloudflare Access。

## 6. Bug 回報方式

優先使用站內 `/feedback`。回報至少應能回答「在哪個頁面、做了什麼、預期什麼、實際發生什麼」。

不得提交：密碼、OTP、信用卡資料、CAPTCHA、未遮罩票券、完整私人 Email 清單或其他與重現無關的敏感資訊。

## 7. P0 / P1 / P2 / P3 定義

### P0 — 立即停止 Beta

- 資料外洩、權限突破、大量資料毀損。
- 所有使用者皆無法登入。

### P1 — 修復後再繼續

- 核心流程不能使用、建立任務失敗或資料錯亂。
- 同一活動大量重複。
- Admin 重大錯誤。

### P2 — 可持續測試但需排程

- 部分功能異常、UI 阻礙操作或非核心功能失敗。

### P3 — 記錄即可

- 文案、間距、小型 UI 或建議事項。

## 8. 暫停測試條件

發生任一 P0 立即停止所有測試並撤除／暫停 Access；P1 影響核心流程時暫停受影響流程，修復與重新驗證後才恢復。若 Access 白名單意外放寬、一般使用者能進入 Admin、User A 能看到 User B 資料，也一律視為 P0。

## 9. 升級 Closed Beta Ready 的條件

- Product Owner、至少 2 位 `ROLE_USER` 與必要 `ROLE_ADMIN` 均可登入。
- Access 只允許完整指定 Email；無 `Everyone` 或只靠 `One-time PIN` 的公開 Allow 規則。
- 一般測試者無法進 `/admin`，Admin 可正常進入。
- User A / User B 的收藏、任務、提醒、紀錄與回報資料互相隔離。
- Search、Favorite、Task、Reminder、Records、External Submission、Feedback 核心流程通過。
- Beta 標示與兩段安全聲明在桌面與手機正常顯示，沒有水平捲動。
- lint、typecheck、test、build、format 與 Staging smoke test 全部通過。
- 沒有未處理 P0；P1 已修復並重測；P2/P3 已記錄與排程。
- Extension 完成 Product Owner 與 1 位 Chrome 熟悉測試者的限定驗收。

即使以上條件完成，版本標記仍為 **INTERNAL CLOSED BETA**，不得宣稱 Production Ready。
