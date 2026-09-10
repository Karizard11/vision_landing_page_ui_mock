"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, ArrowUpRight, BatteryCharging, Bell, Building2,
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleGauge, Database,
  Gauge, Home, Info, Layers3, Network, Search, SunMedium, Users, Zap,
} from "lucide-react";
import { addDays, differenceInCalendarDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isVirtualTotalNode, portfolioSites, portfolioTotals, siteNavigationNodes, type PortfolioNavigationNode, type PortfolioNode, type PortfolioSite } from "@/lib/portfolio-data";
import { inverterConfiguration, inverterSummary as inverterMetadata, site } from "@/lib/precool-data";
import { DEFAULT_PRECOOL_DATE, getPrecoolPeriod, type PrecoolDataset, type PrecoolPeriod } from "@/lib/precool-period";

type View =
  | { kind: "portfolio" }
  | { kind: "site"; siteCode: string }
  | { kind: "meter"; siteCode: string; nodeId: string }
  | { kind: "inverters"; siteCode: "P0480" }
  | { kind: "inverter"; siteCode: "P0480"; inverterCode: string };
type Navigate = (view: View) => void;

const anchorDate = new Date(`${DEFAULT_PRECOOL_DATE}T00:00:00`);
const today = new Date();
const augustStart = new Date("2026-08-01T00:00:00");
const augustEnd = new Date("2026-08-31T00:00:00");
const chartMargin = { top: 8, right: 12, left: -20, bottom: 0 };
const inverterColours = ["#0c5a63","#14717b","#23848c","#3f969b","#63aaab","#86bbbb","#f1b14b","#ed9b43","#ec8446","#ed6a4e","#d85448","#a94545"];
const monthPlan = (siteItem: PortfolioSite) => ["Mar","Apr","May","Jun","Jul","Aug"].map((month, index) => ({ month, plan: Math.round(siteItem.annualYieldKwh / 12 / 1000), actual: index === 5 && siteItem.code === "P0480" ? 203 : Math.round(siteItem.annualYieldKwh / 12 / 1000 * (.91 + index * .012)) }));

function num(value: number, digits = 1) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function selectedSite(view: View) {
  if (view.kind === "portfolio") return portfolioSites.find(item => item.code === "P0480")!;
  return portfolioSites.find(item => item.code === view.siteCode) ?? portfolioSites[0];
}

function p0480MeterId(nodeId: string) {
  return ({ "1140726":"site-total", "1140723":"solar-total", "1140730":"pvdb-1", "1140721":"pvdb-2", "1140727":"municipal-total", "1140724":"incomer-1", "1140728":"incomer-2", "1140729":"incomer-3" } as Record<string,string>)[nodeId];
}

function DateSelector({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  const [draft, setDraft] = useState<DateRange | undefined>(range);
  const [open, setOpen] = useState(false);
  const label = !range?.from ? "Select date" : range.to && +range.to !== +range.from ? `${format(range.from,"dd MMM yyyy")} - ${format(range.to,"dd MMM yyyy")}` : format(range.from,"dd MMM yyyy");
  const previousMonth = subMonths(startOfMonth(today),1);
  const presets: [string, Date, Date][] = [
    ["Today", today, today],
    ["Yesterday", addDays(today,-1), addDays(today,-1)],
    ["Last 7 days", addDays(today,-6), today],
    ["Last 30 days", addDays(today,-29), today],
    ["This month", startOfMonth(today), today],
    ["Last month", previousMonth, endOfMonth(previousMonth)],
    ["August 2026", augustStart, augustEnd],
  ];
  const span = range.from ? differenceInCalendarDays(range.to ?? range.from,range.from) : 0;
  const shift = (direction: -1|1) => {
    if (!range.from) return;
    const from = addDays(range.from,direction*(span+1));
    const to = addDays(range.to ?? range.from,direction*(span+1));
    if (to > today) return;
    onChange({from,to});
  };
  const canNext = Boolean(range.to && addDays(range.to,span+1) <= today);
  return <div className="date-navigation"><button onClick={() => shift(-1)} aria-label="Previous period"><ChevronLeft/></button><Popover open={open} onOpenChange={value => { setOpen(value); if (value) setDraft(range); }}>
    <PopoverTrigger asChild><Button variant="outline" className="date-button"><CalendarDays/><span>{label}</span><ChevronDown/></Button></PopoverTrigger>
    <PopoverContent align="end" className="date-picker"><div className="date-picker-title">Date</div><div className="date-picker-layout">
      <Calendar mode="range" numberOfMonths={2} max={31} selected={draft} onSelect={setDraft} defaultMonth={draft?.from ?? anchorDate} disabled={{after:today}}/>
      <div className="date-preset-list">{presets.map(([text,from,to]) => <button key={text} onClick={() => setDraft({from,to})}>{text}</button>)}</div>
    </div><div className="date-picker-actions"><button className="apply" onClick={() => { if (draft?.from) onChange({from:draft.from,to:draft.to ?? draft.from}); setOpen(false); }}>Apply</button><button onClick={() => setDraft({from:anchorDate,to:anchorDate})}>Reset</button><span>Up to 31 days · queried live from Doris</span></div></PopoverContent>
  </Popover><button onClick={() => shift(1)} disabled={!canNext} aria-label="Next period"><ChevronRight/></button></div>;
}

function BrandLogo() {
  return <div className="brand-logo" aria-label="Terradew"><span/><span/><span/><span/></div>;
}

function nodeDepth(node: PortfolioNode, nodes: PortfolioNode[]) {
  let depth = 0;
  let parent = node.parentId;
  const seen = new Set<string>();
  while (parent && depth < 3 && !seen.has(parent)) { seen.add(parent); const found = nodes.find(item => item.id === parent); if (!found) break; depth += 1; parent = found.parentId; }
  return depth;
}

function navigationNodeIsVisible(siteCode: string, node: PortfolioNavigationNode, nodes: PortfolioNavigationNode[], collapsed: ReadonlySet<string>) {
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find(candidate => candidate.id === parentId);
    if (!parent) break;
    if (collapsed.has(`${siteCode}:${parent.navigationKey}`)) return false;
    parentId = parent.parentId;
  }
  return true;
}

