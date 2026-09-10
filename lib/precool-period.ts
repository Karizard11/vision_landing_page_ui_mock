import { inverterSummary as inverterMetadata } from "@/lib/precool-data";
import { combineMeterSnapshots } from "@/lib/meter-period";
import { periodBucketMinutes, periodGranularity, type PeriodGranularity } from "@/lib/period-resolution";

export const DEFAULT_PRECOOL_DATE = "2026-08-22";

export type PrecoolPowerPoint = {
  time: string;
  pvdb1: number;
  pvdb2: number;
  incomer1: number;
  incomer2: number;
  incomer3: number;
  solar: number;
  solarStot: number;
  grid: number;
  gridStot: number;
  site: number;
  siteStot: number;
  inverter: number | null;
  ghi: number;
  sensorGhi: number | null;
  expected: number;
  [key: string]: string | number | null;
};

export type PrecoolMeterSnapshot = {
  energyMwh: number;
  peakKw: number;
  peakKva?: number;
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

export type PrecoolTelemetryHistory = {
  range: {
    from: string;
    to: string;
    granularity: PeriodGranularity;
    powerUnit: "kW" | "MWh";
  };
  inverterCode: string;
  inverterId: string;
  snapshot: { capturedAt: string; channels: PrecoolTelemetryChannel[] } | null;
  series: Array<{
    time: string;
    label: string;
    channels: PrecoolTelemetryChannel[];
  }>;
};

export type MunicipalCostLine = {
  sequence: number;
  lineKey: string;
  label: string;
  applicabilityText: string;
  touBand: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  unitRate: number | null;
  rateUnit: string | null;
  amountR: number | null;
};

export type MunicipalFinancials = {
  state: "planned" | "ready" | "warning" | "blocked";
  reasonCodes: string[];
  messages: string[];
  calculation: string;
  sourceContractId: string | null;
  tariffProfileId: number | null;
  tariffProfileName: string | null;
  tariffCurrency: string | null;
  totalImportKwh: number | null;
  totalExportKwh: number | null;
  peakDemandKva: number | null;
  peakDemandAt: string | null;
  averageCostRPerKwh: number | null;
  energyChargeR: number | null;
  demandChargeR: number | null;
  fixedChargeR: number | null;
  otherChargeR: number | null;
  subtotalExcludingVatR: number | null;
  vatRatePercent: number | null;
  vatAmountR: number | null;
  totalIncludingVatR: number | null;
  costLines: MunicipalCostLine[];
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
  site?: {
    contractId: string;
    projectCode: string;
    capacityKwp: number;
    meterKeys: string[];
    inverterCount: number;
  };
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
    powerIntervalMinutes?: number;
  };
  financials?: {
    municipal?: MunicipalFinancials;
  };
  days: Record<string, PrecoolDay>;
};

export type PrecoolPeriod = {
  from: string;
  to: string;
  dayCount: number;
  granularity: PeriodGranularity;
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
  financials: PrecoolDataset["financials"];
};

const precoolMeterKeys = ["pvdb1", "pvdb2", "incomer1", "incomer2", "incomer3"];
const numberValue = (value: number | null | undefined) => Number.isFinite(value) ? Number(value) : 0;

