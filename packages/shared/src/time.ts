export const DEFAULT_TIMEZONE = "Asia/Taipei";

export function isValidTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("zh-TW", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function formatEventDate(isoUtc: string, timeZone = DEFAULT_TIMEZONE): string {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("無效的 IANA 時區");
  }

  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("無效的 UTC 日期");
  }

  return new Intl.DateTimeFormat("zh-TW", {
    timeZone,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
