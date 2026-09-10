import { inverterSummary as inverterMetadata } from "@/lib/precool-data";

export const DEFAULT_PRECOOL_DATE = "2026-08-22";

export type PrecoolPowerPoint = {
  time: string;
  pvdb1: number;
  pvdb2: number;
  incomer1: number;
  incomer2: number;
  incomer3: number;
  solar: number;
  grid: number;
  inverter: number | null;
  ghi: number;
  sensorGhi: number | null;
  expected: number;
};

export type PrecoolMeterSnapshot = {
  energyMwh: number;
  peakKw: number;
  readings: number;
};

export type PrecoolInverterSnapshot = {
  code: string;
  id: string;
  name: string;
  model: string;
  peakAc: number;
  peakDc: number;
  energy: number;
  cumulative: number;
  readings: number;
};

export type PrecoolTelemetryChannel = {
  channel: number;
  current: number;
  voltage: number;
  power: number;
};

export type PrecoolDay = {
  totals: {
    solarEnergyMwh: number;
    inverterEnergyMwh: number;
    gridImportMwh: number;
    gridExportKwh: number;
    estimatedLoadMwh: number;
    avoidedCostZar: number;
    cumulativeEnergyGwh: number | null;
    peakAcMw: number;
    peakSolarKw: number;
    solcastPeakGhi: number;
    prEstimate: number;
    meterAvailability: number;
    inverterAvailability: number;
    inverterReadings: number;
  };
  meters: Record<string, PrecoolMeterSnapshot>;
  power: PrecoolPowerPoint[];
  inverterSummary: PrecoolInverterSnapshot[];
  inverterAc: Array<Record<string, string | number>>;
  inverterDc: Array<Record<string, string | number>>;
  telemetry: Record<string, { capturedAt: string; channels: PrecoolTelemetryChannel[] }>;
};

export type PrecoolDataset = {
  range: {
    from: string;
    to: string;
    latestCompleteInverterDay: string | null;
    partialInverterDay: string | null;
    partialInverterThrough: string | null;
    sensorAvailable: boolean;
    meterSource: string;
    inverterSource: string;
    irradianceSource: string;
    dataAsOf: string | null;
  };
  days: Record<string, PrecoolDay>;
};

export type PrecoolPeriod = {
  from: string;
  to: string;
  dayCount: number;
  granularity: "hour" | "day";
  totals: PrecoolDay["totals"];
  meters: Record<string, PrecoolMeterSnapshot>;
  power: PrecoolPowerPoint[];
  inverterSummary: Array<PrecoolInverterSnapshot & { hasData: boolean; availability: number }>;
  inverterAc: Array<Record<string, string | number>>;
  inverterDc: Array<Record<string, string | number>>;
  telemetry: Record<string, { capturedAt: string; channels: PrecoolTelemetryChannel[] }>;
  telemetryDate: string | null;
  inverterCoverage: "complete" | "partial" | "unavailable" | "mixed";
  sensorAvailable: boolean;
  source: PrecoolDataset["range"];
};

const meterKeys = ["pvdb1", "pvdb2", "incomer1", "incomer2", "incomer3"];
const numberValue = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

