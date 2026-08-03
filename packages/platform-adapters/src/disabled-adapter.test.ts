import { describe, expect, it } from "vitest";
import { kktixAdapter } from "./kktix/adapter";
import { tixcraftAdapter } from "./tixcraft/adapter";

const inertDocument = {} as Document;

describe("停用中的真實售票平台 Adapter", () => {
  it("只辨識 HTTPS 官方網域與其子網域", () => {
    expect(kktixAdapter.matchesUrl("https://kktix.com/events/demo")).toBe(true);
    expect(kktixAdapter.matchesUrl("https://artist.kktix.cc/events/demo")).toBe(true);
    expect(tixcraftAdapter.matchesUrl("https://tixcraft.com/activity/demo")).toBe(true);
  });

  it("拒絕相似網域、尾綴攻擊、非 HTTPS 與無效網址", () => {
    expect(kktixAdapter.matchesUrl("https://kktix.com.evil.example/")).toBe(false);
    expect(kktixAdapter.matchesUrl("https://fake-kktix.com/")).toBe(false);
    expect(tixcraftAdapter.matchesUrl("https://fake-tixcraft.com/")).toBe(false);
    expect(tixcraftAdapter.matchesUrl("http://tixcraft.com/")).toBe(false);
    expect(tixcraftAdapter.matchesUrl("not-a-url")).toBe(false);
  });

  it.each([kktixAdapter, tixcraftAdapter])(
    "$name 維持停用且不具任何購票操作能力",
    (adapter) => {
      expect(adapter.status).toBe("disabled");
      expect(adapter.supportedFields).toEqual([]);
      expect(adapter.detectPage(inertDocument)).toBe(false);
      expect(adapter.fillProfile(inertDocument, { purchaserName: "不應填入" })).toEqual(
        [],
      );
      expect(adapter.detectSuccess(inertDocument)).toBe(false);
      expect(adapter.redactSuccess(inertDocument)).toEqual({
        reliable: false,
        count: 0,
      });
      expect(adapter.capabilities).toEqual({
        recognizeHost: true,
        inspectPurchasePage: false,
        fillContactFields: false,
        selectTicketOrSeat: false,
        acceptTerms: false,
        submitOrder: false,
        handlePayment: false,
        handleChallenge: false,
        capturePurchaseResult: false,
      });
    },
  );
});
