"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, ArrowUpRight, BatteryCharging, Building2,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleGauge, Database,
  Factory, Gauge, Home, Info, Layers3, Network, Search, SunMedium, Users, Zap,
} from "lucide-react";
import { addDays, endOfMonth, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type LegendPayload,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteContractPerformance } from "@/components/site-contract-performance";
import { contractSiteLabel, portfolios, siteNavigationId, sitesForPortfolio, isVirtualTotalNode, portfolioSites, siteNavigationNodes, type PortfolioNavigationNode, type PortfolioNode, type PortfolioSite } from "@/lib/portfolio-data";
import { inverterConfiguration, inverterSummary as inverterMetadata, type InverterElectricalConfig } from "@/lib/precool-data";
import { buildInverterEnergySeries, buildInverterHeatmap } from "@/lib/inverter-analytics";
import { DEFAULT_PRECOOL_DATE, getPrecoolPeriod, type PrecoolDataset, type PrecoolMeterSnapshot, type PrecoolPeriod, type PrecoolTelemetryHistory } from "@/lib/precool-period";
import { periodResolutionLabel, periodUsesBars } from "@/lib/period-resolution";

type View =
  | { kind: "portfolio"; portfolioId?: string }
  | { kind: "site"; siteCode: string }
  | { kind: "meter"; siteCode: string; nodeId: string }
  | { kind: "inverters"; siteCode: "P0480" }
  | { kind: "inverter"; siteCode: "P0480"; inverterCode: string };
type Navigate = (view: View) => void;
type SurfaceMode = "performance" | "dashboard";
type DashboardRange = DateRange & { fromTime: string; toTime: string };

const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const appRoute = (path: string) => appBasePath + path;

const anchorDate = new Date(`${DEFAULT_PRECOOL_DATE}T00:00:00`);
const today = new Date();
const chartMargin = { top: 8, right: 12, left: -20, bottom: 0 };
const inverterColours = ["#0c5a63","#14717b","#23848c","#3f969b","#63aaab","#86bbbb","#f1b14b","#ed9b43","#ec8446","#ed6a4e","#d85448","#a94545"];

function useChartSeriesVisibility(fontSize = 8) {
  const [hiddenSeries,setHiddenSeries] = useState<Set<string>>(() => new Set());
  const onLegendClick = (entry: LegendPayload) => {
    if (entry.dataKey === undefined || entry.dataKey === null) return;
    const key = String(entry.dataKey);
    setHiddenSeries(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  return {
    isHidden: (key: string) => hiddenSeries.has(key),
    legendProps: { onClick:onLegendClick, wrapperStyle:{fontSize,cursor:"pointer"} },
  };
}

function periodChartUnit(period: PrecoolPeriod) {
  if (period.granularity === "day") return "MWh/day";
  if (period.granularity === "month") return "MWh/month";
  if (period.granularity === "year") return "MWh/year";
  return "kW";
}

const powerNumber = (value: string | number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const stotKey = (key: string) => `${key}Stot`;

function withSitePowerTotals(power: PrecoolPeriod["power"]) {
  return power.map(point => ({
    ...point,
    site: typeof point.site === "number" ? point.site : powerNumber(point.grid) + powerNumber(point.solar),
    siteStot: typeof point.siteStot === "number" ? point.siteStot : powerNumber(point.gridStot) + powerNumber(point.solarStot),
  }));
}

function AggregateSupplyChart({ data, daily, chartUnit, chartVisibility, area = false, expectation = false }: {
  data: PrecoolPeriod["power"];
  daily: boolean;
  chartUnit: string;
  chartVisibility: ReturnType<typeof useChartSeriesVisibility>;
  area?: boolean;
  expectation?: boolean;
}) {
  if (daily) return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/><Bar stackId="site-supply" dataKey="grid" name="Municipal Total energy (MWh)" fill="#31808a" hide={chartVisibility.isHidden("grid")}/><Bar stackId="site-supply" dataKey="solar" name="Solar Total energy (MWh)" fill="#65ba75" hide={chartVisibility.isHidden("solar")}/><Bar dataKey="site" name="Site Total energy (MWh)" fill="#173f49" hide={chartVisibility.isHidden("site")}/>{expectation && <Bar dataKey="expected" name="Solcast expectation (MWh)" fill="#83b48b" hide={chartVisibility.isHidden("expected")}/>}</BarChart></ResponsiveContainer>;
  return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/>{area ? <><Area type="monotone" stackId="site-supply" dataKey="grid" name={`Municipal Total Ptot (${chartUnit})`} stroke="#286f79" fill="#31808a" fillOpacity={0.55} dot={false} hide={chartVisibility.isHidden("grid")}/><Area type="monotone" stackId="site-supply" dataKey="solar" name={`Solar Total Ptot (${chartUnit})`} stroke="#55a96f" fill="#65ba75" fillOpacity={0.58} dot={false} hide={chartVisibility.isHidden("solar")}/></> : <><Line type="monotone" dataKey="grid" name={`Municipal Total Ptot (${chartUnit})`} stroke="#526f76" strokeWidth={1.5} dot={false} hide={chartVisibility.isHidden("grid")}/><Line type="monotone" dataKey="solar" name={`Solar Total Ptot (${chartUnit})`} stroke="#249b61" strokeWidth={1.8} dot={false} hide={chartVisibility.isHidden("solar")}/></>}<Line type="monotone" dataKey="site" name={`Site Total Ptot (${chartUnit})`} stroke="#083f49" strokeWidth={2.2} dot={false} hide={chartVisibility.isHidden("site")}/><Line type="monotone" dataKey="gridStot" name="Municipal Total Stot (kVA)" stroke="#82979c" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("gridStot")}/><Line type="monotone" dataKey="solarStot" name="Solar Total Stot (kVA)" stroke="#8bc69a" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("solarStot")}/><Line type="monotone" dataKey="siteStot" name="Site Total Stot (kVA)" stroke="#d26a57" strokeWidth={1.8} strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("siteStot")}/>{expectation && <Line type="monotone" dataKey="expected" name={`Solcast expectation (${chartUnit})`} stroke="#ef705f" strokeDasharray="2 4" dot={false} hide={chartVisibility.isHidden("expected")}/>}</ComposedChart></ResponsiveContainer>;
}

function num(value: number, digits = 1) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function selectedSite(view: View, sites: PortfolioSite[]) {
  const fallback = sites.find(item => item.code === "P0480") ?? portfolioSites.find(item => item.code === "P0480")!;
  if (view.kind === "portfolio") return view.portfolioId === "redefine-properties" ? sitesForPortfolio(sites,view.portfolioId)[0] ?? fallback : fallback;
  return sites.find(item => siteNavigationId(item) === view.siteCode) ?? sites.find(item => item.code === view.siteCode) ?? fallback;
}

function p0480MeterId(nodeId: string) {
  return ({ "p0480-site-total":"site-total", "1140726":"load-total", "1140723":"solar-total", "1140730":"pvdb-1", "1140721":"pvdb-2", "1140727":"municipal-total", "1140724":"incomer-1", "1140728":"incomer-2", "1140729":"incomer-3" } as Record<string,string>)[nodeId];
}

function DateSelector({ range, onChange }: { range: DashboardRange; onChange: (range: DashboardRange) => void }) {
  const [draft, setDraft] = useState<DateRange | undefined>(range);
  const [fromTime,setFromTime] = useState(range.fromTime);
  const [toTime,setToTime] = useState(range.toTime);
  const [open, setOpen] = useState(false);
  const label = range.from
    ? `${format(range.from,"MMM dd, yyyy")} [${range.fromTime}] - ${format(range.to ?? range.from,"MMM dd, yyyy")} [${range.toTime}] SAST`
    : "Select date range";
  const draftFrom = draft?.from ? format(draft.from,"yyyy-MM-dd") : "";
  const draftTo = draft?.from ? format(draft.to ?? draft.from,"yyyy-MM-dd") : "";
  const invalid = Boolean(draft?.from && `${draftTo}T${toTime}` < `${draftFrom}T${fromTime}`);
  const yesterday = addDays(today,-1);
  const previousMonth = subMonths(startOfMonth(today),1);
  const presets: [string, Date, Date][] = [
    ["Today", today, today],
    ["Yesterday", yesterday, yesterday],
    ["Since Yesterday", yesterday, today],
    ["Last 7 days", addDays(today,-6), today],
    ["Last 30 days", addDays(today,-29), today],
    ["This Month", startOfMonth(today), today],
    ["Last Month", previousMonth, endOfMonth(previousMonth)],
    ["Year to date", startOfYear(today), today],
    ["Twelve Months", startOfMonth(subMonths(today,12)), today],
  ];
  return <div className="date-navigation"><Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setDraft(range); setFromTime(range.fromTime); setToTime(range.toTime); } }}>
    <PopoverTrigger asChild><Button variant="outline" className="date-button" aria-label={`Date range: ${label}`}><CalendarDays/><span className="date-button-label">{label}</span></Button></PopoverTrigger>
    <PopoverContent align="end" className="date-picker"><div className="date-picker-layout">
      <Calendar mode="range" numberOfMonths={2} selected={draft} onSelect={setDraft} defaultMonth={subMonths(startOfMonth(draft?.from ?? anchorDate),1)} disabled={{after:today}}/>
      <div className="date-preset-list">{presets.map(([text,from,to]) => <button key={text} onClick={() => { setDraft({from,to}); setFromTime("00:00"); setToTime("23:59"); }}>{text}</button>)}</div>
    </div><div className="date-time-fields">
      <label><span>Start time</span><input type="time" step={300} value={fromTime} onChange={event => setFromTime(event.target.value)}/></label>
      <label><span>End time</span><input type="time" step={300} value={toTime} onChange={event => setToTime(event.target.value)}/></label>
      <span className="timezone-badge">SAST</span>
    </div>{invalid && <p className="date-time-error">End time must be after start time.</p>}
    <div className="date-picker-actions"><button className="apply" disabled={!draft?.from || invalid} onClick={() => { if (draft?.from && !invalid) onChange({from:draft.from,to:draft.to ?? draft.from,fromTime,toTime}); setOpen(false); }}>Apply</button><button onClick={() => setDraft(undefined)}>Clear</button></div></PopoverContent>
  </Popover></div>;
}

function BrandLogo() {
  return <div className="brand-logo" aria-label="Terradew"><span/><span/><span/><span/></div>;
}

function nodeDepth(node: PortfolioNode, nodes: PortfolioNode[]) {
  let depth = 0;
  let parent = node.parentId;
  const seen = new Set<string>();
  while (parent && depth < 3 && !seen.has(parent)) { seen.add(parent); const found = nodes.find(item => (item.navigationKey ?? item.id) === parent); if (!found) break; depth += 1; parent = found.parentId; }
  return depth;
}

function navigationNodeIsVisible(siteCode: string, node: PortfolioNavigationNode, nodes: PortfolioNavigationNode[], collapsed: ReadonlySet<string>) {
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find(candidate => candidate.navigationKey === parentId || candidate.id === parentId);
    if (!parent) break;
    if (collapsed.has(`${siteCode}:${parent.navigationKey}`)) return false;
    parentId = parent.parentId;
  }
  return true;
}

function NodeIcon({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower.includes("solar")) return <SunMedium/>;
  if (lower.includes("load") || lower.includes("remainder")) return <Factory/>;
  if (lower.includes("bess")) return <BatteryCharging/>;
  if (lower.includes("generator")) return <Zap/>;
  return <CircleGauge/>;
}