export function getPrecoolPeriod(data: PrecoolDataset, from: string, to: string): PrecoolPeriod {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const selected = Object.entries(data.days).filter(([key]) => key >= start && key <= end);
  const selectedDays = selected.map(([,day]) => day);
  const dayCount = selectedDays.length;
  const singleDay = dayCount === 1;

  const solarEnergyMwh = selectedDays.reduce((sum,day) => sum + day.totals.solarEnergyMwh,0);
  const gridImportMwh = selectedDays.reduce((sum,day) => sum + day.totals.gridImportMwh,0);
  const gridExportKwh = selectedDays.reduce((sum,day) => sum + day.totals.gridExportKwh,0);
  const inverterEnergyMwh = selectedDays.reduce((sum,day) => sum + day.totals.inverterEnergyMwh,0);
  const irradiationKwhM2 = selectedDays.reduce((sum,day) => sum + day.power.reduce((subtotal,row) => subtotal + row.ghi/1000,0),0);
  const prEstimate = irradiationKwhM2 ? solarEnergyMwh*1000/(1851.33*irradiationKwhM2)*100 : 0;
  const lastCumulative = [...selectedDays].reverse().map(day => day.totals.cumulativeEnergyGwh).find(value => value !== null) ?? null;
  const inverterReadings = selectedDays.reduce((sum,day) => sum + day.totals.inverterReadings,0);

  const meters = Object.fromEntries(meterKeys.map(key => {
    const snapshots = selectedDays.map(day => day.meters[key]).filter(Boolean);
    return [key,{
      energyMwh:snapshots.reduce((sum,item) => sum + item.energyMwh,0),
      peakKw:Math.max(0,...snapshots.map(item => item.peakKw)),
      readings:snapshots.reduce((sum,item) => sum + item.readings,0),
    }];
  }));

  const power = singleDay ? selectedDays[0].power : selected.map(([key,day]) => {
    const irradiation = day.power.reduce((sum,row) => sum + row.ghi/1000,0);
    return {
      time:dayLabel(key),
      pvdb1:day.meters.pvdb1.energyMwh,
      pvdb2:day.meters.pvdb2.energyMwh,
      incomer1:day.meters.incomer1.energyMwh,
      incomer2:day.meters.incomer2.energyMwh,
      incomer3:day.meters.incomer3.energyMwh,
      solar:day.totals.solarEnergyMwh,
      grid:day.totals.gridImportMwh,
      inverter:day.totals.inverterReadings ? day.totals.inverterEnergyMwh : null,
      ghi:irradiation,
      sensorGhi:null,
      expected:irradiation*1851.33*0.78/1000,
    };
  });

  const inverterSummary = inverterMetadata.map(metadata => {
    const snapshots = selectedDays.map(day => day.inverterSummary.find(item => item.code === metadata.code)).filter((item): item is PrecoolInverterSnapshot => Boolean(item));
    const last = snapshots.at(-1);
    const readings = snapshots.reduce((sum,item) => sum + item.readings,0);
    return {
      code:metadata.code,
      id:last?.id ?? metadata.id,
      name:last?.name ?? metadata.name,
      model:last?.model ?? metadata.model,
      peakAc:Math.max(0,...snapshots.map(item => item.peakAc)),
      peakDc:Math.max(0,...snapshots.map(item => item.peakDc)),
      energy:snapshots.reduce((sum,item) => sum + item.energy,0),
      cumulative:last?.cumulative ?? 0,
      readings,
      hasData:snapshots.length > 0,
      availability:dayCount ? readings/(dayCount*288)*100 : 0,
    };
  });

  const buildDailyInverterSeries = (field: "peakAc" | "peakDc") => selected.map(([key,day]) => {
    const row: Record<string,string|number> = {time:dayLabel(key)};
    day.inverterSummary.forEach(item => { row[`i${item.code}`] = numberValue(item[field]); });
    return row;
  });
  const inverterAc = singleDay ? selectedDays[0].inverterAc : buildDailyInverterSeries("peakAc");
  const inverterDc = singleDay ? selectedDays[0].inverterDc : buildDailyInverterSeries("peakDc");
  const telemetryEntry = [...selected].reverse().find(([,day]) => Object.keys(day.telemetry).length > 0);
  const telemetry = telemetryEntry?.[1].telemetry ?? {};
  const telemetryDate = telemetryEntry?.[0] ?? null;

  const inverterAvailabilities = selectedDays.map(day => day.totals.inverterAvailability);
  const inverterCoverage = inverterAvailabilities.every(value => value >= 99.9)
    ? "complete"
    : inverterAvailabilities.every(value => value === 0)
      ? "unavailable"
      : dayCount === 1
        ? "partial"
        : "mixed";

  return {
    from:start,
    to:end,
    dayCount,
    granularity:singleDay ? "hour" : "day",
    totals:{
      solarEnergyMwh,
      inverterEnergyMwh,
      gridImportMwh,
      gridExportKwh,
      estimatedLoadMwh:gridImportMwh+solarEnergyMwh-gridExportKwh/1000,
      avoidedCostZar:solarEnergyMwh*1000*0.88,
      cumulativeEnergyGwh:lastCumulative,
      peakAcMw:Math.max(0,...selectedDays.map(day => day.totals.peakAcMw)),
      peakSolarKw:Math.max(0,...selectedDays.map(day => day.totals.peakSolarKw)),
      solcastPeakGhi:Math.max(0,...selectedDays.map(day => day.totals.solcastPeakGhi)),
      prEstimate,
      meterAvailability:dayCount ? selectedDays.reduce((sum,day) => sum + day.totals.meterAvailability,0)/dayCount : 0,
      inverterAvailability:dayCount ? inverterReadings/(dayCount*288*12)*100 : 0,
      inverterReadings,
    },
    meters,
    power,
    inverterSummary,
    inverterAc,
    inverterDc,
    telemetry,
    telemetryDate,
    inverterCoverage,
    sensorAvailable:data.range.sensorAvailable,
    source:data.range,
  };
}