function dayLabel(key: string) {
  return new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

function summaryKey(key: string, granularity: "month" | "year") {
  return granularity === "month" ? key.slice(0,7) : key.slice(0,4);
}

function summaryLabel(key: string, granularity: "month" | "year") {
  if (granularity === "year") return key;
  return new Intl.DateTimeFormat("en-ZA", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00Z`));
}

function intervalLabel(key: string, time: string, dayCount: number) {
  return dayCount === 1 ? time : `${dayLabel(key)} ${time}`;
}

function averageRows(rows: PrecoolPowerPoint[], key: string) {
  return rows.reduce((sum,row) => sum + numberValue(typeof row[key] === "number" ? row[key] : 0),0) / rows.length;
}

function resamplePower(
  selected: Array<[string,PrecoolDay]>,
  granularity: PeriodGranularity,
  sourceIntervalMinutes: number,
): PrecoolPowerPoint[] {
  const dayCount = selected.length;
  if (granularity === "day" || granularity === "month" || granularity === "year") {
    const daily: Array<Record<string,string|number|null>> = selected.map(([key,day]) => {
    const irradiation = day.power.reduce((sum,row) => sum + numberValue(row.ghi) * sourceIntervalMinutes / 60 / 1000,0);
    const meterEnergy = Object.fromEntries(Object.entries(day.meters).map(([meterKey,meter]) => [meterKey,meter.energyMwh]));
    return {
      ...meterEnergy,
      date:key,
      time:dayLabel(key),
      solar:day.totals.solarEnergyMwh,
      grid:day.totals.gridImportMwh,
      inverter:day.totals.inverterReadings ? day.totals.inverterEnergyMwh : null,
      ghi:irradiation,
      sensorGhi:null,
      expected:irradiation*1851.33*0.78/1000,
    };
    });
    if (granularity === "day") return daily as unknown as PrecoolPowerPoint[];
    const grouped = new Map<string,typeof daily>();
    daily.forEach(point => {
      const key = summaryKey(String(point["date"]),granularity);
      grouped.set(key,[...(grouped.get(key) ?? []),point]);
    });
    return [...grouped.entries()].map(([key,points]) => {
      const result: Record<string,string|number|null> = {time:summaryLabel(key,granularity)};
      const numericKeys = new Set(points.flatMap(point => Object.keys(point).filter(value => value !== "time" && value !== "date" && value !== "sensorGhi")));
      numericKeys.forEach(value => {
        if (value === "inverter" && points.every(point => point["inverter"] === null)) result[value] = null;
        else result[value] = points.reduce((sum,point) => sum + numberValue(typeof point[value] === "number" ? point[value] : 0),0);
      });
      result.sensorGhi = null;
      return result as PrecoolPowerPoint;
    });
  }

  const targetMinutes = periodBucketMinutes(granularity) ?? sourceIntervalMinutes;
  const pointsPerBucket = Math.max(1,Math.round(targetMinutes/sourceIntervalMinutes));
  return selected.flatMap(([key,day]) => {
    const buckets: PrecoolPowerPoint[] = [];
    for (let index = 0; index < day.power.length; index += pointsPerBucket) {
      const rows = day.power.slice(index,index+pointsPerBucket);
      if (!rows.length) continue;
      const inverterValues = rows.map(row => row.inverter).filter((value): value is number => typeof value === "number");
      const sensorValues = rows.map(row => row.sensorGhi).filter((value): value is number => typeof value === "number");
      const result: Record<string,string|number|null> = {time:intervalLabel(key,String(rows[0].time),dayCount)};
      const numericKeys = new Set(rows.flatMap(row => Object.keys(row).filter(value => value !== "time" && value !== "inverter" && value !== "sensorGhi")));
      numericKeys.forEach(value => { result[value] = averageRows(rows,value); });
      result.inverter = inverterValues.length ? inverterValues.reduce((sum,value) => sum+value,0)/inverterValues.length : null;
      result.sensorGhi = sensorValues.length ? sensorValues.reduce((sum,value) => sum+value,0)/sensorValues.length : null;
      buckets.push(result as PrecoolPowerPoint);
    }
    return buckets;
  });
}

function resampleInverters(
  selected: Array<[string,PrecoolDay]>,
  field: "inverterAc" | "inverterDc",
  granularity: PeriodGranularity,
) {
  if (granularity === "day" || granularity === "month" || granularity === "year") {
    const summaryField = field === "inverterAc" ? "peakAc" : "peakDc";
    if (granularity === "day") return selected.map(([key,day]) => {
      const row: Record<string,string|number> = {time:dayLabel(key)};
      day.inverterSummary.forEach(item => { row[`i${item.code}`] = numberValue(item[summaryField]); });
      return row;
    });
    const grouped = new Map<string,Array<[string,PrecoolDay]>>();
    selected.forEach(entry => {
      const key = summaryKey(entry[0],granularity);
      grouped.set(key,[...(grouped.get(key) ?? []),entry]);
    });
    return [...grouped.entries()].map(([key,entries]) => {
      const row: Record<string,string|number> = {time:summaryLabel(key,granularity)};
      const codes = new Set(entries.flatMap(([,day]) => day.inverterSummary.map(item => item.code)));
      codes.forEach(code => {
        const readings = entries.flatMap(([,day]) =>
          day.inverterSummary
            .filter(item => item.code === code)
            .map(item => numberValue(item[summaryField]))
        );
        if (readings.length) row[`i${code}`] = Math.max(...readings);
      });
      return row;
    });
  }
  const bucketMinutes = periodBucketMinutes(granularity) ?? 60;
  return selected.flatMap(([key,day]) => {
    const grouped = new Map<number,Array<Record<string,string|number>>>();
    day[field].forEach(row => {
      const [hours,minutes] = String(row.time).split(":").map(Number);
      const bucket = Math.floor((hours*60+minutes)/bucketMinutes);
      grouped.set(bucket,[...(grouped.get(bucket) ?? []),row]);
    });
    return [...grouped.entries()].sort(([left],[right]) => left-right).map(([,rows]) => {
      const result: Record<string,string|number> = {time:intervalLabel(key,String(rows[0].time),selected.length)};
      const keys = new Set(rows.flatMap(row => Object.keys(row).filter(value => value !== "time")));
      keys.forEach(value => {
        const readings = rows.map(row => row[value]).filter((reading): reading is number => typeof reading === "number");
        if (readings.length) result[value] = readings.reduce((sum,reading) => sum+reading,0)/readings.length;
      });
      return result;
    });
  });
}

export function getPrecoolPeriod(data: PrecoolDataset, from: string, to: string): PrecoolPeriod {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const selected = Object.entries(data.days).filter(([key]) => key >= start && key <= end);
  const selectedDays = selected.map(([,day]) => day);
  const dayCount = selectedDays.length;
  const granularity = periodGranularity(dayCount);
  const sourceIntervalMinutes = data.range.powerIntervalMinutes ?? (selectedDays[0]?.power.length > 24 ? 5 : 60);

  const solarEnergyMwh = selectedDays.reduce((sum,day) => sum + day.totals.solarEnergyMwh,0);
  const gridImportMwh = selectedDays.reduce((sum,day) => sum + day.totals.gridImportMwh,0);
  const gridExportKwh = selectedDays.reduce((sum,day) => sum + day.totals.gridExportKwh,0);
  const inverterEnergyMwh = selectedDays.reduce((sum,day) => sum + day.totals.inverterEnergyMwh,0);
  const irradiationKwhM2 = selectedDays.reduce((sum,day) => sum + day.power.reduce((subtotal,row) => subtotal + row.ghi*sourceIntervalMinutes/60/1000,0),0);
  const capacityKwp = data.site?.capacityKwp ?? 1851.33;
  const prEstimate = irradiationKwhM2 && capacityKwp ? solarEnergyMwh*1000/(capacityKwp*irradiationKwhM2)*100 : 0;
  const lastCumulative = [...selectedDays].reverse().map(day => day.totals.cumulativeEnergyGwh).find(value => value !== null) ?? null;
  const inverterReadings = selectedDays.reduce((sum,day) => sum + day.totals.inverterReadings,0);

  const meterKeys = data.site?.meterKeys ?? precoolMeterKeys;
  const meters = Object.fromEntries(meterKeys.map(key => {
    const snapshots = selectedDays.map(day => day.meters[key]).filter(Boolean);
    return [key,combineMeterSnapshots(snapshots)];
  }));

  const power = resamplePower(selected,granularity,sourceIntervalMinutes);

  const observedInverters = new Map(selectedDays.flatMap(day => day.inverterSummary).map(item => [item.code,item]));
  const inverterList = data.site?.projectCode === "P0480"
    ? inverterMetadata.map(metadata => observedInverters.get(metadata.code) ?? metadata)
    : [...observedInverters.values()].sort((left,right) => left.code.localeCompare(right.code,undefined,{numeric:true}));
  const inverterSummary = inverterList.map(metadata => {
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

  const inverterAc = resampleInverters(selected,"inverterAc",granularity);
  const inverterDc = resampleInverters(selected,"inverterDc",granularity);
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
    granularity,
    totals:{
      solarEnergyMwh,
      inverterEnergyMwh,
      gridImportMwh,
      gridExportKwh,
      estimatedLoadMwh:gridImportMwh+solarEnergyMwh-gridExportKwh/1000,
      avoidedCostZar:selectedDays.reduce((sum,day) => sum + day.totals.avoidedCostZar,0),
      cumulativeEnergyGwh:lastCumulative,
      peakAcMw:Math.max(0,...selectedDays.map(day => day.totals.peakAcMw)),
      peakSolarKw:Math.max(0,...selectedDays.map(day => day.totals.peakSolarKw)),
      solcastPeakGhi:Math.max(0,...selectedDays.map(day => day.totals.solcastPeakGhi)),
      prEstimate,
      meterAvailability:dayCount ? selectedDays.reduce((sum,day) => sum + day.totals.meterAvailability,0)/dayCount : 0,
      inverterAvailability:dayCount && inverterList.length ? inverterReadings/(dayCount*288*inverterList.length)*100 : 0,
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
    financials:data.financials ?? {},
  };
}
