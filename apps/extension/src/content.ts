import {
  clearDemoRedaction,
  detectDemoPage,
  detectDemoSuccess,
  fillDemoProfile,
  redactDemoSuccess,
} from "@ticket-radar/platform-adapters";

chrome.runtime.onMessage.addListener(
  (message: { type?: string; profile?: unknown }, _sender, sendResponse) => {
    if (message.type === "ticket-radar:fill-demo") {
      if (!detectDemoPage(document)) {
        sendResponse({ ok: false, message: "目前不是受控 Demo 售票頁。" });
        return;
      }
      const results = fillDemoProfile(document, message.profile);
      sendResponse({
        ok: results.every((item) => item.status === "filled"),
        results,
      });
      return;
    }

    if (message.type === "ticket-radar:prepare-capture") {
      if (!detectDemoSuccess(document)) {
        sendResponse({ ok: false, message: "目前不是受控 Demo 成功頁。" });
        return;
      }
      const result = redactDemoSuccess(document);
      sendResponse({
        ok: result.reliable,
        result,
        message: result.reliable ? undefined : "敏感區域遮罩不完整，已取消截圖。",
      });
      return;
    }

    if (message.type === "ticket-radar:clear-redaction") {
      clearDemoRedaction(document);
      sendResponse({ ok: true });
    }
  },
);
