import { describe, expect, it } from "vitest";
import { decryptProfile, encryptProfile } from "./crypto";

describe("本機資料組加密", () => {
  const profile = {
    label: "本人",
    purchaserName: "王小明",
    email: "test@example.com",
    phone: "0912345678",
  };

  it("使用 PIN 加密後可解密，且每次 IV 與 salt 不同", async () => {
    const first = await encryptProfile(profile, "123456");
    const second = await encryptProfile(profile, "123456");
    await expect(decryptProfile(first, "123456")).resolves.toEqual(profile);
    expect(first.iv).not.toBe(second.iv);
    expect(first.salt).not.toBe(second.salt);
  });

  it("錯誤 PIN 不可解密", async () => {
    const encrypted = await encryptProfile(profile, "123456");
    await expect(decryptProfile(encrypted, "654321")).rejects.toBeDefined();
  });
});
