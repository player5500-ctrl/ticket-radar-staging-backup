# 售票平台 Adapter 評估紀錄

最後查核：2026-07-29（Asia/Taipei）

## 安全邊界

Ticket Radar 的 Adapter 只能在平台條款、頁面結構、固定測試環境與授權都確認後，
才可能從 `disabled` 進入 `testing`。即使進入測試，也永遠不得：

- 選擇票種、張數、區域或座位。
- 勾選或代替使用者同意服務條款與隱私政策。
- 操作排隊、驗證碼、CAPTCHA、簡訊碼或身分驗證。
- 送出訂單、選擇付款方式、輸入付款資料或完成付款。
- 擷取未能可靠遮罩的訂單、條碼、QR Code 或個人資料。

## 2026-07-29 評估結果

| Adapter                   | 狀態       |              網域辨識 |      DOM 讀取／填入 | 擴充功能權限 | 判斷                                         |
| ------------------------- | ---------- | --------------------: | ------------------: | -----------: | -------------------------------------------- |
| Ticket Radar Generic Demo | `active`   | 本機 `127.0.0.1:5173` | 僅姓名、Email、電話 |     已限本機 | 保留                                         |
| KKTIX                     | `disabled` |       僅作純 URL 比對 |                關閉 |       未加入 | 尚無固定測試頁、穩定 selector 與明確整合許可 |
| 拓元 tixCraft             | `disabled` |       僅作純 URL 比對 |                關閉 |       未加入 | 條款明確禁止自動程式操控購票流程或公平性     |

`matchesUrl()` 僅供未來評估與狀態辨識；停用 Adapter 的 `detectPage()`、
`fillProfile()`、成功偵測與遮罩全部是無操作回傳，不會讀寫真實頁面。

## 官方依據

### KKTIX

- [KKTIX 線上購票流程](https://support.kktix.com/hc/en-001/articles/23055347123993--Online-ticket-purchase-on-KKTIX)：
  官方流程把票種與張數、條款／隱私政策、聯絡資料、付款與訂單確認列為不同步驟。
- [KKTIX 運動幣使用說明](https://support.kktix.com/hc/zh-tw/articles/56947829032729-KKTIX-%E9%81%8B%E5%8B%95%E5%B9%A3%E4%BD%BF%E7%94%A8%E8%AA%AA%E6%98%8E%E8%88%87%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A0%85)：
  流程可能包含身分證末四碼、付款碼、簡訊驗證碼與限時確認，全部屬禁止碰觸範圍。
- [KKTIX 電子票券 QR Code 注意事項](https://support.kktix.com/hc/zh-tw/articles/23055982841369-%E5%8F%B0%E7%81%A3%E5%9C%B0%E5%8D%80%E9%9B%BB%E5%AD%90%E7%A5%A8%E5%88%B8-QRCode-%E4%BD%BF%E7%94%A8%E6%B3%A8%E6%84%8F%E4%BA%8B%E9%A0%85)：
  QR Code 視同票券且每張限用一次，不得在遮罩不可靠時擷取。

目前沒有找到足以授權 Ticket Radar 注入頁面或自動填寫的官方依據，且官方流程註明
實際畫面依活動而異。因此不能承諾支援，也不新增 `kktix.com` / `kktix.cc` 權限。

### 拓元 tixCraft

- [tixCraft 會員服務條款](https://tixcraft.com/terms-of-use)：
  第 9 條禁止使用自動程式、軟體或其他技術手段干擾、繞過或操控正常購票流程或系統公平性；
  本次查核頁面標示最後修訂為 2026-05-28。
- [tixCraft 購票流程](https://help.tixcraft.com/hc/zh-tw/articles/4404363906961-%E8%B3%BC%E7%A5%A8%E6%B5%81%E7%A8%8B%E8%AA%AA%E6%98%8E)：
  流程包含手機驗證、選位／區域、張數、付款／取票、限時結帳，並提醒不要使用多視窗或多裝置。
- [tixCraft 隱私權政策](https://tixcraft.com/privacy)：
  購票資料可能包含姓名、生日、Email、電話、地址與付款、取票身分資料。

因此 tixCraft Adapter 不進入測試，也不新增 `tixcraft.com` 權限。

## 重新評估門檻

必須同時具備以下證據，才可提出新的、獨立審查的 `testing` 變更：

1. 平台提供的書面整合許可或明確允許的公開政策。
2. 平台提供的測試／沙盒環境，不使用熱門活動或正式庫存。
3. 已確認固定且只指向聯絡資料的 selector。
4. 測試證明無法觸及票種、張數、座位、條款、驗證、送單與付款控制項。
5. 敏感資訊遮罩測試與故障時預設關閉。
6. 另案審查後才可最小化新增 `host_permissions`。