function NodeIcon({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower.includes("solar")) return <SunMedium/>;
  if (lower.includes("bess")) return <BatteryCharging/>;
  if (lower.includes("generator")) return <Zap/>;
  return <CircleGauge/>;
}

function NavigationSidebar({ view, navigate }: { view: View; navigate: Navigate }) {
  const current = selectedSite(view);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["P0480"]));
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const visibleSites = portfolioSites.filter(item => !query || `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase()));
  function openSite(item: PortfolioSite) { setExpanded(previous => { const next = new Set(previous); if (next.has(item.code) && current.code === item.code) next.delete(item.code); else next.add(item.code); return next; }); navigate({kind:"site",siteCode:item.code}); }
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
        <button className={`provider-row ${view.kind === "portfolio" ? "active" : ""}`} onClick={() => navigate({kind:"portfolio"})}><ChevronDown/><Layers3/><span>Terradew Four</span><small>({portfolioSites.length})</small></button>
        {visibleSites.map(item => { const activeSite = view.kind !== "portfolio" && view.siteCode === item.code; const isOpen = expanded.has(item.code) || activeSite; const navigationNodes = siteNavigationNodes(item); return <div className="site-tree" key={item.code}>
          <button className={`site-tree-row ${activeSite ? "active" : ""}`} onClick={() => openSite(item)}><ChevronRight className={isOpen ? "rotated" : ""}/><Building2/><span>{item.name}</span><small>({item.meterCount})</small></button>
          {isOpen && <div className="site-node-list">{navigationNodes.map(node => {
            const collapseKey = `${item.code}:${node.navigationKey}`;
            if (!navigationNodeIsVisible(item.code,node,navigationNodes,collapsedNodes)) return null;
            const activeNode = view.kind === "meter" && view.siteCode === item.code && view.nodeId === node.id;
            const branchInverters = item.code !== "P0480" ? [] : node.id === "1140730" ? inverterMetadata.slice(0,6) : node.id === "1140721" ? inverterMetadata.slice(6,12) : [];
            const hasChildren = navigationNodes.some(candidate => candidate.parentId === node.id) || branchInverters.length > 0 || (item.code === "P0480" && node.id === "1140723");
            const isExpanded = !collapsedNodes.has(collapseKey);
            return <div className="node-branch" key={`${item.code}-${node.navigationKey}`}>
              <div style={{paddingLeft:20 + nodeDepth(node,navigationNodes) * 14}} className={`node-row node-parent-row ${activeNode ? "active" : ""}`}>
                {hasChildren ? <button type="button" className="node-toggle" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.name}`} aria-expanded={isExpanded} onClick={() => toggleNode(collapseKey)}><ChevronRight className={isExpanded ? "rotated" : ""}/></button> : <span className="node-toggle-spacer"/>}
                <button type="button" className="node-link" onClick={() => navigate({kind:"meter",siteCode:item.code,nodeId:node.id})}><NodeIcon type={node.type}/><span>{node.name}</span>{node.meters > 1 && <small>{node.meters}</small>}</button>
              </div>
              {isExpanded && item.code === "P0480" && node.id === "1140723" && <button style={{paddingLeft:20 + (nodeDepth(node,navigationNodes)+1) * 14}} className={`node-row inverter-node ${view.kind === "inverters" ? "active" : ""}`} onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><span className="node-toggle-spacer"/><Layers3/><span>Inverter total</span><small>12</small></button>}
              {isExpanded && branchInverters.map(inv => <button style={{paddingLeft:20 + (nodeDepth(node,navigationNodes)+1) * 14}} key={inv.code} className={`node-row inverter-unit ${view.kind === "inverter" && view.inverterCode === inv.code ? "active" : ""}`} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><span className="node-toggle-spacer"/><Gauge/><span>Inverter {inv.code.padStart(3,"0")}</span></button>)}
            </div>;
          })}</div>}
        </div>; })}
      </div>
    </section>
  </Sidebar>;
}

function Breadcrumb({ view, navigate }: { view: View; navigate: Navigate }) {
  if (view.kind === "portfolio") return <><Database/><strong>Portfolio</strong></>;
  const item = selectedSite(view);
  let tail = item.name;
  if (view.kind === "meter") tail = item.nodes.find(node => node.id === view.nodeId)?.name ?? "Meter";
  if (view.kind === "inverters") tail = "Inverter total";
  if (view.kind === "inverter") tail = `Inverter ${view.inverterCode}`;
  return <><Database/><button onClick={() => navigate({kind:"portfolio"})}>Portfolio</button><ChevronRight/><button onClick={() => navigate({kind:"site",siteCode:item.code})}>{item.name}</button>{view.kind !== "site" && <><ChevronRight/><strong>{tail}</strong></>}</>;
}