function NavigationSidebar({ view, navigate, sites }: { view: View; navigate: Navigate; sites: PortfolioSite[] }) {
  const current = selectedSite(view,sites);
  const selectedPortfolio = view.kind === "portfolio" ? view.portfolioId ?? "terradew-four" : current.portfolioId ?? "terradew-four";
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["P0480:3"]));
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const visibleSites = sites.filter(item => !query || `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase()));
  function openSite(item: PortfolioSite) { setExpanded(previous => { const next = new Set(previous); if (next.has(siteNavigationId(item)) && siteNavigationId(current) === siteNavigationId(item)) next.delete(siteNavigationId(item)); else next.add(siteNavigationId(item)); return next; }); navigate({kind:"site",siteCode:siteNavigationId(item)}); }
  function toggleNode(key: string) { setCollapsedNodes(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  return <Sidebar collapsible="icon" className="navigation-sidebar">
    <div className="teal-rail">
      <button className="logo-button" onClick={() => navigate({kind:"portfolio"})}><BrandLogo/></button>
      <div className="rail-links"><button className={view.kind === "portfolio" ? "active" : ""} onClick={() => navigate({kind:"portfolio"})} aria-label="Portfolio"><Home/></button><button aria-label="Asset data"><Database/></button><button aria-label="Teams"><Users/></button></div>
      <div className="rail-avatar">KC</div>
    </div>
    <SidebarTrigger className="sidebar-collapse"/>
    <section className="white-navigation">
      <div className="navigation-title"><strong>Navigation</strong><Network/></div>
      <label className="nav-search"><Search/><input aria-label="Search sites" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <div className="navigation-tree">
        {portfolios.map(portfolio => <div key={portfolio.id} className="portfolio-tree">
        <button className={`provider-row ${selectedPortfolio === portfolio.id ? "active" : ""}`} onClick={() => navigate({kind:"portfolio",portfolioId:portfolio.id})} title={portfolio.description}>{selectedPortfolio===portfolio.id?<ChevronDown/>:<ChevronRight/>}<Layers3/><span>{portfolio.name}</span><small>({sitesForPortfolio(sites,portfolio.id).length})</small></button>
        {(selectedPortfolio === portfolio.id || query ? sitesForPortfolio(visibleSites,portfolio.id) : []).map(item => { const activeSite = view.kind !== "portfolio" && (view.siteCode === siteNavigationId(item) || view.siteCode === item.code); const isOpen = expanded.has(siteNavigationId(item)) || activeSite; const navigationNodes = siteNavigationNodes(item); return <div className="site-tree" key={siteNavigationId(item)}>
          <button className={`site-tree-row ${activeSite ? "active" : ""}`} onClick={() => openSite(item)} title={`Contract ${item.contractId ?? "unavailable"}`}><ChevronRight className={isOpen ? "rotated" : ""}/><Building2/><span>{item.displayName ?? contractSiteLabel(item)}</span><small>({item.meterCount})</small></button>
          {isOpen && <div className="site-node-list">{navigationNodes.map(node => {
            const collapseKey = `${siteNavigationId(item)}:${node.navigationKey}`;
            if (!navigationNodeIsVisible(siteNavigationId(item),node,navigationNodes,collapsedNodes)) return null;
            const activeNode = view.kind === "meter" && view.siteCode === siteNavigationId(item) && view.nodeId === node.navigationKey;
            const branchInverters = item.code !== "P0480" ? [] : node.id === "1140730" ? inverterMetadata.slice(0,6) : node.id === "1140721" ? inverterMetadata.slice(6,12) : [];
            const hasChildren = navigationNodes.some(candidate => candidate.parentId === node.navigationKey) || branchInverters.length > 0 || (item.code === "P0480" && node.id === "1140723");
            const isExpanded = !collapsedNodes.has(collapseKey);
            return <div className="node-branch" key={`${item.code}-${node.navigationKey}`}>
              <div style={{paddingLeft:20 + nodeDepth(node,navigationNodes) * 14}} className={`node-row node-parent-row ${activeNode ? "active" : ""}`}>
                {hasChildren ? <button type="button" className="node-toggle" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`} aria-expanded={isExpanded} onClick={() => toggleNode(collapseKey)}><ChevronRight className={isExpanded ? "rotated" : ""}/></button> : <span className="node-toggle-spacer"/>}
                <button type="button" className="node-link" onClick={() => navigate({kind:"meter",siteCode:siteNavigationId(item),nodeId:node.navigationKey})}><NodeIcon type={node.type}/><span>{node.name}</span>{node.measurementKind === "calculated" && !isVirtualTotalNode(node) ? <small className="virtual-node-label">virtual</small> : node.meters > 1 && <small>{node.meters}</small>}</button>
              </div>
              {isExpanded && item.code === "P0480" && node.id === "1140723" && <button style={{paddingLeft:20 + (nodeDepth(node,navigationNodes)+1) * 14}} className={`node-row inverter-node ${view.kind === "inverters" ? "active" : ""}`} onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><span className="node-toggle-spacer"/><Layers3/><span>Inverter total</span><small>12</small></button>}
              {isExpanded && branchInverters.map(inv => <button style={{paddingLeft:20 + (nodeDepth(node,navigationNodes)+1) * 14}} key={inv.code} className={`node-row inverter-unit ${view.kind === "inverter" && view.inverterCode === inv.code ? "active" : ""}`} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><span className="node-toggle-spacer"/><Gauge/><span>Inverter {inv.code.padStart(3,"0")}</span></button>)}
            </div>;
          })}</div>}
        </div>; })}
        </div>)}
      </div>
    </section>
  </Sidebar>;
}

function Breadcrumb({ view, navigate, sites }: { view: View; navigate: Navigate; sites: PortfolioSite[] }) {
  if (view.kind === "portfolio") return <><Database/><strong>Portfolio</strong></>;
  const item = selectedSite(view,sites);
  let tail = item.name;
  if (view.kind === "meter") tail = item.nodes.find(node => (node.navigationKey ?? node.id) === view.nodeId)?.name ?? "Meter";
  if (view.kind === "inverters") tail = "Inverter total";
  if (view.kind === "inverter") tail = `Inverter ${view.inverterCode}`;
  return <><Database/><button onClick={() => navigate({kind:"portfolio",portfolioId:item.portfolioId})}>Portfolio</button><ChevronRight/><button onClick={() => navigate({kind:"site",siteCode:siteNavigationId(item)})}>{item.name}</button>{view.kind !== "site" && <><ChevronRight/><strong>{tail}</strong></>}</>;
}

function Topbar({ view, navigate, range, onRangeChange, sites, mode, onModeChange }: { view: View; navigate: Navigate; range: DashboardRange; onRangeChange: (range: DashboardRange) => void; sites: PortfolioSite[]; mode: SurfaceMode; onModeChange: (mode: SurfaceMode) => void }) {
  const showModeSwitch = view.kind === "site" || view.kind === "meter";
  return <><header className="top-bar"><div className="top-breadcrumb"><Breadcrumb view={view} navigate={navigate} sites={sites}/></div><label className="property-search"><Search/><input placeholder="Search property" aria-label="Search property"/></label><div className="top-actions"><DateSelector range={range} onChange={onRangeChange}/></div></header>
  {showModeSwitch && <div className="view-switch" role="group" aria-label="View mode"><button className={mode === "performance" ? "active" : ""} aria-pressed={mode === "performance"} onClick={() => onModeChange("performance")}>Performance <Activity/></button><button className={mode === "dashboard" ? "active" : ""} aria-pressed={mode === "dashboard"} onClick={() => onModeChange("dashboard")}>Dashboard</button></div>}</>;
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>;
}

function MiniBars({ danger = false }: { danger?: boolean }) { return <div className="mini-bars"><i/><i/><i/><i/><i/><i className={danger ? "danger" : "accent"}/></div>; }

function Kpi({ icon: Icon, label, value, unit, note, delta, tone, bars }: { icon: LucideIcon; label: string; value: string; unit?: string; note: string; delta?: string; tone?: "green"|"red"|"amber"; bars?: boolean }) {
  return <article className="kpi-card"><div className="kpi-head"><span><Icon/>{label}<Info/></span>{delta && <em><ArrowUpRight/>{delta}</em>}</div><div className={`kpi-value ${tone ?? ""}`}>{value}<small>{unit}</small></div>{bars && <MiniBars danger={tone === "red"}/>}<p className={tone === "red" ? "red-note" : ""}>{note}</p></article>;
}

function ChartPanel({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <article className={`panel chart-panel ${className}`}><div className="panel-head"><strong>{title}</strong>{hint && <span>{hint}</span>}</div><div className="chart-area">{children}</div></article>;
}

type DashboardSeriesSpec = {
  key: string;
  name: string;
  color: string;
  area?: boolean;
  dashed?: boolean;
  stackId?: string;
};

function DashboardSeriesChart({ title, hint, data, daily, series }: { title: string; hint: string; data: Array<Record<string,string|number|null>>; daily: boolean; series: DashboardSeriesSpec[] }) {
  const visibility = useChartSeriesVisibility(7);
  return <ChartPanel title={title} hint={hint} className="dashboard-chart-panel"><ResponsiveContainer width="100%" height="100%">{daily
    ? <BarChart data={data} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...visibility.legendProps}/>{series.map(item => <Bar key={item.key} dataKey={item.key} name={item.name} stackId={item.stackId} fill={item.color} maxBarSize={24} hide={visibility.isHidden(item.key)}/>)}</BarChart>
    : <ComposedChart data={data} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...visibility.legendProps}/>{series.map(item => item.area ? <Area key={item.key} type="monotone" dataKey={item.key} name={item.name} stackId={item.stackId} stroke={item.color} fill={item.color} fillOpacity={.42} dot={false} hide={visibility.isHidden(item.key)}/> : <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} strokeWidth={1.8} strokeDasharray={item.dashed ? "5 3" : undefined} dot={false} connectNulls={false} hide={visibility.isHidden(item.key)}/>)}</ComposedChart>
  }</ResponsiveContainer></ChartPanel>;
}

function DashboardStatsPanel({ title, hint, metrics }: { title: string; hint: string; metrics: Array<{label:string;value:string;unit?:string;note?:string;tone?:"green"|"amber"}> }) {
  return <article className="panel dashboard-stats-panel"><div className="panel-head"><strong>{title}</strong><span>{hint}</span></div><div className="dashboard-stat-grid">{metrics.map(metric => <div className={metric.tone ?? ""} key={metric.label}><span>{metric.label}</span><strong>{metric.value}{metric.unit && <small>{metric.unit}</small>}</strong>{metric.note && <em>{metric.note}</em>}</div>)}</div></article>;
}

function DashboardEmptyPanel({ title, hint, message }: { title: string; hint: string; message: string }) {
  return <article className="panel dashboard-empty-panel"><div className="panel-head"><strong>{title}</strong><span>{hint}</span></div><div><Database/><strong>Data unavailable</strong><span>{message}</span></div></article>;
}

function periodEnergyMwh(period: PrecoolPeriod, value: number) {
  if (periodUsesBars(period.granularity)) return Math.max(value,0);
  const minutes = period.granularity === "5min" ? 5 : period.granularity === "30min" ? 30 : 60;
  return Math.max(value,0)*minutes/60/1000;
}

function dashboardPeriodRows(period: PrecoolPeriod) {
  const pricedTotal = period.financials?.municipal?.state === "ready" ? period.financials.municipal.totalIncludingVatR : null;
  return withSitePowerTotals(period.power).map(point => {
    const gridEnergy = periodEnergyMwh(period,powerNumber(point.grid));
    const solarEnergy = periodEnergyMwh(period,powerNumber(point.solar));
    return {
      ...point,
      gridEnergy,
      solarEnergy,
      siteEnergy:gridEnergy+solarEnergy,
      gridCost:pricedTotal !== null && period.totals.gridImportMwh > 0 ? pricedTotal*gridEnergy/period.totals.gridImportMwh : null,
    };
  });
}

function InsightMetric({ label, value, unit, note, tone = "" }: { label: string; value: string; unit?: string; note: string; tone?: "good" | "warning" | "" }) {
  return <div className={`insight-metric ${tone}`}><span>{label}</span><strong>{value}{unit && <small>{unit}</small>}</strong><em>{note}</em></div>;
}

function DisclosureSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <details className="panel section-disclosure">
    <summary><span><ChevronRight/><strong>{title}</strong></span><small>{hint}</small></summary>
    <div className="section-disclosure-body">{children}</div>
  </details>;
}

function expectedSolarEnergyMwh(period: PrecoolPeriod) {
  const total = period.power.reduce((sum,point) => sum + powerNumber(point.expected),0);
  if (periodUsesBars(period.granularity)) return total;
  const minutes = period.granularity === "5min" ? 5 : period.granularity === "30min" ? 30 : 60;
  return total * minutes / 60 / 1000;
}

function PortfolioContractPanels({ sites }: { sites: PortfolioSite[] }) {
  const visibility = useChartSeriesVisibility();
  const ranked = [...sites].sort((left,right) => right.capacityKwp-left.capacityKwp);
  const capacityData = ranked.slice(0,8).map(item => ({site:item.code,capacity:item.capacityKwp/1000}));
  const priced = sites.filter(item => typeof item.tariff === "number" && item.tariff > 0);
  const pricedCapacity = priced.reduce((sum,item) => sum+item.capacityKwp,0);
  const weightedRate = pricedCapacity ? priced.reduce((sum,item) => sum+item.capacityKwp*(item.tariff ?? 0),0)/pricedCapacity : 0;
  const lowest = [...priced].sort((left,right) => (left.tariff ?? 0)-(right.tariff ?? 0))[0];
  const highest = [...priced].sort((left,right) => (right.tariff ?? 0)-(left.tariff ?? 0))[0];
  const activeSystems = sites.filter(item => item.systemActive !== false && item.systemKey).length;
  return <div className="portfolio-contract-panels">
    <ChartPanel title="Largest contracted systems" hint="installed DC capacity · MWp"><ResponsiveContainer width="100%" height="100%"><BarChart data={capacityData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="site" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...visibility.legendProps}/><Bar dataKey="capacity" name="Contracted capacity (MWp)" fill="#1f7f88" hide={visibility.isHidden("capacity")}/></BarChart></ResponsiveContainer></ChartPanel>
    <article className="panel contract-terms"><div className="panel-head"><strong>Commercial and operating coverage</strong><span>contract catalog</span></div><InsightMetric label="Capacity-weighted PPA rate" value={weightedRate ? `R ${num(weightedRate,3)}` : "—"} unit={weightedRate ? "/kWh" : undefined} note={`${priced.length} contracts with a current rate`}/><InsightMetric label="Rate range" value={lowest && highest ? `R ${num(lowest.tariff ?? 0,2)} – R ${num(highest.tariff ?? 0,2)}` : "—"} note={lowest && highest ? `${lowest.code} to ${highest.code}` : "No contract rates"}/><InsightMetric label="VCOM-linked systems" value={`${activeSystems} / ${sites.length}`} note="active or linked in the contract catalog" tone={activeSystems === sites.length ? "good" : "warning"}/><InsightMetric label="Missing current PPA rate" value={String(sites.length-priced.length)} note="shown as unavailable, not estimated" tone={sites.length === priced.length ? "good" : "warning"}/></article>
  </div>;
}

