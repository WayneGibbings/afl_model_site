import type { UpcomingPrediction } from "@/lib/types";

function getDateParts(dt: Date, timeZone?: string) {
  const weekday = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone }).format(dt);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone }).format(dt);
  const month = new Intl.DateTimeFormat("en-AU", { month: "short", timeZone }).format(dt);

  return { weekday, day, month };
}

export function formatMatchDate(date: string, timeZone?: string): string {
  const dt = new Date(date);
  const { weekday, day, month } = getDateParts(dt, timeZone);

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

function formatMatchDay(date: string): string {
  const isoDatePrefix = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)?.[0] ?? date.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0];
  if (isoDatePrefix) {
    const [year, month, day] = isoDatePrefix.split("-").map(Number);
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const parts = getDateParts(dt, "UTC");
    return `${parts.weekday} ${parts.day} ${parts.month}`;
  }

  const dt = new Date(date);
  const parts = getDateParts(dt);
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

export function getPredictionChronologicalValue(
  prediction: Pick<UpcomingPrediction, "date" | "kickoff_time_utc_iso">,
): number {
  const kickoffTime = prediction.kickoff_time_utc_iso;
  const source = typeof kickoffTime === "string" && kickoffTime.trim() ? kickoffTime : prediction.date;
  return new Date(source).getTime();
}

export function formatPredictionDate(
  prediction: Pick<UpcomingPrediction, "date" | "kickoff_time_utc_iso">,
  timeZone?: string,
): string {
  const isoTime = prediction.kickoff_time_utc_iso;
  if (typeof isoTime === "string" && isoTime.trim()) {
    return formatMatchDate(isoTime, timeZone);
  }

  // Fall back to the date field if it contains a time component (handles legacy data format)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(prediction.date)) {
    return formatMatchDate(prediction.date, timeZone);
  }

  return formatMatchDay(prediction.date);
}

export function formatPct(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function toOneDp(value: number): string {
  return value.toFixed(1);
}

export function toTwoDp(value: number): string {
  return value.toFixed(2);
}

export function formatMarginPoints(margin: number): string {
  return `${Math.floor(Math.abs(margin))} points`;
}
