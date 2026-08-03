# 追票雷達 Ticket Radar — Staging Ready 驗收清單

更新日期：2026-07-30
依據：`docs/staging-deployment.md` 第「驗收閘門」一節——「只有在 Access 登入／登出、使用者隔離、管理員權限、CRUD、CORS、Rate Limit、PWA、Extension、遮罩截圖及完整核心流程都在真實網址通過後，才能標記 Staging Ready」。

標記說明：✅ 已實測通過｜❌ 已實測，未通過｜⏳ 未實測（原因見備註）

| 項目 | 狀態 | 備註 |
|---|---|---|
| Cloudflare Access 登入（Email OTP） | ✅ | 用 `player5500@gmail.com` 實測通過 |
| Cloudflare Access 登出 | ✅ | `/cdn-cgi/access/logout` 顯示成功 |
| 登出後不能繼續存取個人 API | ✅（但 UX 不佳） | 資料確實讀不到，但畫面卡在無限 loading 而非明確提示，見 `CODE_FIX_TASKS.md` TASK-04 |
| 未登入直接開啟受保護頁面 | ⏳ | 本輪未以全新無 cookie 狀態測試此情境（僅測過「登出後」，見上一項），建議另外用無痕視窗測試 |
| Session 過期／失效畫面 | ⏳ | 未實測，需等待 session 自然過期或用工具手動使 JWT 失效 |
| 一般使用者不能進入 `/admin` | ✅ | 使用者本輪任務開始前已自行確認，本次未重複測試 |
| 一般使用者不能呼叫管理 API | ✅ | 同上，回傳 `ADMIN_REQUIRED` |
| 使用者隔離（A 使用者看不到 B 使用者資料） | ⏳ | 需要第二組測試帳號才能驗證，本輪只有一組帳號 |
| 搜尋活動／歌手 | ✅ | 需先完成 TASK-01 的跨網域驗證後才正常，首次使用者會卡住 |
| 收藏活動 | ✅ | 已驗證重新整理後仍保留，資料為真 |
| 建立購票任務 | ❌ | 按鈕點擊無反應，見 TASK-02，**阻斷項目** |
| 設定預算／張數／場次順位／區域順位 | ⏳ | 因 TASK-02 無法進入表單，無法測試 |
| 完成購票準備清單 | ⏳ | 同上 |
| 建立提醒 | ❌ | 按鈕點擊無反應，見 TASK-03 |
| 儲存／重新整理／登出重新登入確認資料仍存在 | ⏳ | 因無法建立任務，無法驗證任務資料的持久性；收藏功能已單獨驗證持久性為真 |
| CORS | ✅（程式碼層級確認） | `app.ts` 對 `CORS_ORIGIN` 做精確字串比對，Staging 網域本身運作正常，但只允許單一網域，preview URL 會被擋（見 `COWORK_STAGING_AUDIT.md` 第 9 節第 8 點） |
| Rate Limit | ⏳ | 本輪未故意觸發超過限制的請求量來測試 |
| PWA（Manifest／可安裝性） | ⏳ | 本輪未測試「加入主畫面」安裝流程 |
| Extension 實機驗證 | ⏳ | Cowork 瀏覽器自動化工具無法操作 `chrome://extensions` 的「載入未封裝項目」原生檔案選取對話框，需人工在真實 Chrome/Edge 操作，見下方 Extension 章節 |
| 遮罩截圖 | ⏳ | 依賴 Extension 實機操作，本輪未測試 |
| 完整核心流程（搜尋→收藏→建立任務→…→登出重新登入） | ❌ | 卡在建立任務這一步，流程無法走完 |

## Extension 盤點結果（程式碼審查，非實機操作）

依 `COWORK_STAGING_AUDIT.md` 第 8 節與程式碼直接檢視：

- **Manifest V3**：是，`manifest_version: 3`。
- **權限**：`storage`、`activeTab`、`scripting`、`downloads`，沒有過度授權。
- **host_permissions**：只有 `http://127.0.0.1:5173/*` 與 `https://ticket-radar-web-staging.pages.dev/*`，沒有 `<all_urls>`，也沒有 KKTIX／tixCraft 網域。
- **Generic Demo Adapter**：程式碼存在（`packages/platform-adapters/src/generic-demo/`），邏輯上只會在白名單網域內執行。
- **KKTIX／tixCraft Adapter**：程式碼存在但透過 `disabled-adapter.ts` 強制停用（`fillProfile()` 回傳空陣列、偵測函式恆為 false），且瀏覽器層級 host_permissions 也沒有授權這兩個網域，等於雙重鎖死，無法注入真實售票網站。
- **本機購票資料／加密**：`crypto.ts`（PIN + Web Crypto）＋ `storage.ts`（`chrome.storage.local`，只存加密後內容）。
- **重複訂單／截圖防護**：`background.ts` 有 `prepare-capture` 確認流程，程式碼邏輯上會先要求 content script 完成遮罩才允許截圖，但**沒有實機操作，無法確認實際執行是否如預期**。

**實際驗證通過**：無（本輪沒有一項是實機操作驗證的）。
**程式碼檢查通過**：Manifest 權限最小化、KKTIX／tixCraft 雙重鎖死、加密儲存邏輯存在。
**尚需人工操作**：載入未封裝擴充功能到真實 Chrome/Edge、實際操作 Demo 售票頁完整流程（開啟→選資料→填入→送出→偵測成功頁→遮罩→截圖→建立紀錄）、確認 `captureVisibleTab` 與下載提示的實際使用者體驗。
**因瀏覽器或平台限制無法驗證**：Cowork 的瀏覽器自動化工具沒有能力操作作業系統原生的「選擇資料夾」檔案對話框，因此無法在本次任務中自動完成「載入未封裝項目」這一步，即使有心也做不到，這是工具限制而非偷懶跳過。

## 結論

**目前不能標記 Staging Ready。** 依 `staging-deployment.md` 自訂的驗收閘門，至少 TASK-01（跨網域 Access 架構）與 TASK-02（建立購票任務無反應）兩項阻斷性 P0 問題必須先修復，才有辦法把清單中標示 ⏳／❌ 的項目走完一輪完整驗證。
