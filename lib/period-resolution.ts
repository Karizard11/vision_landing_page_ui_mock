export type PeriodGranularity = "5min" | "30min" | "hour" | "day";

export function periodGranularity(dayCount: number): PeriodGranularity {
  if (dayCount <= 1) return "5min";
  if (dayCount <= 4) return "30min";
  if (dayCount <= 14) return "hour";
  return "day";
}

export function periodBucketMinutes(granularity: PeriodGranularity) {
  if (granularity === "5min") return 5;
  if (granularity === "30min") return 30;
  if (granularity === "hour") return 60;
  return null;
}

export function periodResolutionLabel(granularity: PeriodGranularity) {
  if (granularity === "5min") return "5-minute";
  if (granularity === "30min") return "30-minute";
  if (granularity === "hour") return "hourly";
  return "daily";
}