function EnergyBalancePanel({ period }: { period: PrecoolPeriod }) {
  const load = period.totals.estimatedLoadMwh;
  const solar = period.totals.solarEnergyMwh;
  const exportMwh = period.totals.gridExportKwh/1000;
  const retainedSolar = Math.max(solar-exportMwh,0);
  const solarShare = load > 0 ? retainedSolar/load*100 : 0;
  const gridShare = load > 0 ? period.totals.gridImportMwh/load*100 : 0;
  return <article className="panel insight-panel"><div className="panel-head"><strong>Site energy balance</strong><span>{selectedPeriodLabel(period)}</span></div><div className="insight-grid"><InsightMetric label="Estimated site load" value={num(load,3)} unit="MWh" note="municipal import + solar - export"/><InsightMetric label="Solar retained on site" value={num(retainedSolar,3)} unit="MWh" note={`${num(solarShare,1)}% of estimated load`} tone="good"/><InsightMetric label="Municipal contribution" value={num(period.totals.gridImportMwh,3)} unit="MWh" note={`${num(gridShare,1)}% of estimated load`}/><InsightMetric label="Grid export" value={num(period.totals.gridExportKwh,1)} unit="kWh" note="measured at municipal boundary"/></div></article>;
}

function SolarCommercialPanel({ item, period, meter, scope, siteWide = false }: { item: PortfolioSite; period: PrecoolPeriod; meter: PrecoolMeterSnapshot | undefined; scope: string; siteWide?: boolean }) {
  const visibility = useChartSeriesVisibility();
  const actual = meter?.energyMwh ?? period.totals.solarEnergyMwh;
  const expected = expectedSolarEnergyMwh(period);
  const plan = item.annualYieldKwh/365*period.durationDays/1000;
  const rateValue = item.tariff ? actual*1000*item.tariff : null;
  const comparison = siteWide ? [
    {basis:"Metered",energy:actual},
    {basis:"Solcast",energy:expected},
    {basis:"Contract plan",energy:plan},
  ] : [
    {basis:"Selected meter",energy:actual},
    {basis:"Site Solar Total",energy:period.totals.solarEnergyMwh},
  ];
  const siteShare = period.totals.solarEnergyMwh > 0 ? actual/period.totals.solarEnergyMwh*100 : 0;
  return <section className="context-section"><div className="section-label"><strong>Solar performance and commercial context</strong><span>{scope}</span></div><div className="context-two-column">
    <ChartPanel title={siteWide ? "Energy comparison" : "Meter contribution"} hint={siteWide ? "selected period · MWh" : "selected meter versus site Solar Total · MWh"}><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="basis" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...visibility.legendProps}/><Bar dataKey="energy" name="Energy (MWh)" fill="#39a66b" hide={visibility.isHidden("energy")}/></BarChart></ResponsiveContainer></ChartPanel>
    <article className="panel insight-panel"><div className="panel-head"><strong>Commercial bridge</strong><span>solar report semantics</span></div><div className="insight-grid"><InsightMetric label="Current PPA rate" value={item.tariff ? `R ${num(item.tariff,3)}` : "—"} unit={item.tariff ? "/kWh" : undefined} note="mv_contracts_solar.current_ppa_rate"/><InsightMetric label="Generation at current PPA rate" value={rateValue === null ? "—" : `R ${num(rateValue,0)}`} note="metered generation x current rate" tone={rateValue === null ? "warning" : "good"}/><InsightMetric label={siteWide ? "Versus Solcast" : "Share of site solar"} value={siteWide ? expected ? `${actual >= expected ? "+" : ""}${num((actual-expected)/expected*100,1)}%` : "—" : `${num(siteShare,1)}%`} note={`${num(actual,3)} MWh metered`}/><InsightMetric label={siteWide ? "Specific yield" : "Site Solar Total"} value={siteWide ? item.capacityKwp ? num(actual*1000/item.capacityKwp,2) : "—" : num(period.totals.solarEnergyMwh,3)} unit={siteWide ? item.capacityKwp ? "kWh/kWp" : undefined : "MWh"} note={siteWide ? "selected-period generation" : "same selected period"}/></div><p className="semantic-note">This rate exposure is not labelled as savings or an invoice. The solar report separately prices municipal avoided energy, PPA energy, demand effects and feed-in benefit before reporting financial savings.</p></article>
  </div></section>;
}

function MunicipalFinancialPanel({ period }: { period: PrecoolPeriod }) {
  const visibility = useChartSeriesVisibility();
  const financials = period.financials?.municipal;
  if (!financials || financials.state !== "ready" || financials.totalIncludingVatR === null) return <section className="context-section"><div className="section-label"><strong>Municipal electricity cost build-up</strong><span>reporting tariff pricing</span></div><article className="panel financial-unavailable"><AlertTriangle/><div><strong>Pricing Result unavailable</strong><span>{financials?.messages[0] ?? "No reporting tariff-pricing result was returned for this municipal total."}</span></div></article></section>;
  const split = [
    {category:"Energy",amount:financials.energyChargeR ?? 0},
    {category:"Demand",amount:financials.demandChargeR ?? 0},
    {category:"Fixed",amount:financials.fixedChargeR ?? 0},
    {category:"Other",amount:financials.otherChargeR ?? 0},
    {category:"VAT",amount:financials.vatAmountR ?? 0},
  ];
  const lines = [...financials.costLines].filter(line => line.amountR !== null).sort((left,right) => Math.abs(right.amountR ?? 0)-Math.abs(left.amountR ?? 0)).slice(0,8);
  return <section className="context-section"><div className="section-label"><strong>Municipal electricity cost build-up</strong><span>{financials.tariffProfileName ?? "Tariff"} · Single Meter contract {financials.sourceContractId ?? "—"}</span></div>
    <div className="kpi-grid financial-kpis"><Kpi icon={Database} label="Total incl. VAT" value={`R ${num(financials.totalIncludingVatR,0)}`} note="complete Pricing Result" tone="green"/><Kpi icon={Zap} label="Energy charges" value={`R ${num(financials.energyChargeR ?? 0,0)}`} note="all classified energy lines"/><Kpi icon={Gauge} label="Demand charges" value={`R ${num(financials.demandChargeR ?? 0,0)}`} note={financials.peakDemandKva === null ? "No demand quantity" : `${num(financials.peakDemandKva,1)} kVA maximum`}/><Kpi icon={Activity} label="Average cost" value={financials.averageCostRPerKwh === null ? "—" : `R ${num(financials.averageCostRPerKwh,2)}`} unit={financials.averageCostRPerKwh === null ? undefined : "/kWh"} note="subtotal excl. VAT / priced energy"/></div>
    <div className="context-two-column"><ChartPanel title="Charge composition" hint="ZAR · tariff engine result"><ResponsiveContainer width="100%" height="100%"><BarChart data={split} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="category" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...visibility.legendProps}/><Bar dataKey="amount" name="Amount (R)" fill="#176873" hide={visibility.isHidden("amount")}/></BarChart></ResponsiveContainer></ChartPanel>
      <article className="panel tariff-lines"><div className="panel-head"><strong>Largest tariff lines</strong><span>excl. VAT</span></div>{lines.map(line => <div key={line.lineKey}><span><b>{line.label}</b><small>{line.applicabilityText}</small></span><strong>R {num(line.amountR ?? 0,2)}</strong></div>)}</article></div>
    <p className="pricing-lineage">Calculated by the canonical reporting tariff-pricing engine from the mapped municipal Single Meter contract. Subtotal R {num(financials.subtotalExcludingVatR ?? 0,2)} + VAT R {num(financials.vatAmountR ?? 0,2)}.</p>
  </section>;
}

function DemandSignal({ label, value, note, progress, warning = false }: { label: string; value: string; note: string; progress: number; warning?: boolean }) {
  const width = Math.max(0,Math.min(progress,100));
  return <div className={`demand-signal ${warning ? "warning" : ""}`}><div><span>{label}</span><strong>{value}</strong></div><div className="demand-signal-track"><i style={{width:`${width}%`}}/></div><small>{note}</small></div>;
}

function MeterOperatingPanel({ node, meter, period }: { node: PortfolioNode; meter: PrecoolMeterSnapshot | undefined; period: PrecoolPeriod }) {
  const seriesKey = node.seriesKey ?? "";
  const apparentKey = stotKey(seriesKey);
  const measuredPoints = period.power.filter(point => powerNumber(point[seriesKey]) > 0 || powerNumber(point[apparentKey]) > 0);
  const apparentPeakPoint = measuredPoints.length ? measuredPoints.reduce((best,point) => powerNumber(point[apparentKey]) > powerNumber(best[apparentKey]) ? point : best) : null;
  const apparentAtPeak = apparentPeakPoint ? powerNumber(apparentPeakPoint[apparentKey]) : 0;
  const activeAtPeak = apparentPeakPoint ? powerNumber(apparentPeakPoint[seriesKey]) : 0;
  const powerFactor = apparentAtPeak > 0 ? Math.min(Math.abs(activeAtPeak/apparentAtPeak),1) : 0;
  const hours = Math.max(period.durationMinutes/60,1);
  const loadFactor = meter && meter.peakKw > 0 ? meter.energyMwh*1000/(meter.peakKw*hours)*100 : 0;
  const gridShare = meter && period.totals.gridImportMwh > 0 ? meter.energyMwh/period.totals.gridImportMwh*100 : 0;
  const expectedReadings = period.expectedFiveMinuteReadings*Math.max(node.meters,1);
  const coverage = meter && expectedReadings ? meter.readings/expectedReadings*100 : 0;
  const missing = Math.max(expectedReadings-(meter?.readings ?? 0),0);
  const status = powerFactor >= .95 ? "Healthy" : powerFactor >= .9 ? "Watch" : powerFactor > 0 ? "Low" : "Unavailable";
  const scoreTone = powerFactor >= .95 ? "good" : powerFactor > 0 ? "warning" : "unavailable";
  return <section className="context-section"><div className="section-label"><strong>Demand insights</strong><span>Ptot and Stot · selected period</span></div><article className="panel demand-insight-panel">
    <div className={`demand-score ${scoreTone}`}><div className="demand-score-icon"><Gauge/></div><div className="demand-score-copy"><span>Power factor at highest load</span><strong>{powerFactor ? num(powerFactor,3) : "—"}<small> PF</small></strong><small>{apparentPeakPoint ? `${String(apparentPeakPoint.time)} · ${num(activeAtPeak,1)} kW / ${num(apparentAtPeak,1)} kVA` : "No synchronised Ptot and Stot interval"}</small></div><em>{status}</em></div>
    <div className="demand-signal-list"><DemandSignal label="Load factor" value={`${num(loadFactor,1)}%`} progress={loadFactor} note="selected-period energy versus peak demand"/><DemandSignal label="Municipal contribution" value={`${num(gridShare,1)}%`} progress={gridShare} note={`${num(meter?.energyMwh ?? 0,3)} MWh of measured municipal import`}/><DemandSignal label="Data coverage" value={`${num(coverage,1)}%`} progress={coverage} warning={coverage < 99.9} note={missing ? `${missing.toLocaleString("en-ZA")} five-minute intervals missing` : "all expected intervals received"}/></div>
  </article></section>;
}

function selectedPeriodLabel(period: PrecoolPeriod) {
  const from = format(new Date(`${period.from}T00:00:00`),"dd MMM yyyy");
  const to = format(new Date(`${period.to}T00:00:00`),"dd MMM yyyy");
  return period.from === period.to ? from : `${from} – ${to}`;
}

