"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, Database, SunMedium } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { isLoadNode, contractSiteLabel, type PortfolioSite } from "@/lib/portfolio-data";
import { periodResolutionLabel, periodUsesBars, type PeriodGranularity } from "@/lib/period-resolution";

type Point = {time:string; [key:string]:string|number|null};
type Performance = {
  contractId:string;
  range:{from:string;to:string;fromTime:string;toTime:string;timeZone:string;durationMinutes:number;granularity:PeriodGranularity};
  series:Point[];
  summary:{
    predictedKwh:number|null;actualKwh:number|null;guaranteedKwh:number|null;
    attainmentPercent:number|null;varianceKwh:number|null;actualCoverage:number;predictionCoverage:number;
    comparisonCoverage:number;predictedPr:number|null;actualPr:number|null;
    weatherEffectKwh:number|null;otherEffectKwh:number|null;lastActualAt:string|null;
  };
  provenance:{prediction:string;predictionResolution:string;pvsolReferenceYear:number|null;
    modelReferenceYear:number|null;irradiance:string;actual:string;meterSerials:string[];prBasis:string;degradation:string;explanation:string};
  messages:string[];
};
type Series = {key:string;name:string;color:string;dash?:boolean};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const fmt = (value:number|null|undefined,digits=1) => value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-ZA",{maximumFractionDigits:digits}).format(value);
const stamp = (value:string, withTime=false) => new Intl.DateTimeFormat("en-ZA", {timeZone:"Africa/Johannesburg",day:"2-digit",month:"short",year:"numeric",...(withTime?{hour:"2-digit",minute:"2-digit"}:{})}).format(new Date(value.length===10?value+"T00:00:00+02:00":value));

function axisLabel(value:string) {
  if (value.length===4) return value;
  if (value.length===7) return new Intl.DateTimeFormat("en-ZA",{month:"short",year:"2-digit",timeZone:"Africa/Johannesburg"}).format(new Date(value+"-01T00:00:00+02:00"));
  return new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",day:"2-digit",month:"short",...(value.length>10?{hour:"2-digit",minute:"2-digit"}:{})}).format(new Date(value.length===10?value+"T00:00:00+02:00":value));
}

function ComparisonChart({title,note,data,series,bars,unit,ratio=false}:{
  title:string;note:string;data:Point[];series:Series[];bars:boolean;unit:string;ratio?:boolean;
}) {
  const [hidden,setHidden] = useState<Set<string>>(()=>new Set());
  const available = data.some(row=>series.some(s=>typeof row[s.key]==="number"));
  return <article className="panel contract-chart">
    <div className="contract-panel-head"><div><h2>{title}</h2><p>{note}</p></div><span>{unit}</span></div>
    <div className="contract-plot">{available ? <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{top:12,right:12,left:4,bottom:0}}>
        <CartesianGrid vertical={false} stroke="#e0e8e9"/>
        <XAxis dataKey="time" tickFormatter={axisLabel} axisLine={false} tickLine={false} minTickGap={50} tick={{fontSize:11,fill:"#6b8589"}}/>
        <YAxis width={56} axisLine={false} tickLine={false} tick={{fontSize:11,fill:"#6b8589"}} tickFormatter={n=>fmt(n,0)}/>
        <Tooltip labelFormatter={value=>axisLabel(String(value))} formatter={(value,name)=>[fmt(typeof value==="number"?value:null,2)+" "+unit,name]} contentStyle={{border:"1px solid #cad8da",borderRadius:5,fontSize:12}}/>
        {series.map(s=>bars?
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} maxBarSize={32} radius={[2,2,0,0]} hide={hidden.has(s.key)} isAnimationActive={false}/>:
          s.dash || ratio ? <Line key={s.key} type="stepAfter" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} strokeDasharray={s.dash?"5 4":undefined} dot={false} connectNulls={false} hide={hidden.has(s.key)} isAnimationActive={false}/>:
          <Area key={s.key} type="stepAfter" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} fill={s.color} fillOpacity={.13} dot={false} connectNulls={false} hide={hidden.has(s.key)} isAnimationActive={false}/>
        )}
      </ComposedChart>
    </ResponsiveContainer>:<div className="contract-chart-empty"><Database/><span>No comparable data for this selection</span></div>}</div>
    <div className="contract-legend" aria-label={title+" series"}>{series.map(s=><button key={s.key} aria-pressed={!hidden.has(s.key)} onClick={()=>setHidden(previous=>{const next=new Set(previous);if(next.has(s.key))next.delete(s.key);else next.add(s.key);return next;})}><i style={{background:s.color}}/>{s.name}</button>)}</div>
  </article>;
}

