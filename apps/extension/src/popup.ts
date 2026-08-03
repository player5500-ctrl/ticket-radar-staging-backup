import { decryptProfile, encryptProfile } from "./crypto";
import { loadEnvelope, saveEnvelope, validateProfile } from "./storage";

const form = document.querySelector<HTMLFormElement>("#profile-form")!;
const fill = document.querySelector<HTMLButtonElement>("#fill")!;
const capture = document.querySelector<HTMLButtonElement>("#capture")!;
const status = document.querySelector<HTMLElement>("#status")!;
const setStatus = (message: string) => {
  status.textContent = message;
};
function isFillResponse(value: unknown): value is { ok: boolean; message?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof value.ok === "boolean"
  );
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    try {
      const data = Object.fromEntries(new FormData(form));
      const pinValue = data.pin;
      const pin = typeof pinValue === "string" ? pinValue : "";
      delete data.pin;
      const profile = validateProfile(data);
      await saveEnvelope(await encryptProfile(profile, pin));
      form.reset();
      setStatus("資料組已加密保存於此裝置。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "無法保存資料組。");
    }
  })();
});
fill.addEventListener("click", () => {
  void (async () => {
    const pin = window.prompt("輸入 PIN 以解鎖後填入本機 Demo 頁：") ?? "";
    if (!pin) return;
    try {
      const envelope = await loadEnvelope();
      if (!envelope) {
        setStatus("請先建立資料組。");
        return;
      }
      const profile = await decryptProfile(envelope, pin);
      const response: unknown = await chrome.runtime.sendMessage({
        type: "ticket-radar:fill-demo",
        profile,
      });
      if (!isFillResponse(response)) {
        setStatus("Demo 頁回應格式不正確。");
        return;
      }
      setStatus(
        response.ok
          ? "已填入 3 項基本聯絡欄位，請自行確認與手動送出。"
          : (response.message ?? "無法填入 Demo 頁。"),
      );
    } catch {
      setStatus("PIN 錯誤或資料組無法解鎖。");
    }
  })();
});

capture.addEventListener("click", () => {
  void (async () => {
    capture.disabled = true;
    try {
      const response: unknown = await chrome.runtime.sendMessage({
        type: "ticket-radar:capture-demo",
      });
      if (!isFillResponse(response)) {
        setStatus("截圖回應格式不正確。");
        return;
      }
      setStatus(
        response.ok
          ? (response.message ?? "遮罩後截圖已交由瀏覽器保存。")
          : (response.message ?? "無法保存遮罩後截圖。"),
      );
    } finally {
      capture.disabled = false;
    }
  })();
});