function CoverageNotice({ period }: { period: PrecoolPeriod }) {
  const meterCoverage = period.totals.meterAvailability;
  if (meterCoverage === 0 && period.totals.inverterReadings === 0) return <div className="coverage-notice warning"><AlertTriangle/>No meter or inverter readings were returned from Doris for {selectedPeriodLabel(period)}.</div>;
  if (period.inverterCoverage === "complete" && meterCoverage >= 99.9) return <div className="coverage-notice complete"><Check/>Live Doris meter, Solcast and VCOM inverter feeds are complete for {selectedPeriodLabel(period)}.</div>;
  const partialDay = period.source.partialInverterDay ? format(new Date(`${period.source.partialInverterDay}T00:00:00`),"dd MMM yyyy") : null;
  const copy = period.inverterCoverage === "partial"
    ? `VCOM inverter data is partial${partialDay ? ` on ${partialDay}` : ""}${period.source.partialInverterThrough ? ` through ${period.source.partialInverterThrough}` : ""}; meter coverage is ${num(meterCoverage,1)}%.`
    : period.inverterCoverage === "unavailable"
      ? `VCOM inverter telemetry is unavailable for this selection; meter coverage is ${num(meterCoverage,1)}%.`
      : `Live inverter coverage is mixed across this range; meter coverage is ${num(meterCoverage,1)}%.`;
  return <div className="coverage-notice warning"><AlertTriangle/>{copy}</div>;
}

function MeterCoverageNotice({ period, meter, node }: { period: PrecoolPeriod; meter: PrecoolMeterSnapshot | undefined; node: PortfolioNode }) {
  const expected = period.expectedFiveMinuteReadings*Math.max(node.meters,1);
  const received = meter?.readings ?? 0;
  const missing = Math.max(expected-received,0);
  const sourceLabel = node.measurementKind === "calculated" ? "underlying meter" : "meter";
  if (!received) return <div className="coverage-notice warning"><AlertTriangle/>No {sourceLabel} readings were returned for {node.name} in {selectedPeriodLabel(period)}.</div>;
  if (!missing) return <div className="coverage-notice complete"><Check/>{node.name} {sourceLabel} coverage is complete for {selectedPeriodLabel(period)}.</div>;
  return <div className="coverage-notice warning"><AlertTriangle/>{node.name} {sourceLabel} coverage is {num(received/expected*100,1)}%; {missing.toLocaleString("en-ZA")} of {expected.toLocaleString("en-ZA")} expected five-minute intervals are missing.</div>;
}

function LiveDataState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return <div className={`live-data-state ${error ? "error" : "loading"}`}><Database/><strong>{error ? "Unable to load Doris data" : "Loading live contract data"}</strong><span>{error ?? "Querying contract meters, VCOM inverters and irradiance for the selected dates."}</span>{error && <button onClick={onRetry}>Retry</button>}</div>;
}

function PortfolioCard({ item, navigate }: { item: PortfolioSite; navigate: Navigate }) {
  const dailyPlan = item.annualYieldKwh / 365;
  return <button className="portfolio-site-card" onClick={() => navigate({kind:"site",siteCode:siteNavigationId(item)})} title={`Open contract ${item.contractId ?? ""}`}><div className="site-thumb"><SunMedium/></div><div className="site-card-copy"><strong>{item.displayName ?? contractSiteLabel(item)}</strong><span>Contract {item.contractId ?? "—"} | {num(item.capacityKwp/1000,2)}MWp | {item.guarantee}% guarantee</span><div><label>Daily yield plan<b>{num(dailyPlan,0)}<small> kWh</small></b></label><label>Contract rate<b>{item.tariff ? `R ${num(item.tariff,2)}` : "—"}</b></label></div></div><div className="site-card-status"><span>Active</span><b>{item.meterCount} meters</b><em>{item.city}</em></div></button>;
}

function PortfolioView({ navigate, period, sites, portfolioId }: { navigate: Navigate; period: PrecoolPeriod | null; sites: PortfolioSite[]; portfolioId:string }) {
  const portfolio = portfolios.find(p=>p.id===portfolioId) ?? portfolios[0];
  const chartVisibility = useChartSeriesVisibility();
  const daily = period ? periodUsesBars(period.granularity) : false;
  const chartUnit = period ? periodChartUnit(period) : "kW";
  const chartData = period ? withSitePowerTotals(period.power) : [];
  const resolution = period ? periodResolutionLabel(period.granularity) : "";
  const dataAsOf = period?.source.dataAsOf ? format(new Date(period.source.dataAsOf),"dd MMM yyyy HH:mm") : "live contract catalog";
  const meterTotal = sites.reduce((sum,item) => sum + item.meterCount,0);
  const totalCapacityMwp = sites.reduce((sum,item) => sum+item.capacityKwp,0)/1000;
  const annualPlanGwh = sites.reduce((sum,item) => sum+item.annualYieldKwh,0)/1_000_000;
  const weightedGuarantee = totalCapacityMwp ? sites.reduce((sum,item) => sum+item.guarantee*item.capacityKwp,0)/(totalCapacityMwp*1000) : 0;
  const activeSystems = sites.filter(item => item.systemActive !== false && item.systemKey).length;
  const belowGuarantee = sites.filter(item => item.guarantee < 95).length;
  return <><PageTitle title={portfolio.name} subtitle={`${sites.length} contracts | ${meterTotal} physical meters | Doris as of ${dataAsOf}`}/>
    <div className="kpi-grid portfolio-kpis"><Kpi icon={SunMedium} label="Contracted solar capacity" value={num(totalCapacityMwp,2)} unit="MWp" note={`${sites.length} ${portfolio.description}`} tone="green"/><Kpi icon={Database} label="Annual yield plan" value={num(annualPlanGwh,2)} unit="GWh" note="sum of contract yield plans"/><Kpi icon={Check} label="Weighted guarantee" value={num(weightedGuarantee,1)} unit="%" note="weighted by installed DC capacity" tone="green"/><Kpi icon={Network} label="Physical meters" value={String(meterTotal)} note="deduplicated SLD meter mappings"/></div>
    {period && <div className="portfolio-overview"><article className="panel exposure"><div className="panel-head"><strong>Portfolio data coverage</strong><span>live catalog</span></div><div><Check/><span>VCOM-linked systems</span><b>{activeSystems} of {sites.length}</b></div><div><AlertTriangle/><span>Contracts below 95% guarantee</span><b>{belowGuarantee} of {sites.length}</b></div><div><Database/><span>PreCool meter coverage</span><b>{num(period.totals.meterAvailability,1)}%</b></div></article>
      <ChartPanel title="Yield, expectation and grid use | P0480 PreCool" hint={`${selectedPeriodLabel(period)} · ${resolution} · ${chartUnit}`}>
        <AggregateSupplyChart data={chartData} daily={daily} chartUnit={chartUnit} chartVisibility={chartVisibility} area expectation/>
      </ChartPanel>
    </div>}
    <DisclosureSection title="Portfolio contract detail" hint="capacity, rates and operating coverage"><PortfolioContractPanels sites={sites}/></DisclosureSection>
    <section className="all-sites"><div className="section-label"><strong>All Sites ({sites.length})</strong><span>{portfolio.description}</span></div><div className="portfolio-sites-grid">{sites.map(item => <PortfolioCard key={item.contractId ?? item.code} item={item} navigate={navigate}/>)}</div></section>
  </>;
}

function NodeCard({ node, item, period, navigate }: { node: PortfolioNode; item: PortfolioSite; period: PrecoolPeriod; navigate: Navigate }) {
  const snapshot = node.seriesKey ? period.meters[node.seriesKey] : undefined;
  const expected = period.expectedFiveMinuteReadings*Math.max(node.meters,1);
  const coverage = snapshot && expected ? snapshot.readings/expected*100 : 0;
  const sourceLabel = node.measurementKind === "calculated" ? "Virtual calculation" : node.measurementKind === "metered" || node.isPhysical || !isVirtualTotalNode(node) ? "Metered" : "Calculated";
  return <button className="meter-card" onClick={() => navigate({kind:"meter",siteCode:siteNavigationId(item),nodeId:node.navigationKey ?? node.id})}><div><NodeIcon type={node.type}/><strong>{node.name}</strong></div><span>{node.type} · {sourceLabel}</span><small>{snapshot ? `${num(snapshot.energyMwh,3)} MWh · ${num(snapshot.peakKw,1)} kW peak` : `Node ${node.id}`}</small><em className={snapshot && coverage < 99.9 ? "warning" : ""}>{snapshot ? `${num(coverage,1)}% data` : `${node.meters} source meter${node.meters === 1 ? "" : "s"}`}</em></button>;
}

function SiteDashboardPanels({ item, period }: { item: PortfolioSite; period: PrecoolPeriod }) {
  const rows = dashboardPeriodRows(period);
  const daily = periodUsesBars(period.granularity);
  const resolution = periodResolutionLabel(period.granularity);
  const chartUnit = periodChartUnit(period);
  const costReady = rows.some(row => typeof row.gridCost === "number");
  return <div className="dashboard-grid">
    <DashboardSeriesChart title="Site supply profile" hint={`${resolution} · ${chartUnit}`} data={rows} daily={daily} series={[
      {key:"grid",name:`Municipal supply (${chartUnit})`,color:"#2f7a84",area:true,stackId:"site-supply"},
      {key:"solar",name:`Solar supply (${chartUnit})`,color:"#59ad72",area:true,stackId:"site-supply"},
      {key:"site",name:`Site Total (${chartUnit})`,color:"#0b4650"},
      ...(!daily ? [{key:"siteStot",name:"Site Total Stot (kVA)",color:"#d26a57",dashed:true}] : []),
    ]}/>
    <DashboardSeriesChart title="Municipal sub-feeds" hint={`${resolution} · Ptot`} data={rows} daily={daily} series={[
      {key:"incomer1",name:"Incomer 1",color:"#28717b",area:true,stackId:"grid-feeds"},
      {key:"incomer2",name:"Incomer 2",color:"#4c9299",area:true,stackId:"grid-feeds"},
      {key:"incomer3",name:"Incomer 3",color:"#80b2b5",area:true,stackId:"grid-feeds"},
      {key:"grid",name:"Municipal Total",color:"#0b4650"},
    ]}/>
    <DashboardSeriesChart title="Energy supplied" hint="municipal and solar · MWh" data={rows} daily={daily} series={[
      {key:"gridEnergy",name:"Municipal energy (MWh)",color:"#31808a",area:true,stackId:"energy-supply"},
      {key:"solarEnergy",name:"Solar energy (MWh)",color:"#65ba75",area:true,stackId:"energy-supply"},
      {key:"siteEnergy",name:"Total supplied energy (MWh)",color:"#173f49"},
    ]}/>
    {costReady ? <DashboardSeriesChart title="Electricity cost" hint="tariff total allocated by interval" data={rows} daily={daily} series={[{key:"gridCost",name:"Municipal cost incl. VAT (R)",color:"#3d91c8",area:true}]}/> : <DashboardEmptyPanel title="Electricity cost" hint="reporting tariff engine" message="No municipal Pricing Result was returned for this date range."/>}
  </div>;
}

function SiteDashboardView({ item, period }: { item: PortfolioSite; period: PrecoolPeriod }) {
  return <><PageTitle title={item.name} subtitle={`${item.displayName ?? contractSiteLabel(item)} | Site dashboard | Contract ${item.contractId ?? "—"}`}/><CoverageNotice period={period}/><SiteDashboardPanels item={item} period={period}/></>;
}

function meterSeriesKey(item: PortfolioSite, node: PortfolioNode) {
  const meterId = item.code === "P0480" ? p0480MeterId(node.id) : undefined;
  return node.seriesKey ?? (meterId === "pvdb-1" ? "pvdb1" : meterId === "pvdb-2" ? "pvdb2" : meterId === "solar-total" ? "solar" : meterId === "municipal-total" ? "grid" : meterId === "site-total" ? "site" : meterId?.replace("-",""));
}

function selectedMeterSnapshot(period: PrecoolPeriod, key: string) {
  if (key === "solar") return {energyMwh:period.totals.solarEnergyMwh,peakKw:period.totals.peakSolarKw,readings:(period.meters.pvdb1?.readings ?? 0)+(period.meters.pvdb2?.readings ?? 0)};
  if (key === "grid") return {energyMwh:period.totals.gridImportMwh,peakKw:Math.max(0,...period.power.map(point => point.grid)),peakKva:Math.max(0,...period.power.map(point => powerNumber(point.gridStot))),readings:(period.meters.incomer1?.readings ?? 0)+(period.meters.incomer2?.readings ?? 0)+(period.meters.incomer3?.readings ?? 0)};
  if (key === "site") return {energyMwh:period.totals.estimatedLoadMwh,peakKw:Math.max(0,...period.power.map(point => point.grid+point.solar)),peakKva:Math.max(0,...period.power.map(point => powerNumber(point.siteStot))),readings:Object.values(period.meters).reduce((sum,meter) => sum+meter.readings,0)};
  if (key === "load") return period.meters.load ?? {energyMwh:period.totals.estimatedLoadMwh,peakKw:Math.max(0,...period.power.map(point => powerNumber(point.load ?? point.site))),peakKva:Math.max(0,...period.power.map(point => powerNumber(point.loadStot ?? point.siteStot))),readings:period.meters.site?.readings ?? 0};
  return period.meters[key];
}