function Topbar({ view, navigate, range, onRangeChange }: { view: View; navigate: Navigate; range: DateRange; onRangeChange: (range: DateRange) => void }) {
  return <><header className="top-bar"><div className="top-breadcrumb"><Breadcrumb view={view} navigate={navigate}/></div><label className="property-search"><Search/><input placeholder="Search property" aria-label="Search property"/></label><div className="top-actions"><DateSelector range={range} onChange={onRangeChange}/><button className="add-site">Add Site</button><button className="notification" aria-label="Notifications"><Bell/></button></div></header>
  {view.kind !== "portfolio" && <div className="view-switch"><button className="active">Performance <Activity/></button><button>Dashboard</button></div>}</>;
}

function PageTitle({ title, subtitle, action = true }: { title: string; subtitle: string; action?: boolean }) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="view-dashboard">View dashboard</button>}</div>;
}

function MiniBars({ danger = false }: { danger?: boolean }) { return <div className="mini-bars"><i/><i/><i/><i/><i/><i className={danger ? "danger" : "accent"}/></div>; }

function Kpi({ icon: Icon, label, value, unit, note, delta, tone, bars }: { icon: LucideIcon; label: string; value: string; unit?: string; note: string; delta?: string; tone?: "green"|"red"|"amber"; bars?: boolean }) {
  return <article className="kpi-card"><div className="kpi-head"><span><Icon/>{label}<Info/></span>{delta && <em><ArrowUpRight/>{delta}</em>}</div><div className={`kpi-value ${tone ?? ""}`}>{value}<small>{unit}</small></div>{bars && <MiniBars danger={tone === "red"}/>}<p className={tone === "red" ? "red-note" : ""}>{note}</p></article>;
}

function ChartPanel({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <article className={`panel chart-panel ${className}`}><div className="panel-head"><strong>{title}</strong>{hint && <span>{hint}</span>}</div><div className="chart-area">{children}</div></article>;
}

function selectedPeriodLabel(period: PrecoolPeriod) {
  const from = format(new Date(`${period.from}T00:00:00`),"dd MMM yyyy");
  const to = format(new Date(`${period.to}T00:00:00`),"dd MMM yyyy");
  return period.from === period.to ? from : `${from} – ${to}`;
}

function CoverageNotice({ period }: { period: PrecoolPeriod }) {
  const meterCoverage = period.totals.meterAvailability;
  if (meterCoverage === 0 && period.totals.inverterReadings === 0) return <div className="coverage-notice warning"><AlertTriangle/>No PreCool meter or inverter readings were returned from Doris for {selectedPeriodLabel(period)}.</div>;
  if (period.inverterCoverage === "complete" && meterCoverage >= 99.9) return <div className="coverage-notice complete"><Check/>Live Doris meter, Solcast and all 12 inverter feeds are complete for {selectedPeriodLabel(period)}.</div>;
  const partialDay = period.source.partialInverterDay ? format(new Date(`${period.source.partialInverterDay}T00:00:00`),"dd MMM yyyy") : null;
  const copy = period.inverterCoverage === "partial"
    ? `VCOM inverter data is partial${partialDay ? ` on ${partialDay}` : ""}${period.source.partialInverterThrough ? ` through ${period.source.partialInverterThrough}` : ""}; meter coverage is ${num(meterCoverage,1)}%.`
    : period.inverterCoverage === "unavailable"
      ? `VCOM inverter telemetry is unavailable for this selection; meter coverage is ${num(meterCoverage,1)}%.`
      : `Live inverter coverage is mixed across this range; meter coverage is ${num(meterCoverage,1)}%.`;
  return <div className="coverage-notice warning"><AlertTriangle/>{copy}</div>;
}

function LiveDataState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return <div className={`live-data-state ${error ? "error" : "loading"}`}><Database/><strong>{error ? "Unable to load Doris data" : "Loading live PreCool data"}</strong><span>{error ?? "Querying meters, inverters, MPPT channels and irradiance for the selected dates."}</span>{error && <button onClick={onRetry}>Retry</button>}</div>;
}

function PortfolioCard({ item, navigate }: { item: PortfolioSite; navigate: Navigate }) {
  const dailyPlan = item.annualYieldKwh / 365;
  return <button className="portfolio-site-card" onClick={() => navigate({kind:"site",siteCode:item.code})}><div className="site-thumb"><SunMedium/></div><div className="site-card-copy"><strong>{item.name}</strong><span>{item.code} | {num(item.capacityKwp/1000,2)}MWp | {item.guarantee}% guarantee</span><div><label>Daily yield plan<b>{num(dailyPlan,0)}<small> kWh</small></b></label><label>Contract rate<b>{item.tariff ? `R ${num(item.tariff,2)}` : "—"}</b></label></div></div><div className="site-card-status"><span>Active</span><b>{item.meterCount} meters</b><em>{item.city}</em></div></button>;
}

