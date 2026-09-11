import type { PrecoolPeriod } from "./precool-period";
import type { PortfolioSite } from "./portfolio-data";

// Match the existing /api/site aggregation, deduplicating repeated navigation branches.
export function municipalSummaryMeterCount(site: Pick<PortfolioSite, "nodes">) {
  const total = site.nodes.find(node => node.seriesKey === "grid" || node.navigationKey === "municipal-total");
  const mapped = total?.meterSerials ?? [];
  if (mapped.length) return new Set(mapped).size;
  return new Set(site.nodes
    .filter(node => node.isPhysical && !node.type.toLowerCase().includes("solar"))
    .flatMap(node => node.meterSerials ?? [])).size;
}

export function siteOperationalSummary(period: PrecoolPeriod | null, municipalMeterCount: number) {
  if (!period) return null;
  const grid = period.meters.grid;
  const solar = period.meters.solar;
  const gridCoverage = municipalMeterCount > 0 && period.expectedFiveMinuteReadings > 0
    ? Math.min(100, (grid?.readings ?? 0) / (period.expectedFiveMinuteReadings * municipalMeterCount) * 100)
    : null;
  const hasGrid = gridCoverage !== null && (grid?.readings ?? 0) > 1;
  // Do not present a partial or missing export register as solar retained on site.
  const retained = hasGrid && gridCoverage >= 99.9 && (solar?.readings ?? 0) > 1
    && period.totals.meterAvailability >= 99.9
    ? Math.max(period.totals.solarEnergyMwh - period.totals.gridExportKwh / 1000, 0)
    : null;
  return {
    gridImportMwh: hasGrid ? period.totals.gridImportMwh : null,
    retainedSolarMwh: retained,
    gridCoverage,
    meterAvailability: period.totals.meterAvailability,
    inverterAvailability: period.totals.inverterAvailability,
  };
}