function MeterDashboardView({ item, node, period }: { item: PortfolioSite; node: PortfolioNode; period: PrecoolPeriod }) {
  const selectedKey = meterSeriesKey(item,node) ?? "site";
  const selectedStotKey = stotKey(selectedKey);
  const solar = node.type.toLowerCase().includes("solar");
  const siteTotal = selectedKey === "site";
  const meter = selectedMeterSnapshot(period,selectedKey);
  const daily = periodUsesBars(period.granularity);
  const resolution = periodResolutionLabel(period.granularity);
  const chartUnit = periodChartUnit(period);
  const priced = period.financials?.municipal?.state === "ready" ? period.financials.municipal : null;
  const rows = dashboardPeriodRows(period).map(row => {
    const selectedValue = row[selectedKey as keyof typeof row];
    const selectedEnergy = periodEnergyMwh(period,powerNumber(selectedValue));
    return {
      ...row,
      selectedEnergy,
      selectedCost:priced?.totalIncludingVatR !== null && priced?.totalIncludingVatR !== undefined && period.totals.gridImportMwh > 0 ? priced.totalIncludingVatR*selectedEnergy/period.totals.gridImportMwh : null,
      solarValue:item.tariff ? selectedEnergy*1000*item.tariff : null,
    };
  });
  const expectedReadings = period.expectedFiveMinuteReadings*Math.max(node.meters,1);
  const coverage = meter && expectedReadings ? meter.readings/expectedReadings*100 : 0;
  const apparentPeakRow = period.power.reduce<PrecoolPeriod["power"][number] | null>((best,row) => !best || powerNumber(row[selectedStotKey]) > powerNumber(best[selectedStotKey]) ? row : best,null);
  const peakApparent = meter?.peakKva ?? (apparentPeakRow ? powerNumber(apparentPeakRow[selectedStotKey]) : 0);
  const activeAtApparentPeak = apparentPeakRow ? powerNumber(apparentPeakRow[selectedKey]) : 0;
  const powerFactor = peakApparent > 0 ? Math.min(Math.abs(activeAtApparentPeak/peakApparent),1) : 0;
  const municipalShare = meter && period.totals.gridImportMwh > 0 ? meter.energyMwh/period.totals.gridImportMwh*100 : 0;
  const allocatedCost = priced?.totalIncludingVatR !== null && priced?.totalIncludingVatR !== undefined && meter && period.totals.gridImportMwh > 0 ? priced.totalIncludingVatR*meter.energyMwh/period.totals.gridImportMwh : null;

  if (siteTotal) return <><PageTitle title={node.name} subtitle={`${item.name} | Site dashboard | Device node ${node.id}`}/><MeterCoverageNotice period={period} meter={meter} node={node}/><SiteDashboardPanels item={item} period={period}/></>;

  const common = <><PageTitle title={node.name} subtitle={`${item.name} | ${solar ? "Solar dashboard" : "Meter dashboard"} | Device node ${node.id}`}/><MeterCoverageNotice period={period} meter={meter} node={node}/></>;
  if (solar) return <>{common}<div className="dashboard-grid">
    <DashboardSeriesChart title="Energy produced" hint={`${resolution} · MWh`} data={rows} daily={daily} series={[{key:"selectedEnergy",name:`${node.name} energy (MWh)`,color:"#62b86f",area:true}]}/>
    <DashboardStatsPanel title="Solar statistics" hint={selectedPeriodLabel(period)} metrics={[
      {label:"Produced energy",value:num(meter?.energyMwh ?? 0,3),unit:"MWh",tone:"green"},
      {label:"Peak output",value:num(meter?.peakKw ?? 0,1),unit:"kW"},
      {label:"Solcast peak GHI",value:num(period.totals.solcastPeakGhi,1),unit:"W/m²"},
      {label:"Site performance ratio",value:num(period.totals.prEstimate,1),unit:"%",tone:"green"},
      {label:"Data coverage",value:num(coverage,1),unit:"%",tone:coverage >= 99.9 ? "green" : "amber"},
      {label:"PPA rate exposure",value:item.tariff ? `R ${num((meter?.energyMwh ?? 0)*1000*item.tariff,0)}` : "—",note:"not savings"},
    ]}/>
    {item.tariff ? <DashboardSeriesChart title="PPA value exposure" hint={`metered energy · R ${num(item.tariff,3)}/kWh`} data={rows} daily={daily} series={[{key:"solarValue",name:"PPA value exposure (R)",color:"#3d91c8",area:true}]}/> : <DashboardEmptyPanel title="PPA value exposure" hint="current contract rate" message="No current PPA rate is available for this contract."/>}
    <DashboardSeriesChart title="Solar power profile" hint={`${resolution} · ${chartUnit}`} data={rows} daily={daily} series={[
      {key:selectedKey,name:`${node.name} Ptot (${chartUnit})`,color:"#249b61",area:true},
      ...(!daily ? [{key:selectedStotKey,name:`${node.name} Stot (kVA)`,color:"#87ba91",dashed:true}] : []),
      {key:"expected",name:`Solcast expectation (${chartUnit})`,color:"#ef705f",dashed:true},
    ]}/>
  </div></>;

  const stats = selectedKey === "grid" ? [
    {label:"Imported energy",value:num(meter?.energyMwh ?? 0,3),unit:"MWh" as const},
    {label:"Exported energy",value:num(period.totals.gridExportKwh,1),unit:"kWh" as const},
    {label:"Peak Ptot",value:num(meter?.peakKw ?? 0,1),unit:"kW" as const},
    {label:"Peak Stot",value:peakApparent ? num(peakApparent,1) : "—",unit:peakApparent ? "kVA" as const : undefined},
    {label:"Average cost",value:priced?.averageCostRPerKwh !== null && priced?.averageCostRPerKwh !== undefined ? `R ${num(priced.averageCostRPerKwh,2)}` : "—",unit:priced?.averageCostRPerKwh !== null && priced?.averageCostRPerKwh !== undefined ? "/kWh" as const : undefined},
    {label:"Data coverage",value:num(coverage,1),unit:"%" as const,tone:coverage >= 99.9 ? "green" as const : "amber" as const},
  ] : [
    {label:"Imported energy",value:num(meter?.energyMwh ?? 0,3),unit:"MWh" as const},
    {label:"Peak Ptot",value:num(meter?.peakKw ?? 0,1),unit:"kW" as const},
    {label:"Peak Stot",value:peakApparent ? num(peakApparent,1) : "—",unit:peakApparent ? "kVA" as const : undefined},
    {label:"Power factor at peak",value:powerFactor ? num(powerFactor,3) : "—",tone:powerFactor >= .95 ? "green" as const : powerFactor ? "amber" as const : undefined},
    {label:"Municipal import share",value:num(municipalShare,1),unit:"%" as const},
    {label:"Data coverage",value:num(coverage,1),unit:"%" as const,tone:coverage >= 99.9 ? "green" as const : "amber" as const},
  ];
  return <>{common}<div className="dashboard-grid">
    <DashboardSeriesChart title="Energy consumption" hint={`${resolution} · MWh`} data={rows} daily={daily} series={[{key:"selectedEnergy",name:`${node.name} energy (MWh)`,color:"#65b96f",area:true}]}/>
    <DashboardStatsPanel title="Meter statistics" hint={selectedPeriodLabel(period)} metrics={stats}/>
    {allocatedCost !== null ? <DashboardSeriesChart title={selectedKey === "grid" ? "Electricity cost" : "Allocated electricity cost"} hint={selectedKey === "grid" ? "tariff Pricing Result · incl. VAT" : `share of municipal Pricing Result · R ${num(allocatedCost,0)}`} data={rows} daily={daily} series={[{key:"selectedCost",name:"Allocated cost incl. VAT (R)",color:"#3d91c8",area:true}]}/> : <DashboardEmptyPanel title="Electricity cost" hint="reporting tariff engine" message="No municipal Pricing Result was returned for this date range."/>}
    <DashboardSeriesChart title="Power profile" hint={`${resolution} · Ptot and Stot`} data={rows} daily={daily} series={[
      {key:selectedKey,name:`${node.name} Ptot (${chartUnit})`,color:"#185c68",area:true},
      ...(!daily ? [{key:selectedStotKey,name:`${node.name} Stot (kVA)`,color:"#d26a57",dashed:true}] : []),
    ]}/>
  </div></>;
}

