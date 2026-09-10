"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, ArrowUpRight, BatteryCharging, Bell, Building2,
  CalendarDays, Check, ChevronDown, ChevronRight, CircleGauge, Database,
  Gauge, Home, Info, Layers3, Network, Search, SunMedium, Users, Zap,
} from "lucide-react";
import { format, startOfMonth, startOfYear, subDays, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { portfolioSites, portfolioTotals, type PortfolioNode, type PortfolioSite } from "@/lib/portfolio-data";
import { inverterDcSeries, inverterStack, inverterStringTelemetry, inverterSummary, meters, powerSeries, site, totals } from "@/lib/precool-data";

type View =
  | { kind: "portfolio" }
  | { kind: "site"; siteCode: string }
  | { kind: "meter"; siteCode: string; nodeId: string }
  | { kind: "inverters"; siteCode: "P0480" }
  | { kind: "inverter"; siteCode: "P0480"; inverterCode: string };
type Navigate = (view: View) => void;

const anchorDate = new Date(2026, 7, 22);
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
  return ({ "1140723":"solar-total", "1140730":"pvdb-1", "1140721":"pvdb-2", "1140724":"incomer-1", "1140728":"incomer-2", "1140729":"incomer-3" } as Record<string,string>)[nodeId];
}

function DateSelector() {
  const [range, setRange] = useState<DateRange | undefined>({ from: anchorDate, to: anchorDate });
  const [draft, setDraft] = useState<DateRange | undefined>(range);
  const [open, setOpen] = useState(false);
  const label = !range?.from ? "Select date" : range.to && +range.to !== +range.from ? `${format(range.from,"dd MMM yyyy")} - ${format(range.to,"dd MMM yyyy")}` : format(range.from,"dd MMM yyyy");
  const presets: [string, Date, Date][] = [
    ["Today", anchorDate, anchorDate], ["Yesterday", subDays(anchorDate,1), subDays(anchorDate,1)],
    ["Since yesterday", subDays(anchorDate,1), anchorDate], ["Last 7 days", subDays(anchorDate,6), anchorDate],
    ["Last 30 days", subDays(anchorDate,29), anchorDate], ["This month", startOfMonth(anchorDate), anchorDate],
    ["Last month", startOfMonth(subMonths(anchorDate,1)), subDays(startOfMonth(anchorDate),1)], ["Year to date", startOfYear(anchorDate), anchorDate],
  ];
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) setDraft(range); }}>
    <PopoverTrigger asChild><Button variant="outline" className="date-button"><CalendarDays/><span>{label}</span><ChevronDown/></Button></PopoverTrigger>
    <PopoverContent align="end" className="date-picker"><div className="date-picker-title">Date</div><div className="date-picker-layout">
      <Calendar mode="range" numberOfMonths={2} selected={draft} onSelect={setDraft} defaultMonth={draft?.from}/>
      <div className="date-preset-list">{presets.map(([text,from,to]) => <button key={text} onClick={() => setDraft({from,to})}>{text}</button>)}</div>
    </div><div className="date-picker-actions"><button className="apply" onClick={() => { setRange(draft); setOpen(false); }}>Apply</button><button onClick={() => setDraft(undefined)}>Reset</button><span>Complete Doris snapshot: {site.snapshotDate}</span></div></PopoverContent>
  </Popover>;
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
  const [query, setQuery] = useState("");
  const visibleSites = portfolioSites.filter(item => !query || `${item.name} ${item.code}`.toLowerCase().includes(query.toLowerCase()));
  function openSite(item: PortfolioSite) { setExpanded(previous => { const next = new Set(previous); if (next.has(item.code) && current.code === item.code) next.delete(item.code); else next.add(item.code); return next; }); navigate({kind:"site",siteCode:item.code}); }
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
        {visibleSites.map(item => { const activeSite = view.kind !== "portfolio" && view.siteCode === item.code; const isOpen = expanded.has(item.code) || activeSite; return <div className="site-tree" key={item.code}>
          <button className={`site-tree-row ${activeSite ? "active" : ""}`} onClick={() => openSite(item)}><ChevronRight className={isOpen ? "rotated" : ""}/><Building2/><span>{item.name}</span><small>({item.meterCount})</small></button>
          {isOpen && <div className="site-node-list">{item.nodes.map(node => {
            const activeNode = view.kind === "meter" && view.siteCode === item.code && view.nodeId === node.id;
            const branchInverters = item.code !== "P0480" ? [] : node.id === "1140730" ? inverterSummary.slice(0,6) : node.id === "1140721" ? inverterSummary.slice(6,12) : [];
            return <div className="node-branch" key={`${item.code}-${node.id}`}>
              <button style={{paddingLeft:20 + nodeDepth(node,item.nodes) * 14}} className={`node-row ${activeNode ? "active" : ""}`} onClick={() => navigate({kind:"meter",siteCode:item.code,nodeId:node.id})}><ChevronRight/><NodeIcon type={node.type}/><span>{node.name}</span>{node.meters > 1 && <small>{node.meters}</small>}</button>
              {item.code === "P0480" && node.id === "1140723" && <button className={`node-row inverter-node ${view.kind === "inverters" ? "active" : ""}`} onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><ChevronRight/><Layers3/><span>Inverter total</span><small>12</small></button>}
              {branchInverters.map(inv => <button key={inv.code} className={`node-row inverter-unit ${view.kind === "inverter" && view.inverterCode === inv.code ? "active" : ""}`} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><ChevronRight/><Gauge/><span>Inverter {inv.code.padStart(3,"0")}</span></button>)}
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

function Topbar({ view, navigate }: { view: View; navigate: Navigate }) {
  return <><header className="top-bar"><div className="top-breadcrumb"><Breadcrumb view={view} navigate={navigate}/></div><label className="property-search"><Search/><input placeholder="Search property" aria-label="Search property"/></label><div className="top-actions"><DateSelector/><button className="add-site">Add Site</button><button className="notification" aria-label="Notifications"><Bell/></button></div></header>
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

function PortfolioCard({ item, navigate }: { item: PortfolioSite; navigate: Navigate }) {
  const dailyPlan = item.annualYieldKwh / 365;
  return <button className="portfolio-site-card" onClick={() => navigate({kind:"site",siteCode:item.code})}><div className="site-thumb"><SunMedium/></div><div className="site-card-copy"><strong>{item.name}</strong><span>{item.code} | {num(item.capacityKwp/1000,2)}MWp | {item.guarantee}% guarantee</span><div><label>Daily yield plan<b>{num(dailyPlan,0)}<small> kWh</small></b></label><label>Contract rate<b>{item.tariff ? `R ${num(item.tariff,2)}` : "—"}</b></label></div></div><div className="site-card-status"><span>Active</span><b>{item.meterCount} meters</b><em>{item.city}</em></div></button>;
}

function PortfolioView({ navigate }: { navigate: Navigate }) {
  return <><PageTitle title="Terradew Four" subtitle={`${portfolioTotals.sites} sites | ${portfolioTotals.meters} meters | Last updated ${site.lastDorisRefresh}`} action={false}/>
    <div className="kpi-grid portfolio-kpis"><Kpi icon={SunMedium} label="Self consumed solar" value={num(totals.solarEnergyMwh,3)} unit="MWh" note={`Precool · ${site.snapshotDate}`} delta="metered" tone="green"/><Kpi icon={Database} label="Savings from self consumed solar" value={`R ${num(totals.avoidedCostZar,0)}`} note={`Precool energy at R ${num(site.tariff,2)}/kWh`}/><Kpi icon={Gauge} label="Demand + feed-in savings" value={`R ${num(totals.gridExportKwh * site.tariff,0)}`} note={`${num(totals.gridExportKwh,1)} kWh measured export`} delta="measured" tone="green"/><Kpi icon={Activity} label="Availability" value={`${portfolioTotals.sites} / ${portfolioTotals.sites}`} note={`${portfolioTotals.meters} mapped SLD meters`} delta="online" tone="green"/></div>
    <div className="portfolio-overview"><article className="panel exposure"><div className="panel-head"><strong>Exposure</strong><span>portfolio</span></div><div><Check/><span>Sites with active VCOM systems</span><b>23 of 23</b></div><div><AlertTriangle/><span>Sites below 95% guarantee</span><b>1 of 23</b></div><div><Database/><span>Physical meters in SLD</span><b>129</b></div></article>
      <ChartPanel title="Power profile | P0480 Precool" hint="latest complete day"><ResponsiveContainer width="100%" height="100%"><LineChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Line dataKey="solar" name="Metered solar kW" stroke="#ff5a43" strokeWidth={2} dot={false}/><Line dataKey="expected" name="Solcast expectation kW" stroke="#1a6570" strokeDasharray="5 4" strokeWidth={1.5} dot={false}/></LineChart></ResponsiveContainer></ChartPanel>
    </div>
    <section className="all-sites"><div className="section-label"><strong>All Sites ({portfolioSites.length})</strong><span>Terradew Four</span></div><div className="portfolio-sites-grid">{portfolioSites.map(item => <PortfolioCard key={item.code} item={item} navigate={navigate}/>)}</div></section>
  </>;
}

function NodeCard({ node, item, navigate }: { node: PortfolioNode; item: PortfolioSite; navigate: Navigate }) {
  return <button className="meter-card" onClick={() => navigate({kind:"meter",siteCode:item.code,nodeId:node.id})}><div><NodeIcon type={node.type}/><strong>{node.name}</strong></div><span>{node.type}</span><small>Node {node.id}</small><em>{node.meters} meter{node.meters === 1 ? "" : "s"}</em></button>;
}

function SiteView({ item, navigate }: { item: PortfolioSite; navigate: Navigate }) {
  const isPrecool = item.code === "P0480";
  const types = item.nodes.reduce<Record<string,number>>((acc,node) => { acc[node.type] = (acc[node.type] ?? 0) + 1; return acc; },{});
  return <><PageTitle title={item.name} subtitle={`${item.code} | ${item.city} | ${num(item.capacityKwp/1000,2)}MWp | commissioned ${item.commissioned}`}/>
    <div className="kpi-grid site-primary-kpis"><Kpi icon={Database} label="Site capacity" value={num(item.capacityKwp/1000,2)} unit="MWp" note={`${item.nodeCount} SLD nodes`} bars/><Kpi icon={Zap} label="Energy today" value={isPrecool ? num(totals.solarEnergyMwh*1000,1) : num(item.annualYieldKwh/365,1)} unit="kWh" note={isPrecool ? `${site.snapshotDate} metered` : "contract daily yield plan"} tone="green" bars/><Kpi icon={Gauge} label="Performance ratio" value={isPrecool ? num(totals.prEstimate,1) : num(item.guarantee,1)} unit="%" note={isPrecool ? "Solcast GHI estimate" : "contract yield guarantee"} tone="green" bars/><Kpi icon={Activity} label="Data availability" value={isPrecool ? "100.0" : "Active"} unit={isPrecool ? "%" : undefined} note={`VCOM ${item.systemKey}`} delta="online" tone="green" bars/><Kpi icon={Database} label="Mapped meters" value={String(item.meterCount)} note={`${item.nodeCount} hierarchy nodes`} bars/><Kpi icon={Check} label="Contract obligation" value={num(item.guarantee,1)} unit="%" note={item.tariff ? `PPA R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"} bars/></div>
    <div className="kpi-grid savings-kpis"><Kpi icon={SunMedium} label="Self consumed solar" value={isPrecool ? num(totals.solarEnergyMwh,3) : num(item.annualYieldKwh/1000,0)} unit={isPrecool ? "MWh" : "MWh/y"} note={isPrecool ? "electricity_energy_power" : "contracted annual yield"} delta="solar" tone="green"/><Kpi icon={Database} label="Savings from self consumed solar" value={isPrecool ? `R ${num(totals.avoidedCostZar,0)}` : item.tariff ? `R ${num(item.annualYieldKwh * item.tariff,0)} / y` : "—"} note={item.tariff ? `PPA R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"}/><Kpi icon={Network} label="Demand + feed-in savings" value={isPrecool ? `R ${num(totals.gridExportKwh * (item.tariff ?? 0),0)}` : "—"} note={isPrecool ? `${num(totals.gridExportKwh,1)} kWh measured export` : "interval export unavailable"} delta={isPrecool ? "measured" : undefined} tone={isPrecool ? "green" : undefined}/><Kpi icon={Activity} label="Availability" value={isPrecool ? "100.0" : "Active"} unit={isPrecool ? "%" : undefined} note={`VCOM ${item.systemKey}`} delta="online" tone="green"/></div>
    <div className="site-chart-row"><ChartPanel title={isPrecool ? "Site overview | Power Profile (kW)" : "Contract yield profile (MWh)"}>{isPrecool ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Area dataKey="grid" name="Grid supply" stroke="#185c68" fill="#185c6870"/><Area dataKey="solar" name="Solar" stroke="#55a96f" fill="#65ba7580"/></AreaChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={monthPlan(item)} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="plan" name="Monthly yield plan MWh" fill="#dfe6e7"/><Bar dataKey="actual" name="Contract-derived profile MWh" fill="#249b61"/></BarChart></ResponsiveContainer>}</ChartPanel>
      <article className="panel loss-list"><div className="panel-head"><strong>SLD hierarchy</strong><span>{item.nodeCount} nodes</span></div>{Object.entries(types).map(([type,count]) => <div key={type}><span>{type || "Unclassified"}</span><b>{count}</b></div>)}</article></div>
    <section className="all-meters"><div className="section-label"><strong>All Meters ({item.meterCount})</strong><span>select a hierarchy node</span></div><div className="meter-card-grid">{item.nodes.map(node => <NodeCard key={node.id} node={node} item={item} navigate={navigate}/>)}</div></section>
  </>;
}

function MeterView({ item, node, navigate }: { item: PortfolioSite; node: PortfolioNode; navigate: Navigate }) {
  const meterId = item.code === "P0480" ? p0480MeterId(node.id) : undefined;
  const meter = meters.find(value => value.id === meterId);
  const solar = node.type.toLowerCase().includes("solar");
  const key = meterId === "pvdb-1" ? "pvdb1" : meterId === "pvdb-2" ? "pvdb2" : meterId === "solar-total" ? "solar" : meterId?.replace("-","");
  const connected = item.nodes.filter(value => value.parentId === node.id);
  const chartData = meter ? powerSeries : monthPlan(item);
  const branchInverters = meterId === "pvdb-1" ? inverterSummary.slice(0,6) : meterId === "pvdb-2" ? inverterSummary.slice(6,12) : inverterSummary;
  return <><PageTitle title={node.name} subtitle={`${item.name} | ${node.type} | Device node ${node.id}`}/>
    <div className={`kpi-grid ${solar ? "meter-five-kpis" : "meter-four-kpis"}`}>{solar ? <><Kpi icon={Zap} label="Importing now" value={meter ? num(meter.peakKw,1) : num(item.capacityKwp,1)} unit="kW" note={meter ? "peak power on selected day" : "contract capacity"} delta="active" tone="green"/><Kpi icon={Database} label="Imported today" value={item.code === "P0480" ? num(totals.gridImportMwh*1000,1) : "—"} unit={item.code === "P0480" ? "kWh" : undefined} note={item.code === "P0480" ? "site incomer register delta" : "interval import unavailable"}/><Kpi icon={SunMedium} label="Exported today" value={meter ? num(meter.energyMwh*1000,1) : "—"} unit={meter ? "kWh" : undefined} note={meter ? "solar export register delta" : "interval export unavailable"} delta="measured" tone="green"/><Kpi icon={Gauge} label="Max demand" value={meter ? num(meter.peakKw,1) : num(item.capacityKwp,1)} unit="kW" note={meter ? "peak absolute power" : "site DC capacity"} delta="peak" tone="green"/><Kpi icon={Activity} label="Cost today" value={meter && item.tariff ? `R ${num(meter.energyMwh*1000*item.tariff,0)}` : "—"} note={meter && item.tariff ? `energy at R ${num(item.tariff,2)}/kWh` : "PPA rate unavailable"} delta="value" tone="green"/></> : <><Kpi icon={Zap} label="Generating now" value={meter ? num(meter.peakKw,1) : num(item.capacityKwp,1)} unit="kW" note={meter ? "peak power on selected day" : "contract capacity"} delta="active" tone="green"/><Kpi icon={Database} label="Produced today" value={meter ? num(meter.energyMwh*1000,1) : num(item.annualYieldKwh/365,1)} unit="kWh" note={meter ? "meter register delta" : "daily yield plan"}/><Kpi icon={Gauge} label="Performance ratio" value={item.code === "P0480" ? num(totals.prEstimate,1) : num(item.guarantee,1)} unit="%" note="against contract baseline" delta="8.8%" tone="green"/><Kpi icon={Activity} label="Avoided cost" value={meter && item.tariff ? `R ${num(meter.energyMwh*1000*item.tariff,0)}` : item.tariff ? `R ${num(item.tariff,2)}` : "—"} note={meter ? "energy × PPA rate" : "current PPA rate"} delta="value" tone="green"/></>}</div>
    <ChartPanel title={solar ? "Import and export" : "Energy produced"} hint={meter ? `${site.snapshotDate} · 5-minute source aggregated hourly` : "contract-derived monthly plan"}>{meter && solar ? <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Line dataKey={key} name={`${node.name} kW`} stroke="#f0ad42" strokeWidth={2} dot={false}/><Line dataKey="expected" name="Solcast expectation" stroke="#ef705f" strokeDasharray="4 3" dot={false}/><Line dataKey="grid" name="Grid total kW" stroke="#526f76" strokeWidth={1.4} dot={false}/></ComposedChart></ResponsiveContainer> : meter ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="grid" name="Site demand kW" fill="#dfe5e6"/><Bar dataKey={key} name={`${node.name} kW`} fill="#249b61"/></BarChart></ResponsiveContainer> : <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Bar dataKey="plan" fill="#dfe5e6"/><Bar dataKey="actual" fill={solar ? "#249b61" : "#185c68"}/></BarChart></ResponsiveContainer>}</ChartPanel>
    <section className="all-meters"><div className="section-label"><strong>{item.code === "P0480" && solar ? "Inverters" : connected.length ? "Child nodes" : "Related nodes"}</strong><span>{meterId === "pvdb-1" ? "PVDB 1 · Inverters 001–006" : meterId === "pvdb-2" ? "PVDB 2 · Inverters 007–012" : item.name}</span></div>{item.code === "P0480" && solar ? <div className="meter-card-grid">{meterId === "solar-total" && <button className="meter-card" onClick={() => navigate({kind:"inverters",siteCode:"P0480"})}><div><Layers3/><strong>Inverter total</strong></div><span>12 Sungrow units</span><small>{num(totals.inverterEnergyMwh,3)} MWh</small><em>Open</em></button>}{branchInverters.map(inv => <button className="meter-card" key={inv.code} onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><Gauge/><strong>Inverter {inv.code.padStart(3,"0")}</strong></div><span>{Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} · {inv.model}</span><small>{num(inv.energy,1)} kWh</small><em>Active</em></button>)}</div> : <div className="meter-card-grid">{(connected.length ? connected : item.nodes.filter(value => value.id !== node.id).slice(0,6)).map(value => <NodeCard key={value.id} node={value} item={item} navigate={navigate}/>)}</div>}</section>
  </>;
}

function InverterTotalView({ navigate }: { navigate: Navigate }) {
  return <><PageTitle title="Inverter total" subtitle={`PreCool Cold Storage | Solar Total | ${inverterSummary.length} Sungrow SG125CX-P2 inverters`}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC power" value={num(totals.peakAcMw,3)} unit="MW" note="summed peak output" delta="all units" tone="green"/><Kpi icon={Zap} label="Energy today" value={num(totals.inverterEnergyMwh,3)} unit="MWh" note="sum of E_DAY"/><Kpi icon={Database} label="Cumulative energy" value={num(totals.cumulativeEnergyGwh,3)} unit="GWh" note="sum of E_TOTAL"/><Kpi icon={Activity} label="Availability" value="12 / 12" note="3,456 readings" delta="online" tone="green"/></div>
    <ChartPanel title="All inverter power" hint="AC power (kW) · individual units"><ResponsiveContainer width="100%" height="100%"><LineChart data={inverterStack} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/>{inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false}/>)}</LineChart></ResponsiveContainer></ChartPanel>
    <ChartPanel title="All inverter DC power" hint="P_DC power (kW) · individual units"><ResponsiveContainer width="100%" height="100%"><LineChart data={inverterDcSeries} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend wrapperStyle={{fontSize:10}}/>{inverterSummary.map((inv,index) => <Line key={inv.code} dataKey={`i${inv.code}`} name={`Inv ${inv.code}`} stroke={inverterColours[index]} strokeWidth={1.8} dot={false}/>)}</LineChart></ResponsiveContainer></ChartPanel>
    <section className="all-meters"><div className="section-label"><strong>All Inverters ({inverterSummary.length})</strong><span>select a unit to view strings</span></div><div className="inverter-list-grid">{inverterSummary.map((inv,index) => <button key={inv.code} className="inverter-summary-card" onClick={() => navigate({kind:"inverter",siteCode:"P0480",inverterCode:inv.code})}><div><i style={{background:inverterColours[index]}}/><strong>Inverter {inv.code.padStart(3,"0")}</strong><span>Active</span></div><p>{inv.id} | {inv.model}</p><dl><div><dt>AC peak</dt><dd>{num(inv.peakAc,1)} kW</dd></div><div><dt>DC peak</dt><dd>{num(inv.peakDc,1)} kW</dd></div><div><dt>Today</dt><dd>{num(inv.energy,1)} kWh</dd></div></dl></button>)}</div></section></>;
}

function SingleInverterView({ code }: { code: string }) {
  const inv = inverterSummary.find(item => item.code === code) ?? inverterSummary[0];
  const telemetry = inverterStringTelemetry[inv.code] ?? inverterStringTelemetry["01"];
  const stringTotal = telemetry.strings.reduce((sum,value) => sum + value.power,0);
  const ratio = inv.peakDc ? inv.peakAc / inv.peakDc * 100 : 0;
  const dcRatio = inv.peakAc ? inv.peakDc / inv.peakAc : 1;
  const stringRatio = inv.peakAc ? stringTotal / inv.peakAc : 1;
  const inverterSeries = inverterStack.map(row => { const ac = Number((row as unknown as Record<string,string|number>)[`i${inv.code}`]) || 0; return {time:row.time,ac,dc:ac*dcRatio,strings:ac*stringRatio}; });
  const withinCount = telemetry.strings.filter(value => Math.abs(value.deviation) <= 7).length;
  return <><PageTitle title={`Inverter ${inv.code.padStart(3,"0")}`} subtitle={`PreCool Cold Storage | ${Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} | ${inv.id} | ${inv.model}`}/><div className="kpi-grid meter-four-kpis"><Kpi icon={Gauge} label="AC power" value={num(inv.peakAc,1)} unit="kW" note="day peak" delta="active" tone="green" bars/><Kpi icon={Zap} label="Energy today" value={num(inv.energy,1)} unit="kWh" note="E_DAY register" bars/><Kpi icon={Activity} label="Conversion" value={num(ratio,1)} unit="%" note="peak AC ÷ DC" tone="green" bars/><Kpi icon={Database} label="Cumulative energy" value={num(inv.cumulative/1000,1)} unit="MWh" note="E_TOTAL register" bars/></div>
    <div className="inverter-detail-row"><ChartPanel title="Actual against modelled output" hint="AC, DC and string sum"><ResponsiveContainer width="100%" height="100%"><AreaChart data={inverterSeries} margin={chartMargin}><CartesianGrid stroke="#dbe5e6" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Area dataKey="dc" name="DC power" stroke="#f0ab40" fill="#f0ab4025"/><Line dataKey="ac" name="AC power" stroke="#ef654b" strokeWidth={2} dot={false}/><Line dataKey="strings" name="String sum" stroke="#235f69" strokeDasharray="4 3" dot={false}/></AreaChart></ResponsiveContainer></ChartPanel>
      <article className="panel string-status"><div className="string-telemetry-head"><div><strong>String telemetry</strong><span>current, voltage and power · deviation from array median</span></div><code>median {num(telemetry.medianCurrent,1)} A</code></div><div className="string-tile-grid">{telemetry.strings.map(string => { const severity = Math.abs(string.deviation) <= 7 ? "within" : Math.abs(string.deviation) <= 15 ? "warning" : "alarm"; return <div className={`string-tile ${severity}`} key={string.channel}><div className="string-tile-top"><span>S{String(string.channel).padStart(2,"0")}</span><em>{string.deviation >= 0 ? "+" : ""}{num(string.deviation,1)}%</em></div><strong>{num(string.current,1)}<small>A</small></strong><div className="string-electrical"><span>{num(string.voltage,0)}<small>V</small></span><b>{num(string.power,2)}<small>kW</small></b></div></div>; })}</div><div className="string-telemetry-summary"><div className="string-legend"><span><i className="within"/>within 7%</span><span><i className="warning"/>7–15% from median</span><span><i className="alarm"/>over 15% from median</span></div><code>{num(stringTotal,1)} kW across {telemetry.strings.length} strings</code></div><p className="string-note">{withinCount === telemetry.strings.length ? "All strings matched. This inverter is tracking its siblings." : `${withinCount} of ${telemetry.strings.length} strings are within 7% of the array median at the selected peak interval.`}</p><div className="inverter-metadata"><div><span>PLD model ID</span><strong>INVERTER_{inv.code}</strong></div><div><span>Configured DC</span><strong>{num(site.capacityKwp/inverterSummary.length,2)} kWp</strong></div><div><span>MPPT / strings</span><strong>12 / {telemetry.strings.length}</strong></div><div><span>PVDB / source</span><strong>{Number(inv.code) <= 6 ? "PVDB 1" : "PVDB 2"} · VCOM</strong></div></div></article></div>
    <article className="panel event-table"><div><strong>Time</strong><strong>Code</strong><strong>Event</strong><strong>Duration</strong></div><div><span>06:12</span><span>S-00001</span><span>Grid connect - start complete</span><span>—</span></div><div><span>18:52</span><span>S-00001</span><span>Night shutdown</span><span>—</span></div></article></>;
}

export function MockEnergyDashboard() {
  const [view, setView] = useState<View>({kind:"portfolio"});
  const item = selectedSite(view);
  const node = view.kind === "meter" ? item.nodes.find(value => value.id === view.nodeId) ?? item.nodes[0] : undefined;

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({ name:"navigate_energy_asset_view", title:"Open energy asset view", description:"Navigate to the portfolio, a Terradew Four site, a Precool meter, inverter total, or inverter unit.", inputSchema:{type:"object",properties:{view:{type:"string"},site_code:{type:"string"},node_id:{type:"string"}},required:["view"],additionalProperties:false}, annotations:{readOnlyHint:true,untrustedContentHint:false}, execute(input:unknown){ const value=input as {view?:string;site_code?:string;node_id?:string}; if(value.view==="portfolio"){setView({kind:"portfolio"});return {view:"portfolio"};} const candidate=portfolioSites.find(entry=>entry.code===value.site_code)??portfolioSites.find(entry=>entry.code==="P0480")!; if(value.view==="site"){setView({kind:"site",siteCode:candidate.code});return {view:"site",site:candidate.code};} if(value.view==="meter"&&value.node_id){setView({kind:"meter",siteCode:candidate.code,nodeId:value.node_id});return {view:"meter",site:candidate.code,node:value.node_id};} if(value.view==="inverters"){setView({kind:"inverters",siteCode:"P0480"});return {view:"inverters"};} if(value.view==="inverter"){setView({kind:"inverter",siteCode:"P0480",inverterCode:"01"});return {view:"inverter",code:"01"};} throw new Error("Unsupported view"); } },{signal:lifecycle.signal});
    void Promise.resolve(registration).catch(()=>undefined); return () => lifecycle.abort();
  },[]);

  return <SidebarProvider defaultOpen style={{"--sidebar-width":"280px","--sidebar-width-icon":"48px"} as React.CSSProperties}><NavigationSidebar view={view} navigate={setView}/><SidebarInset className="application-main"><Topbar view={view} navigate={setView}/><main className="content-area">
    {view.kind === "portfolio" && <PortfolioView navigate={setView}/>} {view.kind === "site" && <SiteView item={item} navigate={setView}/>} {view.kind === "meter" && node && <MeterView item={item} node={node} navigate={setView}/>} {view.kind === "inverters" && <InverterTotalView navigate={setView}/>} {view.kind === "inverter" && <SingleInverterView code={view.inverterCode}/>} 
  </main></SidebarInset></SidebarProvider>;
}