function PortfolioView({ navigate, period }: { navigate: Navigate; period: PrecoolPeriod }) {
  const chartUnit = period.granularity === "hour" ? "kW" : "MWh/day";
  const dataAsOf = period.source.dataAsOf ? format(new Date(period.source.dataAsOf),"dd MMM yyyy HH:mm") : "no readings in selection";
  const gridShare = period.totals.estimatedLoadMwh > 0 ? period.totals.gridImportMwh / period.totals.estimatedLoadMwh * 100 : 0;
  return <><PageTitle title="Terradew Four" subtitle={`${portfolioTotals.sites} sites | ${portfolioTotals.meters} meters | Doris as of ${dataAsOf}`} action={false}/>
    <div className="kpi-grid portfolio-kpis"><Kpi icon={SunMedium} label="PreCool solar" value={num(period.totals.solarEnergyMwh,3)} unit="MWh" note={selectedPeriodLabel(period)} delta="metered" tone="green"/><Kpi icon={Database} label="PreCool solar value" value={`R ${num(period.totals.avoidedCostZar,0)}`} note={`Energy at R ${num(site.tariff,2)}/kWh`}/><Kpi icon={Network} label="PreCool grid supply" value={num(period.totals.gridImportMwh,3)} unit="MWh" note={num(gridShare,1) + "% of estimated site demand"} delta="metered" tone="green"/><Kpi icon={Activity} label="PreCool meter availability" value={num(period.totals.meterAvailability,1)} unit="%" note="Five SLD meters" delta="online" tone="green"/></div>
    <div className="portfolio-overview"><article className="panel exposure"><div className="panel-head"><strong>Exposure</strong><span>portfolio</span></div><div><Check/><span>Sites with active VCOM systems</span><b>23 of 23</b></div><div><AlertTriangle/><span>Sites below 95% guarantee</span><b>1 of 23</b></div><div><Database/><span>Physical meters in SLD</span><b>129</b></div></article>
      <ChartPanel title="Yield, expectation and grid use | P0480 PreCool" hint={`${selectedPeriodLabel(period)} · ${chartUnit}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={period.power} margin={{...chartMargin,bottom:8}}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:8}}/><Area type="monotone" stackId="supply" dataKey="grid" name={`Grid supply ${chartUnit}`} stroke="#286f79" fill="#31808a" fillOpacity={0.62} dot={false}/><Area type="monotone" stackId="supply" dataKey="solar" name={`Metered solar ${chartUnit}`} stroke="#f15b45" fill="#ff806c" fillOpacity={0.72} dot={false}/><Area type="monotone" dataKey="expected" name={`Solcast expectation ${chartUnit}`} stroke="#579363" fill="#66a26f" fillOpacity={0.1} strokeDasharray="5 4" dot={false}/></AreaChart></ResponsiveContainer></ChartPanel>
    </div>
    <section className="all-sites"><div className="section-label"><strong>All Sites ({portfolioSites.length})</strong><span>Terradew Four</span></div><div className="portfolio-sites-grid">{portfolioSites.map(item => <PortfolioCard key={item.code} item={item} navigate={navigate}/>)}</div></section>
  </>;
}

function NodeCard({ node, item, navigate }: { node: PortfolioNode; item: PortfolioSite; navigate: Navigate }) {
  return <button className="meter-card" onClick={() => navigate({kind:"meter",siteCode:item.code,nodeId:node.id})}><div><NodeIcon type={node.type}/><strong>{node.name}</strong></div><span>{node.type}</span><small>Node {node.id}</small><em>{node.meters} meter{node.meters === 1 ? "" : "s"}</em></button>;
}

function SiteView({ item, navigate, period }: { item: PortfolioSite; navigate: Navigate; period: PrecoolPeriod }) {
  const isPrecool = item.code === "P0480";
  const physicalMeterNodes = item.nodes.filter(node => !isVirtualTotalNode(node));
  const types = item.nodes.reduce<Record<string,number>>((acc,node) => { acc[node.type] = (acc[node.type] ?? 0) + 1; return acc; },{});
  const chartUnit = period.granularity === "hour" ? "kW" : "MWh/day";
  return <><PageTitle title={item.name} subtitle={`${item.code} | ${item.city} | ${num(item.capacityKwp/1000,2)}MWp | commissioned ${item.commissioned}`}/>
    {isPrecool && <CoverageNotice period={period}/>}
    <div className="kpi-grid site-primary-kpis"><Kpi icon={Database} label="Site capacity" value={num(item.capacityKwp/1000,2)} unit="MWp" note={`${item.nodeCount} SLD nodes`} bars/><Kpi icon={Zap} label={isPrecool ? "Solar energy" : "Energy today"} value={isPrecool ? num(period.totals.solarEnergyMwh,3) : num(item.annualYieldKwh/365,1)} unit={isPrecool ? "MWh" : "kWh"} note={isPrecool ? selectedPeriodLabel(period) : "contract daily yield plan"} tone="green" bars/><Kpi icon={Gauge} label="Performance ratio" value={isPrecool ? num(period.totals.prEstimate,1) : num(item.guarantee,1)} unit="%" note={isPrecool ? "Metered energy ÷ Solcast irradiation" : "contract yield guarantee"} tone="green" bars/><Kpi icon={Activity} label="Meter availability" value={isPrecool ? num(period.totals.meterAvailability,1) : "Active"} unit={isPrecool ? "%" : undefined} note={isPrecool ? `Inverters ${num(period.totals.inverterAvailability,1)}%` : `VCOM ${item.systemKey}`} delta={isPrecool && period.inverterCoverage !== "complete" ? "partial" : "online"} tone={isPrecool && period.inverterCoverage !== "complete" ? "amber" : "green"} bars/><Kpi icon={Database} label="Mapped meters" value={String(item.meterCount)} note={`${item.nodeCount} hierarchy nodes`} bars/><Kpi icon={Check} label="Contract obligation" value={num(item.guarantee,1)} unit="%" note={item.tariff ? `PPA R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"} bars/></div>
    <div className="kpi-grid savings-kpis"><Kpi icon={SunMedium} label="Self consumed solar" value={isPrecool ? num(period.totals.solarEnergyMwh,3) : num(item.annualYieldKwh/1000,0)} unit={isPrecool ? "MWh" : "MWh/y"} note={isPrecool ? selectedPeriodLabel(period) : "contracted annual yield"} delta="solar" tone="green"/><Kpi icon={Database} label="Savings from self consumed solar" value={isPrecool ? `R ${num(period.totals.avoidedCostZar,0)}` : item.tariff ? `R ${num(item.annualYieldKwh * item.tariff,0)} / y` : "—"} note={item.tariff ? `PPA R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"}/><Kpi icon={Network} label="Grid export" value={isPrecool ? num(period.totals.gridExportKwh,1) : "—"} unit={isPrecool ? "kWh" : undefined} note={isPrecool ? "Measured incomer register delta" : "interval export unavailable"} delta={isPrecool ? "measured" : undefined} tone={isPrecool ? "green" : undefined}/><Kpi icon={Activity} label="Grid import" value={isPrecool ? num(period.totals.gridImportMwh,3) : "Active"} unit={isPrecool ? "MWh" : undefined} note={isPrecool ? "Three incomer register deltas" : `VCOM ${item.systemKey}`} delta="metered" tone="green"/></div>
    <div className="site-chart-row"><ChartPanel title={isPrecool ? `Site overview | ${chartUnit}` : "Contract yield profile (MWh)"} hint={isPrecool ? selectedPeriodLabel(period) : undefined}>{isPrecool ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={period.power} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Area dataKey="grid" name={`Grid supply ${chartUnit}`} stroke="#185c68" fill="#185c6870"/><Area dataKey="solar" name={`Solar ${chartUnit}`} stroke="#55a96f" fill="#65ba7580"/></AreaChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={monthPlan(item)} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="plan" name="Monthly yield plan MWh" fill="#dfe6e7"/><Bar dataKey="actual" name="Contract-derived profile MWh" fill="#249b61"/></BarChart></ResponsiveContainer>}</ChartPanel>
      <article className="panel loss-list"><div className="panel-head"><strong>SLD hierarchy</strong><span>{item.nodeCount} nodes</span></div>{Object.entries(types).map(([type,count]) => <div key={type}><span>{type || "Unclassified"}</span><b>{count}</b></div>)}</article></div>
    <section className="all-meters"><div className="section-label"><strong>All Meters ({item.meterCount})</strong><span>select a physical meter</span></div><div className="meter-card-grid">{physicalMeterNodes.map(node => <NodeCard key={node.id} node={node} item={item} navigate={navigate}/>)}</div></section>
  </>;
}

function MeterView({ item, node, navigate, period }: { item: PortfolioSite; node: PortfolioNode; navigate: Navigate; period: PrecoolPeriod }) {
  const meterId = item.code === "P0480" ? p0480MeterId(node.id) : undefined;
  const solar = node.type.toLowerCase().includes("solar");
  const key = meterId === "pvdb-1" ? "pvdb1" : meterId === "pvdb-2" ? "pvdb2" : meterId === "solar-total" ? "solar" : meterId === "municipal-total" ? "grid" : meterId === "site-total" ? "site" : meterId?.replace("-","");
  const connected = meterId === "solar-total"
    ? item.nodes.filter(value => value.id === "1140730" || value.id === "1140721")
    : item.nodes.filter(value => value.parentId === node.id);
  const meterSnapshot = key === "solar"
    ? {energyMwh:period.totals.solarEnergyMwh,peakKw:period.totals.peakSolarKw,readings:(period.meters.pvdb1?.readings ?? 0)+(period.meters.pvdb2?.readings ?? 0)}
    : key === "grid"
      ? {energyMwh:period.totals.gridImportMwh,peakKw:Math.max(0,...period.power.map(point => point.grid)),readings:(period.meters.incomer1?.readings ?? 0)+(period.meters.incomer2?.readings ?? 0)+(period.meters.incomer3?.readings ?? 0)}
      : key === "site"
        ? {energyMwh:period.totals.estimatedLoadMwh,peakKw:Math.max(0,...period.power.map(point => point.grid+point.solar)),readings:Object.values(period.meters).reduce((sum,meter) => sum+meter.readings,0)}
        : key ? period.meters[key] : undefined;
  const hasLiveMeterData = item.code === "P0480" && Boolean(meterSnapshot);
  const chartData = hasLiveMeterData ? period.power.map(point => ({...point,site:point.grid+point.solar})) : monthPlan(item);
  const branchInverters = meterId === "pvdb-1" ? period.inverterSummary.slice(0,6) : meterId === "pvdb-2" ? period.inverterSummary.slice(6,12) : period.inverterSummary;
  const showsInverters = item.code === "P0480" && (meterId === "pvdb-1" || meterId === "pvdb-2");
  const showsChildren = showsInverters || connected.length > 0;
  const energyValue = meterSnapshot ? period.dayCount === 1 ? num(meterSnapshot.energyMwh*1000,1) : num(meterSnapshot.energyMwh,3) : "—";
  const energyUnit = period.dayCount === 1 ? "kWh" : "MWh";
  const chartUnit = period.granularity === "hour" ? "kW" : "MWh/day";
  const meterAvailability = meterSnapshot ? meterSnapshot.readings/(period.dayCount*288*(key === "solar" ? 2 : key === "grid" ? 3 : key === "site" ? 5 : 1))*100 : 0;
  return <><PageTitle title={node.name} subtitle={`${item.name} | ${node.type} | Device node ${node.id}`}/>
    {item.code === "P0480" && <CoverageNotice period={period}/>}
    <div className={`kpi-grid ${solar ? "meter-five-kpis" : "meter-four-kpis"}`}>{solar ? <><Kpi icon={Zap} label="Peak output" value={meterSnapshot ? num(meterSnapshot.peakKw,1) : "—"} unit={meterSnapshot ? "kW" : undefined} note={selectedPeriodLabel(period)} delta="peak" tone="green"/><Kpi icon={Database} label="Grid import" value={num(period.totals.gridImportMwh,3)} unit="MWh" note="Three site incomers"/><Kpi icon={SunMedium} label="Solar energy" value={energyValue} unit={meterSnapshot ? energyUnit : undefined} note="Solar export register delta" delta="measured" tone="green"/><Kpi icon={Gauge} label="Solcast peak GHI" value={num(period.totals.solcastPeakGhi,1)} unit="W/m²" note="Satellite irradiance" delta="peak" tone="green"/><Kpi icon={Activity} label="Avoided cost" value={meterSnapshot && item.tariff ? `R ${num(meterSnapshot.energyMwh*1000*item.tariff,0)}` : "—"} note={item.tariff ? `energy at R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"} delta="value" tone="green"/></> : <><Kpi icon={Zap} label="Peak demand" value={meterSnapshot ? num(meterSnapshot.peakKw,1) : "—"} unit={meterSnapshot ? "kW" : undefined} note={selectedPeriodLabel(period)} delta="peak" tone="green"/><Kpi icon={Database} label="Imported energy" value={energyValue} unit={meterSnapshot ? energyUnit : undefined} note="Import register delta"/><Kpi icon={Gauge} label="Meter availability" value={num(meterAvailability,1)} unit="%" note={`${meterSnapshot?.readings ?? 0} five-minute readings`} delta="metered" tone="green"/><Kpi icon={Activity} label="Estimated cost" value={meterSnapshot && item.tariff ? `R ${num(meterSnapshot.energyMwh*1000*item.tariff,0)}` : "—"} note={item.tariff ? `energy at R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"} tone="green"/></>}</div>
    <ChartPanel title={solar ? "Solar and grid profile" : "Energy profile"} hint={hasLiveMeterData ? `${selectedPeriodLabel(period)} · ${chartUnit}` : "contract-derived monthly plan"}>{hasLiveMeterData && solar ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Line dataKey={key} name={`${node.name} ${chartUnit}`} stroke="#f0ad42" strokeWidth={2} dot={false}/><Line dataKey="expected" name={`Solcast expectation ${chartUnit}`} stroke="#ef705f" strokeDasharray="4 3" dot={false}/><Line dataKey="grid" name={`Grid total ${chartUnit}`} stroke="#526f76" strokeWidth={1.4} dot={false}/></ComposedChart></ResponsiveContainer> : hasLiveMeterData ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="grid" name={`Site demand ${chartUnit}`} fill="#dfe5e6"/>{key !== "grid" && <Bar dataKey={key} name={`${node.name} ${chartUnit}`} fill="#249b61"/>}</BarChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="plan" fill="#dfe5e6"/><Bar dataKey="actual" fill={solar ? "#249b61" : "#185c68"}/></BarChart></ResponsiveContainer>}</ChartPanel>
    {showsChildren && <section className="all-meters"><div className="section-label"><strong>{showsInverters ? "Inverters" : "Child nodes"}</strong><span>{meterId === "pvdb-1" ? "PVDB 1 · Inverters 001–006" : meterId === "pvdb-2" ? "PVDB 2 · Inverters 007–012" : item.name}</span></div>{showsInverters ? <div className="meter-card-grid">{branchInverters.map(inv => <button className="meter-card" key={inv.code} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><Gauge/><strong>Inverter {inv.code.padStart(3,"0")}</strong></div><span>{Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} · {inv.model}</span><small>{inv.hasData ? `${num(inv.energy,1)} kWh` : "No VCOM data"}</small><em>{inv.hasData ? inv.availability >= 99.9 ? "Complete" : "Partial" : "Unavailable"}</em></button>)}</div> : <div className="meter-card-grid">{meterId === "solar-total" && <button className="meter-card" onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><div><Layers3/><strong>Inverter total</strong></div><span>12 Sungrow units</span><small>{period.totals.inverterReadings ? `${num(period.totals.inverterEnergyMwh,3)} MWh` : "No VCOM data"}</small><em>Open</em></button>}{connected.map(value => <NodeCard key={value.id} node={value} item={item} navigate={navigate}/>)}</div>}</section>}
  </>;
}

