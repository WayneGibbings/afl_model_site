export function formatMatchDate(date: string, timeZone?: string): string {
  const dt = new Date(date);
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone }).format(dt);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone }).format(dt);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone }).format(dt);

  const timeParts = new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
    timeZone,
  }).formatToParts(dt);

  const hour = timeParts.find((part) => part.type === "hour")?.value ?? "";
  const minute = timeParts.find((part) => part.type === "minute")?.value ?? "";
  const dayPeriod = (timeParts.find((part) => part.type === "dayPeriod")?.value ?? "").toLowerCase();
  const timeZoneShort = timeParts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const time = `${hour}:${minute}${dayPeriod}`;

  return `${weekday} ${day} ${month} ${time} ${timeZoneShort}`.trim();
}

export function formatPct(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

export function toOneDp(value: number): string {
  return value.toFixed(1);
}

export function toTwoDp(value: number): string {
  return value.toFixed(2);
}
