"use client";

import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend,
  Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, Bell, Bolt, Building2, CalendarDays, ChevronDown, ChevronRight,
  CircleGauge, Factory, Gauge, Layers3, LayoutDashboard, MapPin, Network,
  Search, Sparkles, SunMedium, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar";
import { inverterStack, inverterSummary, meters, powerSeries, singleInverterSeries, site, stringData, totals } from "@/lib/precool-data";

type View = { kind: "portfolio" | "site" | "meter" | "inverters" | "inverter"; id?: string };
type Navigate = (view: View) => void;

const colours = ["#073f48","#0e6571","#238694","#46a4ad","#7ec0c2","#a3d1c6","#ffc15c","#f6a450","#f18449","#ff6a48","#da5040","#a13d3d"];
const chartMargin = { top: 12, right: 14, left: -12, bottom: 0 };

function fmt(value: number, digits = 1) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function viewKey(view: View) {
  return view.id ? `${view.kind}:${view.id}` : view.kind;
}

function parseViewKey(key: string): View | null {
  if (key === "portfolio") return { kind: "portfolio" };
  if (key === "site") return { kind: "site" };
  if (key === "inverters") return { kind: "inverters" };
  if (key === "inverter-01") return { kind: "inverter", id: "01" };
  if (meters.some(meter => meter.id === key)) return { kind: "meter", id: key };
  return null;
}

function DateRangeSelector() {
  const [range, setRange] = useState<DateRange | undefined>({ from: new Date(2026, 7, 22), to: new Date(2026, 7, 22) });
  const [open, setOpen] = useState(false);
  const label = useMemo(() => !range?.from ? "Select dates" : !range.to || +range.from === +range.to ? format(range.from, "dd MMM yyyy") : `${format(range.from, "dd MMM yyyy")} – ${format(range.to, "dd MMM yyyy")}`, [range]);
  function setPreset(days: number) { const anchor = new Date(2026, 7, 22); const from = days === 1 ? subDays(anchor, 1) : subDays(anchor, days); setRange({ from, to: days === 1 ? from : anchor }); }
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" className="date-trigger" aria-label="Choose reporting date range"><CalendarDays /><span>{label}</span><ChevronDown /></Button></PopoverTrigger>
    <PopoverContent align="end" className="date-popover"><div className="date-layout">
      <Calendar mode="range" numberOfMonths={2} selected={range} onSelect={setRange} defaultMonth={range?.from} />
      <div className="date-presets"><span>QUICK RANGE</span>{[["Snapshot day",0],["Previous day",1],["Last 7 days",6],["Last 30 days",29]].map(([label,days]) => <Button key={label} variant="outline" size="sm" onClick={() => setPreset(Number(days))}>{label}</Button>)}<Button size="sm" onClick={() => setOpen(false)}>Apply range</Button></div>
    </div><p className="range-note">This prototype contains the latest complete aligned Doris snapshot: {site.snapshotDate}.</p></PopoverContent>
  </Popover>;
}

function Kpi({ icon: Icon, label, value, unit, note, tone = "default" }: { icon: typeof Activity; label: string; value: string; unit?: string; note: string; tone?: "default" | "good" | "warn" }) {
  return <article className={`metric-card tone-${tone}`}><div className="metric-label"><Icon />{label}</div><div className="metric-value">{value}<small>{unit}</small></div><div className="metric-foot"><span>{note}</span></div></article>;
}

function PageHeading({ eyebrow, title, subtitle, badge }: { eyebrow: string; title: string; subtitle: string; badge?: string }) {
  return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{badge && <span className="data-badge"><i />{badge}</span>}<button className="dashboard-button" type="button">View dashboard</button></div></section>;
}