function InverterTotalView({ navigate, period }: { navigate: Navigate; period: PrecoolPeriod }) {
  const chartUnit = period.granularity === "hour" ? "hourly power (kW)" : "daily peak power (kW)";
  const reporting = period.inverterSummary.filter(item => item.hasData).length;
  return <><PageTitle title="Inverter total" subtitle={`PreCool Cold Storage | Solar Total | ${period.inverterSummary.length} Sungrow SG125CX-P2 inverters`}/><CoverageNotice period={period}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC peak" value={period.totals.inverterReadings ? num(period.totals.peakAcMw,3) : "—"} unit={period.totals.inverterReadings ? "MW" : undefined} note="Summed inverter output" delta={period.totals.inverterReadings ? "measured" : undefined} tone={period.totals.inverterReadings ? "green" : undefined}/><Kpi icon={Zap} label="Energy" value={period.totals.inverterReadings ? num(period.totals.inverterEnergyMwh,3) : "—"} unit={period.totals.inverterReadings ? "MWh" : undefined} note={selectedPeriodLabel(period)}/><Kpi icon={Database} label="Cumulative energy" value={period.totals.cumulativeEnergyGwh !== null ? num(period.totals.cumulativeEnergyGwh,3) : "—"} unit={period.totals.cumulativeEnergyGwh !== null ? "GWh" : undefined} note="Latest E_TOTAL in selection"/><Kpi icon={Activity} label="Availability" value={num(period.totals.inverterAvailability,1)} unit="%" note={`${reporting} / 12 units · ${period.totals.inverterReadings.toLocaleString("en-ZA")} readings`} delta={period.inverterCoverage === "complete" ? "online" : "partial"} tone={period.inverterCoverage === "complete" ? "green" : "amber"}/></div>
    <ChartPanel title="All inverter power" hint={`AC · ${chartUnit}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={period.inverterAc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/>{period.inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false} connectNulls={false}/>)}</LineChart></ResponsiveContainer></ChartPanel>
    <ChartPanel title="All inverter DC power" hint={`P_DC · ${chartUnit}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={period.inverterDc} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/>{period.inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false} connectNulls={false}/>)}</LineChart></ResponsiveContainer></ChartPanel>
    <section className="all-meters"><div className="section-label"><strong>All Inverters ({period.inverterSummary.length})</strong><span>select a unit to view MPPT and strings</span></div><div className="inverter-list-grid">{period.inverterSummary.map((inv,index) => <button key={inv.code} className="inverter-summary-card" onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><i style={{background:inverterColours[index]}}/><strong>Inverter {inv.code.padStart(3,"0")}</strong><span className={inv.hasData ? "" : "no-data"}>{inv.hasData ? inv.availability >= 99.9 ? "Complete" : "Partial" : "No data"}</span></div><p>{inv.id} | {inv.model}</p><dl><div><dt>AC peak</dt><dd>{inv.hasData ? `${num(inv.peakAc,1)} kW` : "—"}</dd></div><div><dt>DC peak</dt><dd>{inv.hasData ? `${num(inv.peakDc,1)} kW` : "—"}</dd></div><div><dt>Energy</dt><dd>{inv.hasData ? `${num(inv.energy,1)} kWh` : "—"}</dd></div></dl></button>)}</div></section></>;
}

