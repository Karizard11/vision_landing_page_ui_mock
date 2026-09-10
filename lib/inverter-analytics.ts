import type { PrecoolPeriod } from "./precool-period.ts";
import { periodBucketMinutes } from "./period-resolution.ts";

export type InverterEnergyPoint = {
  time: string;
  energy: number | null;
  cumulative: number;
};

export type InverterHeatmapCell = {
  time: string;
  value: number | null;
  intensity: number | null;
};

export type InverterHeatmapRow = {
  code: string;
  cells: InverterHeatmapCell[];
};

export function buildInverterEnergySeries(
  period: Pick<PrecoolPeriod, "granularity" | "power">,
): InverterEnergyPoint[] {
  const bucketMinutes = periodBucketMinutes(period.granularity);
  let cumulative = 0;
  return period.power.map(point => {
    const reading = typeof point.inverter === "number" && Number.isFinite(point.inverter)
      ? Math.max(0,point.inverter)
      : null;
    const energy = reading === null
      ? null
      : bucketMinutes === null ? reading : reading * bucketMinutes / 60;
    if (energy !== null) cumulative += energy;
    return {time:String(point.time),energy,cumulative};
  });
}

export function buildInverterHeatmap(
  period: Pick<PrecoolPeriod, "inverterAc" | "inverterSummary">,
): { maximum: number; rows: InverterHeatmapRow[] } {
  const values = period.inverterAc.flatMap(point =>
    period.inverterSummary
      .map(inverter => point[`i${inverter.code}`])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
  );
  const maximum = Math.max(0,...values);
  return {
    maximum,
    rows:period.inverterSummary.map(inverter => ({
      code:inverter.code,
      cells:period.inverterAc.map(point => {
        const reading = point[`i${inverter.code}`];
        const value = typeof reading === "number" && Number.isFinite(reading) ? Math.max(0,reading) : null;
        return {
          time:String(point.time),
          value,
          intensity:value === null || maximum === 0 ? null : Math.min(1,value/maximum),
        };
      }),
    })),
  };
}
