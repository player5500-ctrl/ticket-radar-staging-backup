import type { EventStatus } from "@ticket-radar/shared";

type StatusTone = "info" | "success" | "warning" | "neutral" | "danger";

export const eventStatusMeta: Record<EventStatus, { label: string; tone: StatusTone }> =
  {
    announced: { label: "已公告", tone: "info" },
    registration: { label: "登記中", tone: "warning" },
    presale: { label: "預售準備", tone: "info" },
    on_sale: { label: "一般售票", tone: "success" },
    sold_out: { label: "已售罄", tone: "neutral" },
    postponed: { label: "延期", tone: "warning" },
    cancelled: { label: "取消", tone: "danger" },
    completed: { label: "已結束", tone: "neutral" },
    unconfirmed: { label: "待確認", tone: "warning" },
  };

export const saleTypeLabels: Record<string, string> = {
  fan_registration_deadline: "會員登記截止",
  member_presale: "會員預售",
  card_presale: "信用卡預售",
  organizer_presale: "主辦預售",
  lottery_registration_start: "抽選登記開始",
  lottery_registration_end: "抽選登記截止",
  lottery_result: "抽選結果",
  general_sale: "一般售票",
  payment_deadline: "付款截止",
  pickup_start: "取票開始",
  event_reminder: "活動提醒",
};
