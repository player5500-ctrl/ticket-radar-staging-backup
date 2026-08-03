import { z } from "zod";
export const purchaseRecordInputSchema = z.object({
  eventId: z.string().min(1).max(120),
  orderReferenceMasked: z
    .string()
    .min(3)
    .max(80)
    .refine((value) => /[*•…]/.test(value), "訂單參考必須先遮罩。"),
  ticketCount: z.number().int().min(1).max(20),
  sessionLabel: z.string().max(120).nullable().optional(),
  seatOrAreaMasked: z.string().max(120).nullable().optional(),
  screenshotFilename: z
    .string()
    .max(180)
    .refine(
      (value) =>
        !value.includes("/") &&
        !value.includes("\\") &&
        Array.from(value).every((character) => character.charCodeAt(0) > 31),
      "截圖檔名不可包含路徑或控制字元。",
    )
    .nullable()
    .optional(),
  notes: z.string().max(1000).default(""),
  source: z.enum(["extension_demo", "extension_adapter", "manual"]),
});
export type PurchaseRecordInput = z.infer<typeof purchaseRecordInputSchema>;
export type PurchaseRecord = PurchaseRecordInput & {
  id: string;
  eventName: string;
  orderCreatedAtUtc: string;
  orderStatus: "created" | "unconfirmed";
  pickupStatus: "unconfirmed";
};
