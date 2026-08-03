import { describe, expect, it } from "vitest";
import {
  clearDemoRedaction,
  detectDemoPage,
  detectDemoSuccess,
  fillDemoProfile,
  redactDemoSuccess,
} from "./adapter";

function fakeDocument(withRoot = true) {
  const fields = new Map<string, HTMLInputElement>();
  for (const field of ["purchaserName", "email", "phone"])
    fields.set(field, {
      value: "",
      dispatchEvent: () => true,
    } as unknown as HTMLInputElement);
  return {
    querySelector: (selector: string) =>
      selector === "[data-ticket-radar-demo='ticket-form']"
        ? withRoot
          ? {}
          : null
        : (fields.get(selector.match(/data-tr-field='([^']+)'/)?.[1] ?? "") ?? null),
  } as unknown as Document;
}

describe("Generic Demo Adapter", () => {
  it("只在受控 Demo 頁辨識頁面", () =>
    expect(detectDemoPage(fakeDocument())).toBe(true));
  it("只填入白名單聯絡欄位", () =>
    expect(
      fillDemoProfile(fakeDocument(), {
        label: "本人",
        purchaserName: "王小明",
        email: "test@example.com",
        phone: "0912345678",
      }).map((item) => item.status),
    ).toEqual(["filled", "filled", "filled"]));
  it("拒絕包含未允許欄位的資料", () =>
    expect(
      fillDemoProfile(fakeDocument(), {
        label: "本人",
        purchaserName: "王小明",
        email: "test@example.com",
        phone: "0912345678",
        password: "no",
      }).every((item) => item.status === "invalid"),
    ).toBe(true));

  it("成功頁只在敏感 selector 命中時允許截圖", () => {
    const target = {
      dataset: {},
      style: { background: "", color: "" },
    };
    const document = {
      querySelector: (selector: string) =>
        selector === "[data-ticket-radar-demo='success']" ? {} : null,
      querySelectorAll: (selector: string) =>
        selector === "[data-tr-sensitive]" || selector === "[data-tr-redacted='true']"
          ? [target]
          : [],
    } as unknown as Document;

    expect(detectDemoSuccess(document)).toBe(true);
    expect(redactDemoSuccess(document)).toEqual({ reliable: true, count: 1 });
    expect(target.dataset).toEqual({ trRedacted: "true" });
    clearDemoRedaction(document);
    expect(target.dataset).toEqual({});
  });

  it("沒有敏感 selector 時判定遮罩不可靠", () => {
    const document = {
      querySelectorAll: () => [],
    } as unknown as Document;
    expect(redactDemoSuccess(document)).toEqual({ reliable: false, count: 0 });
  });
});
