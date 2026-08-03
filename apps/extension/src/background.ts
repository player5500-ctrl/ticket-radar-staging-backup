import {
  createCaptureKey,
  createScreenshotFilename,
  isDuplicateCapture,
  type CaptureReceipt,
} from "./capture";

chrome.runtime.onMessage.addListener(
  (message: { type?: string; profile?: unknown }, _sender, sendResponse) => {
    if (
      message.type !== "ticket-radar:fill-demo" &&
      message.type !== "ticket-radar:capture-demo"
    )
      return;
    void chrome.tabs
      .query({ active: true, lastFocusedWindow: true })
      .then(async ([tab]) => {
        const allowedOrigins = [
          "http://127.0.0.1:5173",
          "https://ticket-radar-web-staging.pages.dev",
        ];
        if (
          !tab?.id ||
          !tab.url ||
          !allowedOrigins.some((origin) => tab.url?.startsWith(`${origin}/`))
        ) {
          sendResponse({ ok: false, message: "請先開啟受控 Demo 售票頁。" });
          return;
        }
        if (message.type === "ticket-radar:fill-demo") {
          const result: unknown = await chrome.tabs.sendMessage(tab.id, {
            type: "ticket-radar:fill-demo",
            profile: message.profile,
          });
          sendResponse(result);
          return;
        }

        const now = new Date();
        const captureKey = createCaptureKey(tab.url);
        const storageKey = "ticketRadar.lastCapture";
        const stored = await chrome.storage.local.get(storageKey);
        const receipt = stored[storageKey] as CaptureReceipt | undefined;
        if (isDuplicateCapture(receipt, captureKey)) {
          sendResponse({
            ok: true,
            duplicate: true,
            filename: receipt?.filename,
            message: "已保存過同一 Demo 訂單截圖，未重複下載。",
          });
          return;
        }

        let redactionApplied = false;
        try {
          const prepared: unknown = await chrome.tabs.sendMessage(tab.id, {
            type: "ticket-radar:prepare-capture",
          });
          if (
            typeof prepared !== "object" ||
            prepared === null ||
            !("ok" in prepared) ||
            prepared.ok !== true
          ) {
            sendResponse({
              ok: false,
              message: "敏感區域遮罩不完整，已取消截圖。",
            });
            return;
          }
          redactionApplied = true;
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: "png",
          });
          const filename = createScreenshotFilename(now);
          await chrome.downloads.download({
            url: dataUrl,
            filename,
            saveAs: true,
          });
          const nextReceipt: CaptureReceipt = {
            key: captureKey,
            capturedAt: now.toISOString(),
            filename,
          };
          await chrome.storage.local.set({ [storageKey]: nextReceipt });
          sendResponse({ ok: true, filename });
        } finally {
          if (redactionApplied) {
            await chrome.tabs
              .sendMessage(tab.id, { type: "ticket-radar:clear-redaction" })
              .catch(() => undefined);
          }
        }
      })
      .catch(() => sendResponse({ ok: false, message: "無法完成受控 Demo 截圖。" }));
    return true;
  },
);