function ChartCard({ kicker, title, legend, children, className = "" }: { kicker: string; title: string; legend?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <article className={`chart-card ${className}`}><div className="card-heading"><div><span>{kicker}</span><strong>{title}</strong></div>{legend}</div><div className="chart-wrap">{children}</div></article>;
}

function AppSidebar({ view, navigate }: { view: View; navigate: Navigate }) {
  const active = viewKey(view);
  return <Sidebar collapsible="icon" className="app-sidebar">
    <SidebarHeader className="sidebar-head"><button className="brand-mark" onClick={() => navigate({kind:"portfolio"})} aria-label="Terradew portfolio"><span className="brand-sun"><i /><i /><i /></span><strong>Terradew</strong></button></SidebarHeader>
    <SidebarContent>
      <SidebarGroup><SidebarGroupContent><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton isActive={active === "portfolio"} tooltip="Portfolio" onClick={() => navigate({kind:"portfolio"})}><LayoutDashboard /><span>Portfolio</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton isActive={active === "site"} tooltip="Precool site" onClick={() => navigate({kind:"site"})}><Building2 /><span>Precool site</span></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton tooltip="Electrical hierarchy"><Network /><span>Electrical hierarchy</span></SidebarMenuButton></SidebarMenuItem>
      </SidebarMenu></SidebarGroupContent></SidebarGroup>
      <SidebarGroup className="asset-group"><div className="sidebar-section-label">P0480 · PRECOOL</div><SidebarGroupContent>
        <button className={`asset-row ${active === "site" ? "active" : ""}`} onClick={() => navigate({kind:"site"})}><Factory /><span>PreCool Cold Storage</span><em>site 4</em></button>
        <div className="tree-label"><SunMedium />SOLAR</div>
        <button className={`asset-row nested ${active === "meter:solar-total" ? "active" : ""}`} onClick={() => navigate({kind:"meter",id:"solar-total"})}><CircleGauge /><span>Solar Total</span></button>
        <button className={`asset-row deep ${active === "meter:pvdb-1" ? "active" : ""}`} onClick={() => navigate({kind:"meter",id:"pvdb-1"})}><Bolt /><span>PVDB 1</span></button>
        <button className={`asset-row deep ${active === "meter:pvdb-2" ? "active" : ""}`} onClick={() => navigate({kind:"meter",id:"pvdb-2"})}><Bolt /><span>PVDB 2</span></button>
        <button className={`asset-row deep total ${active === "inverters" ? "active" : ""}`} onClick={() => navigate({kind:"inverters"})}><Layers3 /><span>Inverter total</span><em>12</em></button>
        <button className={`asset-row deepest ${active === "inverter:01" ? "active" : ""}`} onClick={() => navigate({kind:"inverter",id:"01"})}><Gauge /><span>Inverter 01</span></button>
        <div className="tree-muted">11 more in total view</div>
        <div className="tree-label"><Zap />GRID</div>
        {meters.filter(meter => meter.type === "grid").map(meter => <button key={meter.id} className={`asset-row nested ${active === `meter:${meter.id}` ? "active" : ""}`} onClick={() => navigate({kind:"meter",id:meter.id})}><CircleGauge /><span>{meter.name}</span></button>)}
      </SidebarGroupContent></SidebarGroup>
    </SidebarContent>
    <SidebarFooter><div className="source-pill"><span /><strong>Doris snapshot</strong></div></SidebarFooter><SidebarRail />
  </Sidebar>;
}

function MeterCard({ meter, navigate }: { meter: (typeof meters)[number]; navigate: Navigate }) {
  return <button className="asset-card" onClick={() => navigate({kind:"meter",id:meter.id})}><div className={`asset-card-icon ${meter.type}`}><CircleGauge /></div><div><strong>{meter.name}</strong><span>{meter.serial}</span><small>{meter.description}</small></div><dl><div><dt>{meter.type === "solar" ? "Generated" : "Imported"}</dt><dd>{fmt(meter.energyMwh,3)} MWh</dd></div><div><dt>Peak</dt><dd>{fmt(meter.peakKw,1)} kW</dd></div></dl><ChevronRight /></button>;
}

function PortfolioView({ navigate }: { navigate: Navigate }) {
  return <>
    <PageHeading eyebrow="PORTFOLIO PERFORMANCE" title="Terradew Four" subtitle="1 operating site · 5 physical meters · 12 inverters" badge={`Doris · ${site.snapshotDate}`} />
    <section className="metric-grid"><Kpi icon={SunMedium} label="Solar generated" value={fmt(totals.solarEnergyMwh,3)} unit="MWh" note="Solar Total · electricity_energy_power" tone="good" /><Kpi icon={Zap} label="Estimated site load" value={fmt(totals.estimatedLoadMwh,3)} unit="MWh" note="Grid import + solar generation" /><Kpi icon={Sparkles} label="Avoided PPA energy cost" value={`R ${fmt(totals.avoidedCostZar,0)}`} note={`At contract rate R ${site.tariff.toFixed(2)}/kWh`} tone="good" /><Kpi icon={Activity} label="Data availability" value="100.0" unit="%" note="Latest complete aligned day" tone="good" /></section>
    <section className="portfolio-grid">
      <ChartCard kicker="PORTFOLIO PRODUCTION" title="Metered solar vs irradiance-derived expectation" legend={<div className="legend"><i className="actual" />Metered <i className="expected" />Expected</div>}><ResponsiveContainer width="100%" height="100%"><AreaChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Area type="monotone" dataKey="solar" name="Metered solar" stroke="#ff5c3a" strokeWidth={2.5} fill="#ff5c3a22"/><Line type="monotone" dataKey="expected" name="Solcast-derived expectation" stroke="#0e6571" strokeDasharray="6 5" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></ChartCard>
      <article className="exposure-card"><div className="card-heading"><div><span>DATA SOURCES</span><strong>Operational coverage</strong></div></div><div className="exposure-row"><span className="status-dot ok"/><div><strong>Electricity meters</strong><small>5 serials · 1,440 readings</small></div><b>100%</b></div><div className="exposure-row"><span className="status-dot ok"/><div><strong>VCOM inverters</strong><small>12 units · 3,456 readings</small></div><b>100%</b></div><div className="exposure-row"><span className="status-dot ok"/><div><strong>Solcast</strong><small>48 half-hour GHI records</small></div><b>100%</b></div><div className="exposure-row"><span className="status-dot neutral"/><div><strong>VCOM sensor</strong><small>No sensor mapped to system 5ID4A</small></div><b>—</b></div></article>
    </section>
    <section className="sites-section"><div className="section-heading"><div><p className="eyebrow">OPERATING SITE</p><h2>Terradew Four portfolio</h2></div><span>1 of 1 active</span></div><button className="site-card" onClick={() => navigate({kind:"site"})}><div className="site-icon"><Building2/></div><div className="site-details"><strong>{site.name}</strong><span>{site.projectCode} · {site.location}</span><small>{site.capacityKwp.toLocaleString("en-ZA")} kWp · commissioned {site.commissionDate}</small></div><div className="site-stat"><span>Generated</span><strong>{fmt(totals.solarEnergyMwh,3)} MWh</strong></div><div className="site-stat"><span>Estimated PR</span><strong>{fmt(totals.prEstimate)}%</strong></div><div className="site-status"><i/>Active</div></button></section>
  </>;
}

function SiteView({ navigate }: { navigate: Navigate }) {
  return <>
    <PageHeading eyebrow={`${site.projectCode} · SITE 4`} title={site.name} subtitle={`${site.location} · commissioned ${site.commissionDate}`} badge={`System ${site.systemKey}`} />
    <section className="metric-grid"><Kpi icon={SunMedium} label="Installed capacity" value={fmt(site.capacityKwp/1000,3)} unit="MWp" note={`${site.areaM2.toLocaleString("en-ZA")} m² site area`} /><Kpi icon={Bolt} label="Energy generated" value={fmt(totals.solarEnergyMwh,3)} unit="MWh" note="2 solar meters · 22 Aug" tone="good" /><Kpi icon={Factory} label="Estimated site load" value={fmt(totals.estimatedLoadMwh,3)} unit="MWh" note="Reconciled from SLD roles" /><Kpi icon={Activity} label="Performance ratio" value={fmt(totals.prEstimate)} unit="%" note={`Solcast GHI · ${fmt(totals.solcastPeakGhi)} W/m² peak`} /></section>
    <section className="wide-grid"><ChartCard kicker="SITE OVERVIEW" title="Power flow across the Precool site" legend={<div className="legend"><i className="solar"/>Solar <i className="grid"/>Grid</div>}><ResponsiveContainer width="100%" height="100%"><AreaChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Area type="monotone" dataKey="grid" name="Grid supply" stackId="flow" stroke="#0e6571" fill="#0e657144"/><Area type="monotone" dataKey="solar" name="Solar generation" stackId="flow" stroke="#ff6a48" fill="#ff6a4866"/></AreaChart></ResponsiveContainer></ChartCard><article className="site-facts"><div className="card-heading"><div><span>SITE RECORD</span><strong>Doris asset context</strong></div></div><dl><div><dt><MapPin/>Address</dt><dd>{site.address}</dd></div><div><dt><Network/>SLD</dt><dd>Pre-Cool Solar · 9 visible nodes</dd></div><div><dt><Gauge/>Assets</dt><dd>5 meters · 12 inverters</dd></div><div><dt><Zap/>Contract</dt><dd>Contract {site.contractId} · phase 1</dd></div></dl></article></section>
    <section className="asset-section"><div className="section-heading"><div><p className="eyebrow">METERING</p><h2>SLD meter nodes</h2></div><span>Node view follows meter type</span></div><div className="asset-card-grid">{meters.map(meter => <MeterCard key={meter.id} meter={meter} navigate={navigate}/>)}</div></section>
  </>;
}

function MeterView({ meterId, navigate }: { meterId: string; navigate: Navigate }) {
  const meter = meters.find(item => item.id === meterId) ?? meters[0];
  const isSolar = meter.type === "solar";
  const key: keyof (typeof powerSeries)[number] =
    meter.id === "solar-total"
      ? "solar"
      : meter.id === "pvdb-1"
        ? "pvdb1"
        : meter.id === "pvdb-2"
          ? "pvdb2"
          : (meter.id.replace("-", "") as keyof (typeof powerSeries)[number]);
  const meterExport = meter.id === "incomer-1" ? 3.375 : 0;
  const scale = meter.id === "solar-total" ? 1 : meter.energyMwh / totals.solarEnergyMwh;
  return <>
    <PageHeading eyebrow={`${isSolar ? "SOLAR" : "GRID"} METER`} title={meter.name} subtitle={`${meter.description} · ${meter.serial}`} badge="288 / 288 readings" />
    <section className="metric-grid">{isSolar ? <><Kpi icon={SunMedium} label="Energy produced" value={fmt(meter.energyMwh,3)} unit="MWh" note="Export register delta" tone="good"/><Kpi icon={Bolt} label="Peak active power" value={fmt(meter.peakKw,1)} unit="kW" note="electricity_energy_power.ptot"/><Kpi icon={Activity} label="Estimated PR" value={fmt(totals.prEstimate)} unit="%" note="Solcast GHI reference"/><Kpi icon={Sparkles} label="Avoided PPA cost" value={`R ${fmt(totals.avoidedCostZar*scale,0)}`} note={`Contract rate R ${site.tariff.toFixed(2)}/kWh`} tone="good"/></> : <><Kpi icon={Zap} label="Imported energy" value={fmt(meter.energyMwh,3)} unit="MWh" note="Import register delta"/><Kpi icon={Gauge} label="Maximum demand" value={fmt(meter.peakKw,1)} unit="kW" note="Peak absolute ptot"/><Kpi icon={Bolt} label="Exported energy" value={fmt(meterExport,3)} unit="kWh" note={meterExport ? "Grid export register delta" : "No export movement"}/><Kpi icon={Activity} label="Data completeness" value="100.0" unit="%" note="Five-minute interval coverage" tone="good"/></>}</section>
    <section className="meter-chart-grid"><ChartCard kicker="POWER PROFILE" title={isSolar ? "Solar production, inverter output and Solcast GHI" : `${meter.name} active power against total grid supply`} legend={<div className="legend"><i className={isSolar ? "solar" : "grid"}/>{meter.name}</div>}><ResponsiveContainer width="100%" height="100%">{isSolar ? <ComposedChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis yAxisId="power" axisLine={false} tickLine={false} unit=" kW"/><YAxis yAxisId="ghi" orientation="right" axisLine={false} tickLine={false} unit=" W/m²"/><Tooltip/><Bar yAxisId="ghi" dataKey="ghi" name="Solcast GHI" fill="#f5be5e55"/><Line yAxisId="power" type="monotone" dataKey={key} name={meter.name} stroke="#ff5c3a" strokeWidth={2.5} dot={false}/>{meter.id === "solar-total" && <Line yAxisId="power" type="monotone" dataKey="inverter" name="VCOM inverter total" stroke="#0e6571" strokeWidth={2} dot={false}/>}</ComposedChart> : <AreaChart data={powerSeries} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Area type="monotone" dataKey={key} name={meter.name} stroke="#0e6571" fill="#0e657144" strokeWidth={2}/><Line type="monotone" dataKey="grid" name="All incomers" stroke="#ff6a48" strokeWidth={2} dot={false}/></AreaChart>}</ResponsiveContainer></ChartCard><article className="source-card"><div className="card-heading"><div><span>SOURCE TRACE</span><strong>What this view uses</strong></div></div><dl><div><dt>SLD node</dt><dd>{meter.id === "solar-total" ? "1140723" : meter.id === "pvdb-1" ? "1140730" : meter.id === "pvdb-2" ? "1140721" : meter.id === "incomer-1" ? "1140724" : meter.id === "incomer-2" ? "1140728" : "1140729"}</dd></div><div><dt>Reading table</dt><dd>electricity_energy_power</dd></div><div><dt>Time resolution</dt><dd>5 minutes</dd></div><div><dt>Data date</dt><dd>{site.snapshotDate}</dd></div></dl></article></section>
    <section className="asset-section"><div className="section-heading"><div><p className="eyebrow">CONNECTED ASSETS</p><h2>{isSolar ? "Solar branches" : "Grid incomers"}</h2></div></div>{isSolar ? <div className="asset-card-grid">{meters.filter(item => item.id === "pvdb-1" || item.id === "pvdb-2").map(item => <MeterCard key={item.id} meter={item} navigate={navigate}/>) }<button className="asset-card inverter-total-card" onClick={() => navigate({kind:"inverters"})}><div className="asset-card-icon inverter"><Layers3/></div><div><strong>Inverter total</strong><span>12 Sungrow SG125CX-P2</span><small>VCOM telemetry</small></div><dl><div><dt>Energy</dt><dd>{fmt(totals.inverterEnergyMwh,3)} MWh</dd></div><div><dt>Peak</dt><dd>{fmt(totals.peakAcMw,3)} MW</dd></div></dl><ChevronRight/></button></div> : <div className="asset-card-grid">{meters.filter(item => item.type === "grid").map(item => <MeterCard key={item.id} meter={item} navigate={navigate}/>)}</div>}</section>
  </>;
}

function InverterTotalView({ navigate, query }: { navigate: Navigate; query: string }) {
  const filtered = inverterSummary.filter(item => !query || `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeading eyebrow="SOLAR METER · INVERTER TOTAL" title="All inverters" subtitle="12 VCOM inverters · Sungrow SG125CX-P2" badge="3,456 / 3,456 readings" />
    <section className="metric-grid"><Kpi icon={Gauge} label="Peak AC power" value={fmt(totals.peakAcMw,3)} unit="MW" note="Summed hourly output" tone="good"/><Kpi icon={Bolt} label="Energy produced" value={fmt(totals.inverterEnergyMwh,3)} unit="MWh" note="Sum of inverter E_DAY"/><Kpi icon={Sparkles} label="Cumulative energy" value={fmt(totals.cumulativeEnergyGwh,3)} unit="GWh" note="Sum of E_TOTAL registers"/><Kpi icon={Activity} label="Reporting inverters" value="12 / 12" note="Complete aligned day" tone="good"/></section>
    <ChartCard kicker="STACKED AC POWER" title="Contribution from every inverter"><ResponsiveContainer width="100%" height="100%"><AreaChart data={inverterStack} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Legend wrapperStyle={{fontSize:11}}/>{inverterSummary.map((item,index) => <Area key={item.code} type="monotone" dataKey={`i${item.code}`} name={`Inv ${item.code}`} stackId="1" stroke={colours[index]} fill={colours[index]} fillOpacity={.84}/>)}</AreaChart></ResponsiveContainer></ChartCard>
    <section className="asset-section"><div className="section-heading"><div><p className="eyebrow">INVERTER FLEET</p><h2>Unit performance</h2></div><span>{filtered.length} shown</span></div><div className="inverter-grid">{filtered.map((item,index) => <button className={`inverter-card ${item.code === "01" ? "clickable" : ""}`} key={item.id} onClick={() => item.code === "01" && navigate({kind:"inverter",id:"01"})}><div className="inverter-card-head"><span style={{background:colours[index]}}/><strong>{item.name}</strong><em>{item.code === "01" ? "Open strings" : "Summary"}</em></div><small>{item.id} · {item.model}</small><dl><div><dt>Daily</dt><dd>{fmt(item.energy,1)} kWh</dd></div><div><dt>Peak AC</dt><dd>{fmt(item.peakAc,1)} kW</dd></div><div><dt>Cumulative</dt><dd>{fmt(item.cumulative/1000,1)} MWh</dd></div></dl></button>)}</div></section>
  </>;
}

function SingleInverterView() {
  const inverter = inverterSummary[0];
  const stringSum = stringData.reduce((sum,item) => sum + item.power,0);
  return <>
    <PageHeading eyebrow="SOLAR METER · SINGLE INVERTER" title="Inverter 01" subtitle={`${inverter.id} · ${inverter.model}`} badge="288 / 288 readings" />
    <section className="metric-grid"><Kpi icon={Gauge} label="Peak AC power" value={fmt(inverter.peakAc,3)} unit="kW" note="09:45 UTC · P_AC" tone="good"/><Kpi icon={Bolt} label="Peak DC power" value={fmt(inverter.peakDc,3)} unit="kW" note="P_DC at peak day"/><Kpi icon={SunMedium} label="Energy produced" value={fmt(inverter.energy,3)} unit="kWh" note="Maximum E_DAY register"/><Kpi icon={Sparkles} label="Cumulative energy" value={fmt(inverter.cumulative/1000,3)} unit="MWh" note="E_TOTAL register"/></section>
    <section className="single-grid"><ChartCard kicker="POWER CONVERSION" title="AC, DC and measured string-channel sum"><ResponsiveContainer width="100%" height="100%"><AreaChart data={singleInverterSeries} margin={chartMargin}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="time" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Area type="monotone" dataKey="dc" name="DC power" stroke="#f3ac3c" fill="#f3ac3c22" strokeWidth={2}/><Line type="monotone" dataKey="ac" name="AC power" stroke="#ff5c3a" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="strings" name="String channel sum" stroke="#0e6571" strokeDasharray="5 4" strokeWidth={2} dot={false}/></AreaChart></ResponsiveContainer></ChartCard><article className="conversion-card"><span>PEAK CONVERSION</span><strong>{fmt(inverter.peakAc/inverter.peakDc*100,1)}%</strong><p>AC output ÷ DC input at the day’s peak.</p><dl><div><dt>Peak timestamp</dt><dd>22 Aug · 09:45 UTC</dd></div><div><dt>String channel sum</dt><dd>{fmt(stringSum,3)} kW</dd></div><div><dt>Tracked channels</dt><dd>9</dd></div></dl></article></section>
    <section className="strings-card"><div className="card-heading"><div><span>DC STRING CHANNELS</span><strong>Power at inverter peak</strong></div><div className="legend">I_DC × U_DC</div></div><div className="string-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={stringData} margin={{top:8,right:8,left:-20,bottom:0}}><CartesianGrid stroke="#dce6e7" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} unit=" kW"/><Tooltip/><Bar dataKey="power" name="String power" radius={[5,5,0,0]}>{stringData.map((_,index) => <Cell key={index} fill={index < 2 ? "#ff6a48" : "#0e6571"}/>)}</Bar></BarChart></ResponsiveContainer></div><div className="string-summary"><span><i className="status-dot ok"/>9 channels reporting</span><span>Highest: String 2 · 14.027 kW</span><span>Sum: {fmt(stringSum,3)} kW</span></div></section>
    <section className="events-card"><div><strong>Data-quality review</strong><span>No interval gaps on {site.snapshotDate}; no VCOM sensor is mapped to this system.</span></div><div className="event-status"><i/>Complete day</div></section>
  </>;
}

function breadcrumbFor(view: View) {
  if (view.kind === "portfolio") return ["Portfolio", site.provider];
  if (view.kind === "site") return [site.provider, site.name];
  if (view.kind === "inverters") return [site.name, "Inverter total"];
  if (view.kind === "inverter") return ["Inverter total", "Inverter 01"];
  return [site.name, meters.find(item => item.id === view.id)?.name ?? "Meter"];
}

export function EnergyDashboard() {
  const [view, setView] = useState<View>({kind:"portfolio"});
  const [query, setQuery] = useState("");
  const crumbs = breadcrumbFor(view);

  useEffect(() => {
    const context = (document as Document & {modelContext?: {registerTool: (tool: unknown, options?: {signal?: AbortSignal}) => void | Promise<void>}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const registration = context.registerTool({
      name: "navigate_energy_asset_view",
      title: "Open energy asset view",
      description: "Navigate the visible Precool energy operations dashboard to a portfolio, site, meter, inverter-total, or Inverter 01 view.",
      inputSchema: {type:"object",properties:{view:{type:"string",enum:["portfolio","site","solar-total","pvdb-1","pvdb-2","incomer-1","incomer-2","incomer-3","inverters","inverter-01"]}},required:["view"],additionalProperties:false},
      annotations: {readOnlyHint:true,untrustedContentHint:false},
      execute(input: unknown) { const key = (input as {view?:unknown})?.view; if (typeof key !== "string") throw new Error("view must be a supported string"); const next = parseViewKey(key); if (!next) throw new Error(`Unsupported view: ${key}`); setView(next); return {view:key,title:breadcrumbFor(next)[1]}; },
    }, {signal:lifecycle.signal});
    void Promise.resolve(registration).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return <SidebarProvider defaultOpen style={{"--sidebar-width":"18rem","--sidebar-width-icon":"4.35rem"} as React.CSSProperties}>
    <AppSidebar view={view} navigate={setView}/><SidebarInset><header className="topbar"><div className="topbar-left"><SidebarTrigger/><div className="breadcrumb"><button onClick={() => setView({kind:"portfolio"})}>{crumbs[0]}</button><strong>{crumbs[1]}</strong></div></div><label className="searchbox"><Search/><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search assets" placeholder="Search meter or inverter"/></label><div className="topbar-actions"><DateRangeSelector/><button className="icon-button" aria-label="Notifications"><Bell/></button></div></header><main className="dashboard-shell">
      {view.kind === "portfolio" && <PortfolioView navigate={setView}/>} {view.kind === "site" && <SiteView navigate={setView}/>} {view.kind === "meter" && <MeterView meterId={view.id ?? "solar-total"} navigate={setView}/>} {view.kind === "inverters" && <InverterTotalView navigate={setView} query={query}/>} {view.kind === "inverter" && <SingleInverterView/>}
    </main></SidebarInset>
  </SidebarProvider>;
}