function SingleInverterView({ code, period }: { code: string; period: PrecoolPeriod }) {
  const inv = period.inverterSummary.find(item => item.code === code) ?? period.inverterSummary[0];
  const telemetry = period.telemetry[inv.code];
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
  const severity = (deviation: number, available = true) => !available ? "unavailable" : deviation >= -7 ? "within" : deviation >= -15 ? "warning" : "alarm";
  const withinCount = mppts.filter(value => value.reading && value.deviation >= -7).length;
  const irradianceUnit = period.granularity === "hour" ? "W/m²" : "kWh/m²/day";
  const chartUnit = period.granularity === "hour" ? "hourly power" : "daily peak power";
  const capturedAt = telemetry ? format(new Date(telemetry.capturedAt),"dd MMM yyyy HH:mm") : null;
  return <><PageTitle title={`Inverter ${inv.code.padStart(3,"0")}`} subtitle={`PreCool Cold Storage | ${Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} | ${inv.id} | ${inv.model}`}/><CoverageNotice period={period}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC peak" value={inv.hasData ? num(inv.peakAc,1) : "—"} unit={inv.hasData ? "kW" : undefined} note={selectedPeriodLabel(period)} delta={inv.hasData ? inv.availability >= 99.9 ? "complete" : "partial" : undefined} tone={inv.hasData ? inv.availability >= 99.9 ? "green" : "amber" : undefined} bars/><Kpi icon={Zap} label="Energy" value={inv.hasData ? num(inv.energy,1) : "—"} unit={inv.hasData ? "kWh" : undefined} note="Sum of daily E_DAY registers" bars/><Kpi icon={Activity} label="Conversion" value={inv.hasData ? num(ratio,1) : "—"} unit={inv.hasData ? "%" : undefined} note="Peak AC ÷ peak DC" tone={inv.hasData ? "green" : undefined} bars/><Kpi icon={Database} label="Cumulative energy" value={inv.hasData ? num(inv.cumulative/1000,1) : "—"} unit={inv.hasData ? "MWh" : undefined} note="Latest E_TOTAL in selection" bars/></div>
    <div className="inverter-detail-row"><ChartPanel title="AC and DC output with irradiance" hint={`${chartUnit} (kW) · Solcast ${irradianceUnit}${period.sensorAvailable ? " · site sensor" : " · site sensor unavailable"}`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={inverterSeries} margin={{...chartMargin,right:4}}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis yAxisId="power" axisLine={false} tickLine={false}/><YAxis yAxisId="irradiance" orientation="right" axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:8}}/><Area yAxisId="power" dataKey="dc" name="DC power" stroke="#f0ab40" fill="#f0ab4025" connectNulls={false}/><Line yAxisId="power" dataKey="ac" name="AC power" stroke="#ef654b" strokeWidth={2} dot={false} connectNulls={false}/><Line yAxisId="irradiance" dataKey="solcastGhi" name="Solcast GHI" stroke="#8157b5" strokeWidth={1.6} strokeDasharray="5 3" dot={false}/>{period.sensorAvailable && <Line yAxisId="irradiance" dataKey="sensorGhi" name="Site irradiance" stroke="#249b61" strokeWidth={1.4} dot={false}/>}</ComposedChart></ResponsiveContainer></ChartPanel>
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
            <p className="string-note">{withinCount === telemetry.channels.length ? "All reporting MPPTs are within 7% after normalising by connected-string count." : `${withinCount} of ${telemetry.channels.length} reporting MPPTs are within 7% after connected-string normalisation.`}</p></>}
          </TabsContent>
          <TabsContent value="strings" className="telemetry-tab-content">
            <div className="telemetry-context"><span>Allocated from MPPT totals; the inverter does not expose separate input readings.</span><code>{configuration.connectedStrings} connected · {configuration.inputCapacity} capacity</code></div>
            <div className="string-config-grid">{connectedStrings.map(string => <div className={`string-tile string-config-card ${severity(string.deviation,Boolean(telemetryByMppt.get(string.mppt)))}`} key={string.id}><div className="string-tile-top"><span>{string.id}</span><em>{telemetryByMppt.get(string.mppt) ? "allocated" : "configuration"}</em></div><strong>{telemetryByMppt.get(string.mppt) ? num(string.current,1) : "—"}{telemetryByMppt.get(string.mppt) && <small>A</small>}</strong><div className="string-electrical"><span>{telemetryByMppt.get(string.mppt) ? num(string.voltage,0) : "—"}{telemetryByMppt.get(string.mppt) && <small>V</small>}</span><b>{telemetryByMppt.get(string.mppt) ? num(string.power,2) : "—"}{telemetryByMppt.get(string.mppt) && <small>kW</small>}</b></div></div>)}</div>
            <p className="string-note">String current and power are equal allocations of each measured MPPT total.</p>
          </TabsContent>
        </Tabs>
        <div className="inverter-metadata"><div><span>PLD model ID</span><strong>INVERTER_{inv.code}</strong></div><div><span>Configured DC</span><strong>{num(configuration.configuredDcKwp,2)} kWp</strong></div><div><span>MPPT / connected strings</span><strong>{configuration.mpptCount} / {configuration.connectedStrings}</strong></div><div><span>Input capacity / source</span><strong>{configuration.inputCapacity} · PLD + VCOM</strong></div></div>
      </article></div>
    <article className="panel event-table"><div><strong>Source</strong><strong>Coverage</strong><strong>Resolution</strong><strong>Status</strong></div><div><span>{period.source.meterSource}</span><span>{selectedPeriodLabel(period)}</span><span>5-minute meters</span><span>{num(period.totals.meterAvailability,1)}%</span></div><div><span>{period.source.inverterSource}</span><span>{period.source.partialInverterDay ? `Partial ${period.source.partialInverterDay}${period.source.partialInverterThrough ? ` to ${period.source.partialInverterThrough}` : ""}` : selectedPeriodLabel(period)}</span><span>5-minute inverter + MPPT</span><span>{period.inverterCoverage}</span></div><div><span>{period.source.irradianceSource}</span><span>{selectedPeriodLabel(period)}</span><span>30-minute GHI</span><span>{period.totals.solcastPeakGhi > 0 ? "Available" : "No data"}</span></div></article></>;
}

