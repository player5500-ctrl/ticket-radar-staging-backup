import type { Reminder } from "@ticket-radar/shared";

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function downloadReminderIcs(reminder: Reminder) {
  const start = reminder.scheduledAtUtc
    .replace(/[-:]/g, "")
    .replace(".000", "")
    .replace("Z", "Z");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ticket Radar//Phase 2//ZH-TW",
    "BEGIN:VEVENT",
    `UID:${reminder.id}@ticket-radar.local`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `SUMMARY:${escapeIcs(`提醒：${reminder.eventName}`)}`,
    `DESCRIPTION:${escapeIcs(reminder.customMessage ?? "請以主辦與售票平台官方公告為準。")}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "ticket-radar-reminder.ics";
  link.click();
  URL.revokeObjectURL(url);
}
