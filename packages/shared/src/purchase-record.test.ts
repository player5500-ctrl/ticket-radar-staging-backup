import { describe, expect, it } from "vitest";

import { purchaseRecordInputSchema } from "./purchase-record";

const validRecord = {
  eventId: "event-demo",
  orderReferenceMasked: "DEMO-***-4821",
  ticketCount: 1,
  notes: "",
  source: "extension_demo" as const,
};

describe("購票紀錄輸入", () => {
  it("接受遮罩後訂單參考與安全本機檔名", () => {
    expect(
      purchaseRecordInputSchema.safeParse({
        ...validRecord,
        screenshotFilename: "TicketRadar_Demo_created_20260729-091011.png",
      }).success,
    ).toBe(true);
  });

  it("拒絕未遮罩訂單編號", () => {
    expect(
      purchaseRecordInputSchema.safeParse({
        ...validRecord,
        orderReferenceMasked: "DEMO-ORDER-4821",
      }).success,
    ).toBe(false);
  });

  it("拒絕包含路徑的截圖檔名", () => {
    expect(
      purchaseRecordInputSchema.safeParse({
        ...validRecord,
        screenshotFilename: "../private.png",
      }).success,
    ).toBe(false);
  });
});