export function MockEnergyDashboard() {
  const [view, setView] = useState<View>({kind:"portfolio"});
  const [range, setRange] = useState<DateRange>({from:anchorDate,to:anchorDate});
  const [dataState, setDataState] = useState<{key:string;dataset:PrecoolDataset|null;error:string|null}|null>(null);
  const [retry, setRetry] = useState(0);
  const item = selectedSite(view);
  const node = view.kind === "meter" ? item.nodes.find(value => value.id === view.nodeId) ?? item.nodes[0] : undefined;
  const from = format(range.from ?? anchorDate,"yyyy-MM-dd");
  const to = format(range.to ?? range.from ?? anchorDate,"yyyy-MM-dd");
  const requestKey = `${from}:${to}:${retry}`;
  const dataset = dataState?.key === requestKey ? dataState.dataset : null;
  const dataError = dataState?.key === requestKey ? dataState.error : null;
  const loading = dataState?.key !== requestKey;
  const period = useMemo(() => dataset ? getPrecoolPeriod(dataset,from,to) : null,[dataset,from,to]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/precool?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {cache:"no-store",signal:controller.signal})
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
  },[from,to,requestKey]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({ name:"navigate_energy_asset_view", title:"Open energy asset view", description:"Navigate to the portfolio, a Terradew Four site, a Precool meter, inverter total, or inverter unit.", inputSchema:{type:"object",properties:{view:{type:"string"},site_code:{type:"string"},node_id:{type:"string"}},required:["view"],additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute(input:unknown){ const value=input as {view?:string;site_code?:string;node_id?:string}; if(value.view==="portfolio"){setView({kind:"portfolio"});return {view:"portfolio"};} const candidate=portfolioSites.find(entry=>entry.code===value.site_code)??portfolioSites.find(entry=>entry.code==="P0480")!; if(value.view==="site"){setView({kind:"site",siteCode:candidate.code});return {view:"site",site:candidate.code};} if(value.view==="meter"&&value.node_id){setView({kind:"meter",siteCode:candidate.code,nodeId:value.node_id});return {view:"meter",site:candidate.code,node:value.node_id};} if(value.view==="inverters"){setView({kind:"inverters",siteCode:"P0480"});return {view:"inverters"};} if(value.view==="inverter"){setView({kind:"inverter",siteCode:"P0480",inverterCode:"01"});return {view:"inverter",code:"01"};} throw new Error("Unsupported view"); } },{signal:lifecycle.signal});
    void Promise.resolve(registration).catch(()=>undefined); return () => lifecycle.abort();
  },[]);

  return <SidebarProvider defaultOpen style={{"--sidebar-width":"280px","--sidebar-width-icon":"48px"} as React.CSSProperties}><NavigationSidebar view={view} navigate={setView}/><SidebarInset className="application-main"><Topbar view={view} navigate={setView} range={range} onRangeChange={setRange}/><main className="content-area">
    {loading && <LiveDataState/>}
    {!loading && dataError && <LiveDataState error={dataError} onRetry={() => setRetry(value => value + 1)}/>}
    {period && view.kind === "portfolio" && <PortfolioView navigate={setView} period={period}/>}
    {period && view.kind === "site" && <SiteView item={item} navigate={setView} period={period}/>}
    {period && view.kind === "meter" && node && <MeterView item={item} node={node} navigate={setView} period={period}/>}
    {period && view.kind === "inverters" && <InverterTotalView navigate={setView} period={period}/>}
    {period && view.kind === "inverter" && <SingleInverterView code={view.inverterCode} period={period}/>}
  </main></SidebarInset></SidebarProvider>;
}