function MeterView({ item, node, navigate, period }: { item: PortfolioSite; node: PortfolioNode; navigate: Navigate; period: PrecoolPeriod }) {
  const chartVisibility = useChartSeriesVisibility();
  const meterId = item.code === "P0480" ? p0480MeterId(node.id) : undefined;
  const solar = node.type.toLowerCase().includes("solar");
  const key = meterSeriesKey(item,node);
  const connected = meterId === "solar-total"
    ? item.nodes.filter(value => value.id === "1140730" || value.id === "1140721")
    : item.nodes.filter(value => (value.parentNavigationKey ?? value.parentId) === (node.navigationKey ?? node.id));
  const meterSnapshot = selectedMeterSnapshot(period,key ?? "site");
  const hasLiveMeterData = Boolean(meterSnapshot);
  const liveChartData = withSitePowerTotals(period.power);
  const selectedKey = key ?? "site";
  const selectedStotKey = stotKey(selectedKey);
  const siteTotal = selectedKey === "site";
  const branchInverters = meterId === "pvdb-1" ? period.inverterSummary.slice(0,6) : meterId === "pvdb-2" ? period.inverterSummary.slice(6,12) : period.inverterSummary;
  const showsInverters = item.code === "P0480" && (meterId === "pvdb-1" || meterId === "pvdb-2");
  const showsChildren = showsInverters || connected.length > 0;
  const energyValue = meterSnapshot ? period.durationMinutes <= 1440 ? num(meterSnapshot.energyMwh*1000,1) : num(meterSnapshot.energyMwh,3) : "—";
  const energyUnit = period.durationMinutes <= 1440 ? "kWh" : "MWh";
  const daily = periodUsesBars(period.granularity);
  const chartUnit = periodChartUnit(period);
  const resolution = periodResolutionLabel(period.granularity);
  const meterAvailability = meterSnapshot ? meterSnapshot.readings/(period.expectedFiveMinuteReadings*Math.max(node.meters,1))*100 : 0;
  const municipalFinancials = period.financials?.municipal;
  const pricedMunicipalTotal = selectedKey === "grid" && municipalFinancials?.state === "ready" ? municipalFinancials.totalIncludingVatR : null;
  const solarRateExposure = meterSnapshot && item.tariff ? meterSnapshot.energyMwh*1000*item.tariff : null;
  return <><PageTitle title={node.name} subtitle={`${item.name} | ${node.type} | Device node ${node.id}`}/>
    <MeterCoverageNotice period={period} meter={meterSnapshot} node={node}/>
    <div className={`kpi-grid ${solar ? "meter-five-kpis" : "meter-four-kpis"}`}>{solar ? <><Kpi icon={Zap} label="Peak output" value={meterSnapshot ? num(meterSnapshot.peakKw,1) : "—"} unit={meterSnapshot ? "kW" : undefined} note={selectedPeriodLabel(period)} delta="peak" tone="green"/><Kpi icon={Database} label="Grid import" value={num(period.totals.gridImportMwh,3)} unit="MWh" note="municipal total"/><Kpi icon={SunMedium} label="Solar energy" value={energyValue} unit={meterSnapshot ? energyUnit : undefined} note="Solar export register delta" delta="measured" tone="green"/><Kpi icon={Gauge} label="Solcast peak GHI" value={num(period.totals.solcastPeakGhi,1)} unit="W/m²" note="Satellite irradiance" delta="peak" tone="green"/><Kpi icon={Activity} label="PPA rate exposure" value={solarRateExposure === null ? "—" : `R ${num(solarRateExposure,0)}`} note={item.tariff ? `not savings · R ${num(item.tariff,3)}/kWh` : "PPA rate unavailable"} delta="value" tone="green"/></> : <><Kpi icon={Zap} label="Peak demand" value={meterSnapshot ? num(meterSnapshot.peakKw,1) : "—"} unit={meterSnapshot ? "kW" : undefined} note={selectedPeriodLabel(period)} delta="peak" tone="green"/><Kpi icon={Database} label="Imported energy" value={energyValue} unit={meterSnapshot ? energyUnit : undefined} note="Import register delta"/><Kpi icon={Gauge} label="Meter availability" value={num(meterAvailability,1)} unit="%" note={`${meterSnapshot?.readings ?? 0} five-minute readings`} delta="metered" tone="green"/><Kpi icon={Activity} label={selectedKey === "grid" ? "Priced cost incl. VAT" : "Peak apparent demand"} value={selectedKey === "grid" ? pricedMunicipalTotal === null ? "—" : `R ${num(pricedMunicipalTotal,0)}` : meterSnapshot?.peakKva ? num(meterSnapshot.peakKva,1) : "—"} unit={selectedKey !== "grid" && meterSnapshot?.peakKva ? "kVA" : undefined} note={selectedKey === "grid" ? "canonical tariff Pricing Result" : "Stot maximum"} tone={selectedKey === "grid" && pricedMunicipalTotal !== null ? "green" : undefined}/></>}</div>
    <ChartPanel title={daily ? "Energy profile" : siteTotal ? "Site, municipal and solar power" : solar ? "Solar and municipal power" : "Power profile"} hint={hasLiveMeterData ? `${selectedPeriodLabel(period)} · ${resolution} · ${chartUnit}` : "No meter readings in the selected period"}>
      {hasLiveMeterData && daily ? siteTotal
        ? <AggregateSupplyChart data={liveChartData} daily chartUnit={chartUnit} chartVisibility={chartVisibility}/>
        : <ResponsiveContainer width="100%" height="100%"><BarChart data={liveChartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/>{selectedKey !== "grid" && <Bar dataKey="grid" name="Municipal Total energy (MWh)" fill="#dfe5e6" hide={chartVisibility.isHidden("grid")}/>}<Bar dataKey={selectedKey} name={`${node.name} energy (MWh)`} fill={solar ? "#249b61" : "#185c68"} hide={chartVisibility.isHidden(selectedKey)}/></BarChart></ResponsiveContainer>
        : hasLiveMeterData && siteTotal
          ? <AggregateSupplyChart data={liveChartData} daily={false} chartUnit={chartUnit} chartVisibility={chartVisibility}/>
          : hasLiveMeterData && solar
            ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={liveChartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/><Line dataKey={selectedKey} name={`${node.name} Ptot (kW)`} stroke="#f0ad42" strokeWidth={2} dot={false} hide={chartVisibility.isHidden(selectedKey)}/><Line dataKey={selectedStotKey} name={`${node.name} Stot (kVA)`} stroke="#d28a35" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden(selectedStotKey)}/><Line dataKey="expected" name="Solcast expectation (kW)" stroke="#ef705f" strokeDasharray="2 4" dot={false} hide={chartVisibility.isHidden("expected")}/><Line dataKey="grid" name="Municipal Total Ptot (kW)" stroke="#526f76" strokeWidth={1.4} dot={false} hide={chartVisibility.isHidden("grid")}/><Line dataKey="gridStot" name="Municipal Total Stot (kVA)" stroke="#90a3a6" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("gridStot")}/></ComposedChart></ResponsiveContainer>
            : hasLiveMeterData
              ? <ResponsiveContainer width="100%" height="100%"><LineChart data={liveChartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/><Line dataKey={selectedKey} name={`${node.name} Ptot (kW)`} stroke="#185c68" strokeWidth={2} dot={false} hide={chartVisibility.isHidden(selectedKey)}/><Line dataKey={selectedStotKey} name={`${node.name} Stot (kVA)`} stroke="#d26a57" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden(selectedStotKey)}/>{selectedKey !== "grid" && <Line dataKey="grid" name="Municipal Total Ptot (kW)" stroke="#90a3a6" strokeWidth={1.2} dot={false} hide={chartVisibility.isHidden("grid")}/>} {selectedKey !== "grid" && <Line dataKey="gridStot" name="Municipal Total Stot (kVA)" stroke="#b2bfc1" strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("gridStot")}/>}</LineChart></ResponsiveContainer>
              : <div className="telemetry-history-empty">No meter readings were returned for this selection.</div>}
    </ChartPanel>
    {showsChildren && <section className="all-meters"><div className="section-label"><strong>{showsInverters ? "Inverters" : "Child nodes"}</strong><span>{meterId === "pvdb-1" ? "PVDB 1 · Inverters 001–006" : meterId === "pvdb-2" ? "PVDB 2 · Inverters 007–012" : item.name}</span></div>{showsInverters ? <div className="meter-card-grid">{branchInverters.map(inv => <button className="meter-card" key={inv.code} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><Gauge/><strong>Inverter {inv.code.padStart(3,"0")}</strong></div><span>{Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} · {inv.model}</span><small>{inv.hasData ? `${num(inv.energy,1)} kWh` : "No VCOM data"}</small><em>{inv.hasData ? inv.availability >= 99.9 ? "Complete" : "Partial" : "Unavailable"}</em></button>)}</div> : <div className="meter-card-grid">{meterId === "solar-total" && <button className="meter-card" onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><div><Layers3/><strong>Inverter total</strong></div><span>12 Sungrow units</span><small>{period.totals.inverterReadings ? `${num(period.totals.inverterEnergyMwh,3)} MWh` : "No VCOM data"}</small><em>Open</em></button>}{connected.map(value => <NodeCard key={value.id} node={value} item={item} period={period} navigate={navigate}/>)}</div>}</section>}
    {selectedKey === "grid" ? <DisclosureSection title="Tariff cost breakdown" hint="charge composition and largest tariff lines"><MunicipalFinancialPanel period={period}/></DisclosureSection> : solar ? <DisclosureSection title="Solar commercial detail" hint="meter contribution, PPA context and specific yield"><SolarCommercialPanel item={item} period={period} meter={meterSnapshot} scope={`${item.name} · ${node.name}`} siteWide={selectedKey === "solar"}/></DisclosureSection> : siteTotal ? <DisclosureSection title="Site energy balance" hint="solar retained, municipal contribution and export"><section className="context-section"><EnergyBalancePanel period={period}/></section></DisclosureSection> : <MeterOperatingPanel node={node} meter={meterSnapshot} period={period}/>}
  </>;
}

function heatmapColour(intensity: number | null) {
  if (intensity === null) return "#e4e9ea";
  const hue = 3 + intensity * 45;
  const lightness = 34 + intensity * 50;
  return `hsl(${hue} 92% ${lightness}%)`;
}

function InverterHeatmap({ period }: { period: PrecoolPeriod }) {
  const heatmap = buildInverterHeatmap(period);
  const pointCount = period.inverterAc.length;
  const tickIndexes = new Set([0,.25,.5,.75,1].map(value => Math.round(Math.max(0,pointCount-1)*value)));
  const resolution = periodResolutionLabel(period.granularity);
  const summary = periodUsesBars(period.granularity);
  if (!pointCount || heatmap.maximum === 0) return <article className="panel inverter-heatmap"><div className="panel-head"><strong>Inverter heatmap</strong><span>{resolution} AC output</span></div><div className="heatmap-empty">No inverter output was returned for this selection.</div></article>;
  return <article className="panel inverter-heatmap">
    <div className="panel-head"><strong>Inverter heatmap</strong><span>{selectedPeriodLabel(period)} · {resolution} · {summary ? "peak AC power" : "AC power"} (kW)</span></div>
    <div className="heatmap-scroll"><div className="heatmap-table" style={{minWidth:Math.max(760,pointCount*5+78)}}>
      {heatmap.rows.map(row => <div className="heatmap-row" key={row.code}>
        <strong>Inv {row.code}</strong>
        <div className="heatmap-cells" style={{gridTemplateColumns:`repeat(${pointCount},minmax(4px,1fr))`}}>
          {row.cells.map((cell,index) => <i key={`${row.code}-${index}`} style={{background:heatmapColour(cell.intensity)}} title={`Inverter ${row.code} · ${cell.time} · ${cell.value === null ? "no reading" : `${num(cell.value,1)} kW`}`}/>) }
        </div>
      </div>)}
      <div className="heatmap-axis"><span/><div style={{gridTemplateColumns:`repeat(${pointCount},minmax(4px,1fr))`}}>{period.inverterAc.map((point,index) => <small key={`${String(point.time)}-${index}`}>{tickIndexes.has(index) ? String(point.time) : ""}</small>)}</div></div>
    </div></div>
    <div className="heatmap-legend"><span>AC output (kW)</span><i/><small>0</small><small>{num(heatmap.maximum/2,0)}</small><small>{num(heatmap.maximum,0)}</small><em>Grey = no reading</em></div>
  </article>;
}

function InverterTotalView({ navigate, period }: { navigate: Navigate; period: PrecoolPeriod }) {
  const acVisibility = useChartSeriesVisibility(10);
  const dcVisibility = useChartSeriesVisibility(10);
  const energyVisibility = useChartSeriesVisibility(10);
  const daily = periodUsesBars(period.granularity);
  const chartUnit = daily ? periodResolutionLabel(period.granularity) + " peak power (kW)" : periodResolutionLabel(period.granularity) + " power (kW)";
  const energyData = buildInverterEnergySeries(period);
  const energyUnit = daily ? "MWh" : "kWh";
  const resolution = periodResolutionLabel(period.granularity);
  const reporting = period.inverterSummary.filter(item => item.hasData).length;
  return <><PageTitle title="Inverter total" subtitle={`PreCool Cold Storage | Solar Total | ${period.inverterSummary.length} Sungrow SG125CX-P2 inverters`}/><CoverageNotice period={period}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC peak" value={period.totals.inverterReadings ? num(period.totals.peakAcMw,3) : "—"} unit={period.totals.inverterReadings ? "MW" : undefined} note="Summed inverter output" delta={period.totals.inverterReadings ? "measured" : undefined} tone={period.totals.inverterReadings ? "green" : undefined}/><Kpi icon={Zap} label="Energy" value={period.totals.inverterReadings ? num(period.totals.inverterEnergyMwh,3) : "—"} unit={period.totals.inverterReadings ? "MWh" : undefined} note={selectedPeriodLabel(period)}/><Kpi icon={Database} label="Cumulative energy" value={period.totals.cumulativeEnergyGwh !== null ? num(period.totals.cumulativeEnergyGwh,3) : "—"} unit={period.totals.cumulativeEnergyGwh !== null ? "GWh" : undefined} note="Latest E_TOTAL in selection"/><Kpi icon={Activity} label="Availability" value={num(period.totals.inverterAvailability,1)} unit="%" note={`${reporting} / 12 units · ${period.totals.inverterReadings.toLocaleString("en-ZA")} readings`} delta={period.inverterCoverage === "complete" ? "online" : "partial"} tone={period.inverterCoverage === "complete" ? "green" : "amber"}/></div>
    <Tabs defaultValue="ac" className="panel inverter-performance-tabs">
      <div className="panel-head inverter-performance-head"><strong>Inverter performance</strong><TabsList><TabsTrigger value="ac">AC power</TabsTrigger><TabsTrigger value="dc">DC power</TabsTrigger><TabsTrigger value="energy">Energy</TabsTrigger></TabsList><span>{selectedPeriodLabel(period)} · {resolution}</span></div>
      <TabsContent value="ac" className="inverter-performance-content" aria-label="All inverter power"><ResponsiveContainer width="100%" height="100%">{daily ? <BarChart data={period.inverterAc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...acVisibility.legendProps}/>{period.inverterSummary.map((inv,index) => <Bar key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} fill={inverterColours[index]} hide={acVisibility.isHidden(`i${inv.code}`)}/>)}</BarChart> : <LineChart data={period.inverterAc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...acVisibility.legendProps}/>{period.inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false} connectNulls={false} hide={acVisibility.isHidden(`i${inv.code}`)}/>)}</LineChart>}</ResponsiveContainer></TabsContent>
      <TabsContent value="dc" className="inverter-performance-content" aria-label="All inverter DC power"><ResponsiveContainer width="100%" height="100%">{daily ? <BarChart data={period.inverterDc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...dcVisibility.legendProps}/>{period.inverterSummary.map((inv,index) => <Bar key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} fill={inverterColours[index]} hide={dcVisibility.isHidden(`i${inv.code}`)}/>)}</BarChart> : <LineChart data={period.inverterDc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...dcVisibility.legendProps}/>{period.inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false} connectNulls={false} hide={dcVisibility.isHidden(`i${inv.code}`)}/>)}</LineChart>}</ResponsiveContainer></TabsContent>
      <TabsContent value="energy" className="inverter-performance-content" aria-label="Inverter energy"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={energyData} margin={{...chartMargin,right:4}}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis yAxisId="interval" axisLine={false} tickLine={false}/><YAxis yAxisId="cumulative" orientation="right" axisLine={false} tickLine={false}/><Tooltip/><Legend {...energyVisibility.legendProps}/>{daily ? <Bar yAxisId="interval" dataKey="energy" name={`Interval energy (${energyUnit})`} fill="#ee9e42" maxBarSize={22} hide={energyVisibility.isHidden("energy")}/> : <Area yAxisId="interval" type="monotone" dataKey="energy" name={`Interval energy (${energyUnit})`} stroke="#ee9e42" fill="#f5c875" fillOpacity={.42} dot={false} hide={energyVisibility.isHidden("energy")}/>}<Line yAxisId="cumulative" type="monotone" dataKey="cumulative" name={`Cumulative (${energyUnit})`} stroke="#12616b" strokeWidth={2} dot={false} hide={energyVisibility.isHidden("cumulative")}/></ComposedChart></ResponsiveContainer></TabsContent>
    </Tabs>
    <InverterHeatmap period={period}/>
    <section className="all-meters"><div className="section-label"><strong>All Inverters ({period.inverterSummary.length})</strong><span>select a unit to view MPPT and strings</span></div><div className="inverter-list-grid">{period.inverterSummary.map((inv,index) => <button key={inv.code} className="inverter-summary-card" onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><i style={{background:inverterColours[index]}}/><strong>Inverter {inv.code.padStart(3,"0")}</strong><span className={inv.hasData ? "" : "no-data"}>{inv.hasData ? inv.availability >= 99.9 ? "Complete" : "Partial" : "No data"}</span></div><p>{inv.id} | {inv.model}</p><dl><div><dt>AC peak</dt><dd>{inv.hasData ? `${num(inv.peakAc,1)} kW` : "—"}</dd></div><div><dt>DC peak</dt><dd>{inv.hasData ? `${num(inv.peakDc,1)} kW` : "—"}</dd></div><div><dt>Energy</dt><dd>{inv.hasData ? `${num(inv.energy,1)} kWh` : "—"}</dd></div></dl></button>)}</div></section></>;
}

