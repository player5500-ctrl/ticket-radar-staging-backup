import { describe, expect, it } from "vitest";

import {
  createCaptureKey,
  createScreenshotFilename,
  isDuplicateCapture,
} from "./capture";

describe("安全截圖防重", () => {
  it("產生不含路徑控制字元的檔名", () => {
    expect(createScreenshotFilename(new Date("2026-07-29T09:10:11.000Z"))).toBe(
      "TicketRadar_Demo_created_20260729-091011.png",
    );
  });

  it("同一受控 Demo 成功頁跨時間仍視為重複", () => {
    const key = createCaptureKey("http://127.0.0.1:5173/demo-ticket");
    expect(
      isDuplicateCapture(
        {
          key,
          capturedAt: "2026-07-29T09:10:11.000Z",
          filename: "safe.png",
        },
        key,
      ),
    ).toBe(true);
  });
});