export function SiteContractPerformance({site,from,to,fromTime,toTime,onOpenNode}:{
  site:PortfolioSite;from:string;to:string;fromTime:string;toTime:string;onOpenNode:(key:string)=>void;
}) {
  const [retry,setRetry]=useState(0);
  const key=[site.contractId,from,to,fromTime,toTime,retry].join(":");
  const [state,setState]=useState<{key:string;data?:Performance;error?:string}|null>(null);
  useEffect(()=>{
    if(!site.contractId)return;
    const abort=new AbortController();
    const params=new URLSearchParams({contract_id:site.contractId,from,to,from_time:fromTime,to_time:toTime});
    void fetch(basePath+"/api/site/performance?"+params,{cache:"no-store",signal:abort.signal}).then(async response=>{
      const data=await response.json() as Performance & {error?:string};
      if(!response.ok)throw new Error(data.error??"Unable to load contract performance");
      if(data.contractId!==site.contractId || !Array.isArray(data.series))throw new Error("Invalid contract performance response");
      setState({key,data});
    }).catch(error=>{if(!abort.signal.aborted)setState({key,error:error instanceof Error?error.message:"Unable to load contract performance"});});
    return()=>abort.abort();
  },[key,site.contractId,from,to,fromTime,toTime]);
  const data=state?.key===key?state.data:undefined;
  const error=state?.key===key?state.error:undefined;
  const s=data?.summary;
  const bars=data?periodUsesBars(data.range.granularity):false;
  const resolution=data?periodResolutionLabel(data.range.granularity):"";
  const selectedPeriod=stamp(from)+(from===to?"":" – "+stamp(to))+` · ${fromTime}–${toTime} SAST`;
  const nodes=site.nodes.filter(n=>["site-total","solar-total","municipal-total","load-total"].includes(n.navigationKey??""));
  const operationalNodes=[...new Map(site.nodes.filter(n=>n.isPhysical || isLoadNode(n)).map(n=>[n.id,n])).values()];
  return <section className="contract-performance">
    <div className="contract-page-title"><div><span className="contract-eyebrow">Contract performance</span><h1>{site.name}</h1><p>{contractSiteLabel(site)} · {site.contractType?.toUpperCase()??"Solar"} · Contract {site.contractId}</p></div><div className="contract-period"><CalendarDays size={15}/><span>{selectedPeriod}</span></div></div>
    {!data?<div className="live-data-state" role="status"><Database/><strong>{error??"Loading contract predictions and actual performance"}</strong><span>{error?"Please retry the selected period.":"PVModel · PVSOL · solar meters · Solcast"}</span>{error&&<button onClick={()=>setRetry(n=>n+1)}>Retry</button>}</div>:<>
      <div className="contract-kpis">
        <article><span><SunMedium/>Predicted energy</span><strong>{fmt(s!.predictedKwh)}<small> kWh</small></strong><p>Contract model · degradation applied</p></article>
        <article><span><Activity/>Actual energy</span><strong>{fmt(s!.actualKwh)}<small> kWh</small></strong><p>Solar meters · {fmt(s!.actualCoverage)}% coverage</p></article>
        <article><span><SunMedium/>Model attainment</span><strong className={s!.attainmentPercent==null?"":s!.attainmentPercent>=100?"positive":"negative"}>{fmt(s!.attainmentPercent)}<small> %</small></strong><p>Matched intervals · {fmt(s!.comparisonCoverage)}% of selection</p></article>
        <article><span>{(s!.varianceKwh??0)>=0?<ArrowUpRight/>:<ArrowDownRight/>}Energy variance</span><strong className={s!.varianceKwh==null?"":s!.varianceKwh>=0?"positive":"negative"}>{s!.varianceKwh!=null&&s!.varianceKwh>0?"+":""}{fmt(s!.varianceKwh)}<small> kWh</small></strong><p>Actual less predicted · matched intervals</p></article>
      </div>
      <div className="contract-readout"><div><strong>{s!.attainmentPercent==null?"A comparison is not available for this selection.":s!.attainmentPercent>=100?`Production is ${fmt(s!.attainmentPercent-100)}% above the contract model.`:`Production is ${fmt(100-s!.attainmentPercent)}% below the contract model.`}</strong><p>{s!.comparisonCoverage<99.9?"This result covers the intervals with both meter readings and predictions.":"This result covers the complete selected period."} Weather and PR comparisons below add context.</p></div><span className={s!.predictionCoverage>=99.9&&s!.actualCoverage>=99.9?"":"partial"}>{s!.predictionCoverage>=99.9&&s!.actualCoverage>=99.9?"Complete comparison":"Partial comparison"}</span></div>
      <ComparisonChart title="Contract prediction versus actual energy" note={resolution+" intervals · model source is hourly"} data={data.series} bars={bars} unit="kWh" series={[
        {key:"predicted",name:"Contract prediction",color:"#124e5a"},
        {key:"actual",name:"Actual solar energy",color:"#f56549"},
        {key:"guarantee",name:"Yield guarantee",color:"#9aaeb0",dash:true},
      ]}/>
      <div className="contract-comparison-grid">
        <ComparisonChart title="Irradiation versus expectation" note="PVSOL horizontal irradiation · Solcast satellite estimate" data={data.series} bars={bars} unit="kWh/m²" series={[
          {key:"predictedGhi",name:"PVSOL predicted",color:"#124e5a"},{key:"actualGhi",name:"Actual (satellite)",color:"#49a76a"},
        ]}/>
        <ComparisonChart title="Predicted versus actual PR" note="GHI-based ratio · matched daytime intervals" data={data.series} bars={bars} ratio unit="%" series={[
          {key:"predictedPr",name:"Predicted PR",color:"#90aeb5"},{key:"actualPr",name:"Actual PR",color:"#ee8b76"},
        ]}/>
      </div>
      <details className="contract-detail"><summary><span>Understand the gains and losses</span><small>Irradiance effect and the remaining gap</small></summary>
        <ComparisonChart title="Gains and losses against the model" note="Shared daytime intervals only · remaining gap is unattributed" data={data.series} bars={bars} ratio unit="kWh" series={[
          {key:"weatherEffect",name:"Irradiance effect",color:"#428ca7"},{key:"otherEffect",name:"Remaining gap",color:"#df836b"},
        ]}/>
        <p className="contract-method">{data.provenance.explanation} This view does not calculate liquidated damages.</p>
      </details>
      <details className="contract-detail"><summary><span>Contract and data details</span><small>{data.messages.length?data.messages.length+" data notes":"Prediction basis, guarantees and coverage"}</small></summary>
        <div className="contract-facts">{[
          ["Contract capacity",fmt(site.capacityKwp)+" kWp"],["COCO",site.cocoDate?stamp(site.cocoDate):"Not recorded"],
          ["Degradation",fmt(site.degradationPercent,3)+"% per year"],["Yield guarantee",fmt(site.guarantee)+"%"],
          ["Guaranteed PR",fmt(site.guaranteedPrPercent,3)+"%"],["Contract simulated PR",fmt(site.simulatedPrPercent,3)+"%"],
          ["Predicted energy floor",fmt(s!.guaranteedKwh)+" kWh"],["Prediction coverage",fmt(s!.predictionCoverage)+"%"],
          ["Last valid meter interval",s!.lastActualAt?stamp(s!.lastActualAt,true)+" SAST":"No readings"],
          ["PVSOL reference year",String(data.provenance.pvsolReferenceYear??"Unavailable")],
        ].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {data.messages.length>0&&<ul className="contract-data-notes">{data.messages.map(message=><li key={message}><AlertTriangle size={14}/>{message}</li>)}</ul>}
        <div className="contract-method"><p>{data.provenance.prediction}. {data.provenance.predictionResolution}.</p><p>{data.provenance.actual}. {data.provenance.prBasis}.</p><p>{data.provenance.degradation} The PVSOL reference year repeats by month, day and hour; missing dates remain unavailable.</p></div>
      </details>
      <details className="contract-detail"><summary><span>Meters and loads ({operationalNodes.length})</span><small>Physical meters and virtual loads</small></summary><div className="contract-node-links" style={{padding:18}}>{operationalNodes.map(n=><button key={n.id} onClick={()=>onOpenNode(n.navigationKey??n.id)}>{n.name}{n.measurementKind==="calculated"?" · virtual":""}<ArrowUpRight size={13}/></button>)}</div></details>
      <div className="contract-node-links"><span>Explore site operations</span>{nodes.map(n=><button key={n.navigationKey} onClick={()=>onOpenNode(n.navigationKey??n.id)}>{n.name}<ArrowUpRight size={13}/></button>)}</div>
    </>}
  </section>;
}