type TelemetryMetric = "power" | "current" | "voltage";

function TelemetryHistoryPanel({
  title,
  mode,
  history,
  configuration,
  loading,
  error,
}: {
  title: string;
  mode: "mppt" | "strings";
  history: PrecoolTelemetryHistory | null;
  configuration: InverterElectricalConfig;
  loading: boolean;
  error: string | null;
}) {
  const [metric,setMetric] = useState<TelemetryMetric>("power");
  const chartVisibility = useChartSeriesVisibility(7);
  const specs = mode === "mppt"
    ? configuration.mppts.map(item => ({key:`m${item.mppt}`,label:`MPPT ${String(item.mppt).padStart(2,"0")}`,channel:item.mppt,divisor:1}))
    : configuration.mppts.flatMap(item => Array.from({length:item.connectedStrings},(_,index) => ({key:`m${item.mppt}s${index+1}`,label:`M${String(item.mppt).padStart(2,"0")}-S${index+1}`,channel:item.mppt,divisor:item.connectedStrings})));
  const rows = (history?.series ?? []).map(point => {
    const row: Record<string,string|number|null> = {time:point.label};
    const readings = new Map(point.channels.map(channel => [channel.channel,channel]));
    specs.forEach(spec => {
      const reading = readings.get(spec.channel);
      const value = reading?.[metric];
      row[spec.key] = typeof value === "number"
        ? metric === "voltage" ? value : value/spec.divisor
        : null;
    });
    return row;
  });
  const unit = metric === "current" ? "A" : metric === "voltage" ? "V" : history?.range.powerUnit ?? "kW";
  const bars = history ? periodUsesBars(history.range.granularity) : false;
  const resolution = history ? periodResolutionLabel(history.range.granularity) : "";
  return <ChartPanel title={title} hint={history ? `${resolution} · ${metric} (${unit})` : undefined} className="telemetry-history-panel">
    <div className="telemetry-history-content">
      <div className="telemetry-metric-selector" role="group" aria-label={`${title} metric`}>
        {(["power","current","voltage"] as TelemetryMetric[]).map(value => <button key={value} className={metric === value ? "active" : ""} onClick={() => setMetric(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}
      </div>
      <div className="telemetry-history-plot">
        {loading ? <div className="telemetry-history-empty">Loading live telemetry...</div> : error ? <div className="telemetry-history-empty error">{error}</div> : !rows.length ? <div className="telemetry-history-empty">No telemetry in this selection.</div> : <ResponsiveContainer width="100%" height="100%">{bars ? <BarChart data={rows} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/>{specs.map((spec,index) => <Bar key={spec.key} dataKey={spec.key} name={spec.label} fill={inverterColours[index%inverterColours.length]} maxBarSize={12} hide={chartVisibility.isHidden(spec.key)}/>)}</BarChart> : <LineChart data={rows} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/>{specs.map((spec,index) => <Line key={spec.key} dataKey={spec.key} name={spec.label} stroke={inverterColours[index%inverterColours.length]} strokeWidth={1.4} dot={false} connectNulls={false} hide={chartVisibility.isHidden(spec.key)}/>)}</LineChart>}</ResponsiveContainer>}
      </div>
    </div>
  </ChartPanel>;
}

function SingleInverterView({ code, period, history, historyLoading, historyError }: { code: string; period: PrecoolPeriod; history: PrecoolTelemetryHistory | null; historyLoading: boolean; historyError: string | null }) {
  const chartVisibility = useChartSeriesVisibility();
  const daily = periodUsesBars(period.granularity);
  const inv = period.inverterSummary.find(item => item.code === code) ?? period.inverterSummary[0];
  const telemetry = history?.snapshot ?? period.telemetry[inv.code];
  const configuration = inverterConfiguration[inv.code] ?? inverterConfiguration["01"];
  const telemetryByMppt = new Map((telemetry?.channels ?? []).map(reading => [reading.channel,reading]));
  const normalizedCurrents = configuration.mppts.map(item => (telemetryByMppt.get(item.mppt)?.current ?? 0) / item.connectedStrings).filter(value => value > 0).sort((a,b) => a-b);
  const middle = Math.floor(normalizedCurrents.length/2);
  const normalizedMedian = normalizedCurrents.length ? normalizedCurrents.length % 2 ? normalizedCurrents[middle] : (normalizedCurrents[middle-1]+normalizedCurrents[middle])/2 : 0;
  const mppts = configuration.mppts.map(item => {
    const reading = telemetryByMppt.get(item.mppt);
    const normalizedCurrent = (reading?.current ?? 0) / item.connectedStrings;
    const deviation = normalizedMedian ? (normalizedCurrent-normalizedMedian)/normalizedMedian*100 : 0;
    return {...item,reading,normalizedCurrent,deviation};
  });
  const connectedStrings = mppts.flatMap(mppt => Array.from({length:mppt.connectedStrings},(_,index) => ({
    id:`M${String(mppt.mppt).padStart(2,"0")}-S${index+1}`,
    mppt:mppt.mppt,
    current:mppt.normalizedCurrent,
    voltage:mppt.reading?.voltage ?? 0,
    power:(mppt.reading?.power ?? 0)/mppt.connectedStrings,
    deviation:mppt.deviation,
    panelsPerString:mppt.panelsPerString,
    moduleType:mppt.moduleType,
    section:mppt.section,
    orientation:mppt.orientation,
    tilt:mppt.tilt,
    mountingType:mppt.mountingType,
  })));
  const mpptTotal = (telemetry?.channels ?? []).reduce((sum,value) => sum + value.power,0);
  const ratio = inv.peakDc ? inv.peakAc / inv.peakDc * 100 : 0;
  const inverterSeries = period.inverterAc.map(row => {
    const acValue = row[`i${inv.code}`];
    const dcRow = period.inverterDc.find(value => value.time === row.time);
    const dcValue = dcRow?.[`i${inv.code}`];
    const irradianceRow = period.power.find(value => value.time === row.time);
    return {
      time:row.time,
      ac:typeof acValue === "number" ? acValue : null,
      dc:typeof dcValue === "number" ? dcValue : null,
      solcastGhi:irradianceRow?.ghi ?? null,
      sensorGhi:irradianceRow?.sensorGhi ?? null,
    };
  });
  const noProduction = normalizedMedian === 0;
  const severity = (deviation: number, available = true) => !available || noProduction ? "unavailable" : deviation >= -7 ? "within" : deviation >= -15 ? "warning" : "alarm";
  const withinCount = mppts.filter(value => value.reading && value.reading.current > 0 && value.deviation >= -7).length;
  const irradianceUnit = period.granularity === "day" ? "kWh/m²/day" : period.granularity === "month" ? "kWh/m²/month" : period.granularity === "year" ? "kWh/m²/year" : "W/m²";
  const chartUnit = daily ? periodResolutionLabel(period.granularity) + " peak power" : periodResolutionLabel(period.granularity) + " power";
  const capturedAt = telemetry ? `Latest 5-minute - ${format(new Date(telemetry.capturedAt),"dd MMM yyyy HH:mm")}` : null;
  return <><PageTitle title={`Inverter ${inv.code.padStart(3,"0")}`} subtitle={`PreCool Cold Storage | ${Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} | ${inv.id} | ${inv.model}`}/><CoverageNotice period={period}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC peak" value={inv.hasData ? num(inv.peakAc,1) : "—"} unit={inv.hasData ? "kW" : undefined} note={selectedPeriodLabel(period)} delta={inv.hasData ? inv.availability >= 99.9 ? "complete" : "partial" : undefined} tone={inv.hasData ? inv.availability >= 99.9 ? "green" : "amber" : undefined} bars/><Kpi icon={Zap} label="Energy" value={inv.hasData ? num(inv.energy,1) : "—"} unit={inv.hasData ? "kWh" : undefined} note="Sum of daily E_DAY registers" bars/><Kpi icon={Activity} label="Conversion" value={inv.hasData ? num(ratio,1) : "—"} unit={inv.hasData ? "%" : undefined} note="Peak AC ÷ peak DC" tone={inv.hasData ? "green" : undefined} bars/><Kpi icon={Database} label="Cumulative energy" value={inv.hasData ? num(inv.cumulative/1000,1) : "—"} unit={inv.hasData ? "MWh" : undefined} note="Latest E_TOTAL in selection" bars/></div>
    <div className="inverter-detail-row"><ChartPanel title="AC and DC output with irradiance" hint={`${chartUnit} (kW) · Solcast ${irradianceUnit}${period.sensorAvailable ? " · site sensor" : " · site sensor unavailable"}`}><ResponsiveContainer width="100%" height="100%">{daily ? <ComposedChart data={inverterSeries} margin={{...chartMargin,right:4}}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis yAxisId="power" axisLine={false} tickLine={false}/><YAxis yAxisId="irradiance" orientation="right" axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/><Bar yAxisId="power" dataKey="dc" name="DC peak" fill="#f0ab40" hide={chartVisibility.isHidden("dc")}/><Bar yAxisId="power" dataKey="ac" name="AC peak" fill="#ef654b" hide={chartVisibility.isHidden("ac")}/><Bar yAxisId="irradiance" dataKey="solcastGhi" name="Solcast GHI" fill="#8157b5" hide={chartVisibility.isHidden("solcastGhi")}/>{period.sensorAvailable && <Bar yAxisId="irradiance" dataKey="sensorGhi" name="Site irradiance" fill="#249b61" hide={chartVisibility.isHidden("sensorGhi")}/>}</ComposedChart> : <ComposedChart data={inverterSeries} margin={{...chartMargin,right:4}}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis yAxisId="power" axisLine={false} tickLine={false}/><YAxis yAxisId="irradiance" orientation="right" axisLine={false} tickLine={false}/><Tooltip/><Legend {...chartVisibility.legendProps}/><Area yAxisId="power" dataKey="dc" name="DC power" stroke="#f0ab40" fill="#f0ab4025" connectNulls={false} hide={chartVisibility.isHidden("dc")}/><Line yAxisId="power" dataKey="ac" name="AC power" stroke="#ef654b" strokeWidth={2} dot={false} connectNulls={false} hide={chartVisibility.isHidden("ac")}/><Line yAxisId="irradiance" dataKey="solcastGhi" name="Solcast GHI" stroke="#8157b5" strokeWidth={1.6} strokeDasharray="5 3" dot={false} hide={chartVisibility.isHidden("solcastGhi")}/>{period.sensorAvailable && <Line yAxisId="irradiance" dataKey="sensorGhi" name="Site irradiance" stroke="#249b61" strokeWidth={1.4} dot={false} hide={chartVisibility.isHidden("sensorGhi")}/>}</ComposedChart>}</ResponsiveContainer></ChartPanel>
      <article className="panel string-status">
        <Tabs defaultValue="mppt" className="telemetry-tabs">
          <div className="string-telemetry-head">
            <div className="telemetry-heading"><strong>DC telemetry</strong><span>VCOM MPPT readings · PLD string allocation</span></div>
            <TabsList><TabsTrigger value="mppt">MPPT ({configuration.mpptCount})</TabsTrigger><TabsTrigger value="strings">Strings ({configuration.connectedStrings}/{configuration.inputCapacity})</TabsTrigger></TabsList>
          </div>
          <TabsContent value="mppt" className="telemetry-tab-content">
            <div className="telemetry-context"><span>Health compares current per connected string.</span><code>{capturedAt ? `${capturedAt} · median ${num(normalizedMedian,1)} A/string` : "No reading in selection"}</code></div>
            {!telemetry && <div className="telemetry-empty"><Database/><strong>No VCOM inverter telemetry</strong><span>There is no inverter reading in {selectedPeriodLabel(period)}. PLD configuration remains available in the Strings tab.</span></div>}
            {telemetry && <><div className="string-tile-grid">{mppts.map(mppt => <div className={`string-tile ${severity(mppt.deviation,Boolean(mppt.reading))}`} key={mppt.mppt}><div className="string-tile-top"><span>MPPT {String(mppt.mppt).padStart(2,"0")}</span><em>{mppt.reading ? `${mppt.deviation >= 0 ? "+" : ""}${num(mppt.deviation,1)}%` : "no reading"}</em></div><strong>{mppt.reading ? num(mppt.reading.current,1) : "—"}{mppt.reading && <small>A</small>}</strong><div className="string-electrical"><span>{mppt.reading ? num(mppt.reading.voltage,0) : "—"}{mppt.reading && <small>V</small>}</span><b>{mppt.reading ? num(mppt.reading.power,2) : "—"}{mppt.reading && <small>kW</small>}</b></div><div className="mppt-allocation">{mppt.connectedStrings} connected {mppt.connectedStrings === 1 ? "string" : "strings"}{mppt.reading ? ` · ${num(mppt.normalizedCurrent,1)} A/string` : ""}</div></div>)}</div>
            <div className="string-telemetry-summary"><div className="string-legend"><span><i className="within"/>within 7%</span><span><i className="warning"/>7–15% low</span><span><i className="alarm"/>over 15% low</span></div><code>{num(mpptTotal,1)} kW across {telemetry.channels.length} reporting MPPTs</code></div>
            <p className="string-note">{noProduction ? "The latest five-minute interval has no DC production; the zero readings are retained as the current snapshot." : withinCount === telemetry.channels.length ? "All reporting MPPTs are within 7% after normalising by connected-string count." : `${withinCount} of ${telemetry.channels.length} reporting MPPTs are within 7% after connected-string normalisation.`}</p></>}
          </TabsContent>
          <TabsContent value="strings" className="telemetry-tab-content">
            <div className="telemetry-context"><span>Allocated from MPPT totals; the inverter does not expose separate input readings.</span><code>{configuration.connectedStrings} connected · {configuration.inputCapacity} capacity</code></div>
            <div className="string-config-grid">{connectedStrings.map(string => <div className={`string-tile string-config-card ${severity(string.deviation,Boolean(telemetryByMppt.get(string.mppt)))}`} key={string.id}><div className="string-tile-top"><span>{string.id}</span><em>{telemetryByMppt.get(string.mppt) ? "allocated" : "configuration"}</em></div><strong>{telemetryByMppt.get(string.mppt) ? num(string.current,1) : "—"}{telemetryByMppt.get(string.mppt) && <small>A</small>}</strong><div className="string-electrical"><span>{telemetryByMppt.get(string.mppt) ? num(string.voltage,0) : "—"}{telemetryByMppt.get(string.mppt) && <small>V</small>}</span><b>{telemetryByMppt.get(string.mppt) ? num(string.power,2) : "—"}{telemetryByMppt.get(string.mppt) && <small>kW</small>}</b></div></div>)}</div>
            <p className="string-note">String current and power are equal allocations of each measured MPPT total.</p>
          </TabsContent>
        </Tabs>
        <div className="inverter-metadata"><div><span>PLD model ID</span><strong>INVERTER_{inv.code}</strong></div><div><span>Configured DC</span><strong>{num(configuration.configuredDcKwp,2)} kWp</strong></div><div><span>MPPT / connected strings</span><strong>{configuration.mpptCount} / {configuration.connectedStrings}</strong></div><div><span>Input capacity / source</span><strong>{configuration.inputCapacity} · PLD + VCOM</strong></div></div>
      </article></div>
    <div className="telemetry-history-grid">
      <TelemetryHistoryPanel title="MPPT telemetry history" mode="mppt" history={history} configuration={configuration} loading={historyLoading} error={historyError}/>
      <TelemetryHistoryPanel title="String telemetry history" mode="strings" history={history} configuration={configuration} loading={historyLoading} error={historyError}/>
    </div>
    <article className="panel event-table"><div><strong>Source</strong><strong>Coverage</strong><strong>Resolution</strong><strong>Status</strong></div><div><span>{period.source.meterSource}</span><span>{selectedPeriodLabel(period)}</span><span>5-minute meters</span><span>{num(period.totals.meterAvailability,1)}%</span></div><div><span>{period.source.inverterSource}</span><span>{period.source.partialInverterDay ? `Partial ${period.source.partialInverterDay}${period.source.partialInverterThrough ? ` to ${period.source.partialInverterThrough}` : ""}` : selectedPeriodLabel(period)}</span><span>5-minute inverter + MPPT</span><span>{period.inverterCoverage}</span></div><div><span>{period.source.irradianceSource}</span><span>{selectedPeriodLabel(period)}</span><span>30-minute GHI</span><span>{period.totals.solcastPeakGhi > 0 ? "Available" : "No data"}</span></div></article></>;
}

export function MockEnergyDashboard() {
  const [view, setView] = useState<View>({kind:"portfolio"});
  const [surfaceMode,setSurfaceMode] = useState<SurfaceMode>("performance");
  const [range, setRange] = useState<DashboardRange>({from:anchorDate,to:anchorDate,fromTime:"00:00",toTime:"23:59"});
  const [catalogState, setCatalogState] = useState<{sites:PortfolioSite[];error:string|null}|null>(null);
  const [dataState, setDataState] = useState<{key:string;dataset:PrecoolDataset|null;error:string|null}|null>(null);
  const [telemetryState, setTelemetryState] = useState<{key:string;history:PrecoolTelemetryHistory|null;error:string|null}|null>(null);
  const [retry, setRetry] = useState(0);
  const sites = useMemo(() => catalogState?.sites ?? [],[catalogState]);
  const item = selectedSite(view,sites);
  const portfolioId = view.kind === "portfolio" ? view.portfolioId ?? "terradew-four" : item.portfolioId ?? "terradew-four";
  const visiblePortfolioSites = sitesForPortfolio(sites,portfolioId);
  const isContractPerformance = view.kind === "site" && surfaceMode === "performance";
  const needsOperationalData = !(view.kind === "portfolio" && portfolioId === "redefine-properties");
  const node = view.kind === "meter" ? item.nodes.find(value => (value.navigationKey ?? value.id) === view.nodeId) ?? item.nodes[0] : undefined;
  const from = format(range.from ?? anchorDate,"yyyy-MM-dd");
  const to = format(range.to ?? range.from ?? anchorDate,"yyyy-MM-dd");
  const fromTime = range.fromTime;
  const toTime = range.toTime;
  const requestKey = `${item.contractId ?? "catalog"}:${from}:${fromTime}:${to}:${toTime}:${retry}`;
  const dataset = dataState?.key === requestKey ? dataState.dataset : null;
  const dataError = dataState?.key === requestKey ? dataState.error : null;
  const loading = dataState?.key !== requestKey;
  const period = useMemo(() => dataset ? getPrecoolPeriod(dataset,from,to,fromTime,toTime) : null,[dataset,from,to,fromTime,toTime]);
  const telemetryRequestKey = view.kind === "inverter" ? `${from}:${fromTime}:${to}:${toTime}:${view.inverterCode}:${retry}` : null;
  const telemetryHistory = telemetryRequestKey && telemetryState?.key === telemetryRequestKey ? telemetryState.history : null;
  const telemetryError = telemetryRequestKey && telemetryState?.key === telemetryRequestKey ? telemetryState.error : null;
  const telemetryLoading = Boolean(telemetryRequestKey && telemetryState?.key !== telemetryRequestKey);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(appRoute("/api/contracts"), {cache:"no-store",signal:controller.signal})
      .then(async response => {
        const body = await response.json() as {sites?:PortfolioSite[];error?:string};
        if (!response.ok || !body.sites) throw new Error(body.error || `Contract request failed (${response.status})`);
        setCatalogState({sites:body.sites,error:null});
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogState({sites:[],error:error instanceof Error ? error.message : "Unable to load the contract catalog."});
      });
    return () => controller.abort();
  },[retry]);

  useEffect(() => {
    if (!item.contractId || !needsOperationalData) return;
    const controller = new AbortController();
    void fetch(appRoute(`/api/site?contract_id=${encodeURIComponent(item.contractId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&from_time=${encodeURIComponent(fromTime)}&to_time=${encodeURIComponent(toTime)}`), {cache:"no-store",signal:controller.signal})
      .then(async response => {
        const body = await response.json() as PrecoolDataset & {error?:string};
        if (!response.ok) throw new Error(body.error || `Doris request failed (${response.status})`);
        setDataState({key:requestKey,dataset:body,error:null});
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDataState({key:requestKey,dataset:null,error:error instanceof Error ? error.message : "Unable to load Doris data."});
      });
    return () => controller.abort();
  },[from,to,fromTime,toTime,item.contractId,requestKey,needsOperationalData]);

  useEffect(() => {
    if (view.kind !== "inverter" || !telemetryRequestKey) return;
    const controller = new AbortController();
    void fetch(appRoute(`/api/precool/telemetry?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&from_time=${encodeURIComponent(fromTime)}&to_time=${encodeURIComponent(toTime)}&inverter=${encodeURIComponent(view.inverterCode)}`), {cache:"no-store",signal:controller.signal})
      .then(async response => {
        const body = await response.json() as PrecoolTelemetryHistory & {error?:string};
        if (!response.ok) throw new Error(body.error || `Doris telemetry request failed (${response.status})`);
        setTelemetryState({key:telemetryRequestKey,history:body,error:null});
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setTelemetryState({key:telemetryRequestKey,history:null,error:error instanceof Error ? error.message : "Unable to load inverter telemetry."});
      });
    return () => controller.abort();
  },[from,to,fromTime,toTime,telemetryRequestKey,view]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({ name:"navigate_energy_asset_view", title:"Open energy asset view", description:"Navigate to the portfolio, a portfolio contract site, meter, PreCool inverter total, or PreCool inverter unit.", inputSchema:{type:"object",properties:{view:{type:"string"},site_code:{type:"string"},node_id:{type:"string"}},required:["view"],additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute(input:unknown){ const value=input as {view?:string;site_code?:string;node_id?:string}; if(value.view==="portfolio"){setView({kind:"portfolio"});return {view:"portfolio"};} const candidate=sites.find(entry=>entry.code===value.site_code)??sites.find(entry=>entry.code==="P0480"); if(!candidate) throw new Error("Contract catalog has not loaded"); if(value.view==="site"){setView({kind:"site",siteCode:siteNavigationId(candidate)});return {view:"site",site:candidate.code};} if(value.view==="meter"&&value.node_id){setView({kind:"meter",siteCode:siteNavigationId(candidate),nodeId:value.node_id});return {view:"meter",site:candidate.code,node:value.node_id};} if(value.view==="inverters"){setView({kind:"inverters",siteCode:"P0480"});return {view:"inverters"};} if(value.view==="inverter"){setView({kind:"inverter",siteCode:"P0480",inverterCode:"01"});return {view:"inverter",code:"01"};} throw new Error("Unsupported view"); } },{signal:lifecycle.signal});
    void Promise.resolve(registration).catch(()=>undefined); return () => lifecycle.abort();
  },[sites]);

  const catalogError = catalogState?.error;
  return <SidebarProvider defaultOpen style={{"--sidebar-width":"280px","--sidebar-width-icon":"48px"} as React.CSSProperties}><NavigationSidebar view={view} navigate={setView} sites={sites}/><SidebarInset className="application-main"><Topbar view={view} navigate={setView} range={range} onRangeChange={setRange} sites={sites} mode={surfaceMode} onModeChange={setSurfaceMode}/><main className="content-area">
    {(!catalogState || (sites.length > 0 && loading && needsOperationalData && !isContractPerformance)) && <LiveDataState/>}
    {catalogError && <LiveDataState error={catalogError} onRetry={() => setRetry(value => value + 1)}/>}
    {needsOperationalData && !isContractPerformance && !catalogError && !loading && dataError && <LiveDataState error={dataError} onRetry={() => setRetry(value => value + 1)}/>}
    {catalogState && !catalogError && view.kind === "portfolio" && <PortfolioView navigate={setView} period={portfolioId === "terradew-four" ? period : null} sites={visiblePortfolioSites} portfolioId={portfolioId}/>}
    {catalogState && !catalogError && isContractPerformance && item.contractId && <SiteContractPerformance site={item} from={from} to={to} fromTime={fromTime} toTime={toTime} operationalPeriod={period} operationsLoading={loading} operationsError={dataError} onRetryOperations={() => setRetry(value => value + 1)} onOpenNode={nodeId=>setView({kind:"meter",siteCode:siteNavigationId(item),nodeId})}/>}
    {period && view.kind === "site" && surfaceMode === "dashboard" && <SiteDashboardView item={item} period={period}/>}
    {period && view.kind === "meter" && node && (surfaceMode === "dashboard" ? <MeterDashboardView item={item} node={node} period={period}/> : <MeterView item={item} node={node} navigate={setView} period={period}/>)}
    {period && view.kind === "inverters" && <InverterTotalView navigate={setView} period={period}/>}
    {period && view.kind === "inverter" && <SingleInverterView code={view.inverterCode} period={period} history={telemetryHistory} historyLoading={telemetryLoading} historyError={telemetryError}/>}
  </main></SidebarInset></SidebarProvider>;
}
