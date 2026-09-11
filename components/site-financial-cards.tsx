"use client";

import { useEffect, useState } from "react";
import { Landmark, Wallet, CircleDollarSign } from "lucide-react";
import type { PortfolioSite } from "@/lib/portfolio-data";

type Metric = {amount:number|null;currency?:string;tariffProfileId?:number|null;state:"ready"|"partial"|"unavailable"|"not-applicable";detail:string;reasonCodes:string[]};
type Financials = {
  contractId:string;currency:string;basis:string;ppaApplicable:boolean|null;
  coveragePercent:number|null;selfConsumedKwh:number|null;
  municipalSavings:Metric;ppaIncome:Metric;netSavings:Metric;messages:string[];source:string;
};
const basePath=process.env.NEXT_PUBLIC_BASE_PATH??"";
const money=(value:number|null|undefined,currency:string)=>value==null||!Number.isFinite(value)?"—":
  new Intl.NumberFormat("en-ZA",{style:"currency",currency,maximumFractionDigits:0}).format(value);

export function SiteFinancialCards({site,from,to,fromTime,toTime}:{
  site:PortfolioSite;from:string;to:string;fromTime:string;toTime:string;
}) {
  const [retry,setRetry]=useState(0);
  const key=[site.contractId,from,to,fromTime,toTime,retry].join("|");
  const [state,setState]=useState<{key:string;data?:Financials;error?:string}|null>(null);
  useEffect(()=>{
    if(!site.contractId)return;
    const abort=new AbortController();
    const params=new URLSearchParams({contract_id:site.contractId,from,to,from_time:fromTime,to_time:toTime});
    void fetch(basePath+"/api/site/financials?"+params,{cache:"no-store",signal:abort.signal})
      .then(async response=>{
        const data=await response.json() as Financials & {error?:string};
        if(!response.ok)throw new Error(data.error??"Financials unavailable");
        if(data.contractId!==site.contractId||!data.municipalSavings||!data.ppaIncome||!data.netSavings)throw new Error("Invalid financial response");
        if(!abort.signal.aborted)setState({key,data});
      }).catch(error=>{if(!abort.signal.aborted)setState({key,error:error instanceof Error?error.message:"Financials unavailable"});});
    return()=>abort.abort();
  },[key,site.contractId,from,to,fromTime,toTime]);
  const current=state?.key===key?state:null;
  const data=current?.data;
  const loading=!current;
  const applicable=data?.ppaApplicable??(site.contractType?.toLowerCase()==="epc"?false:null);
  const cards=[
    {label:"Municipal savings",icon:Landmark,value:data?.municipalSavings},
    ...(applicable!==false?[{label:"PPA income",icon:Wallet,value:data?.ppaIncome}]:[]),
    {label:"Net financial savings",icon:CircleDollarSign,value:data?.netSavings},
  ];
  const unavailable=!!current?.error||!!data&&cards.some(card=>card.value?.state==="unavailable");
  const partial=!!data&&cards.some(card=>card.value?.state==="partial");
  const quality=data?.coveragePercent!=null&&data.coveragePercent<99.9?`${data.coveragePercent.toFixed(1)}% data`:partial?"estimated":"";
  return <section className="site-financial-summary" aria-label="Site financial summary" aria-busy={loading}>
    <div className="site-financial-heading"><h2>Financial summary</h2><span>Selected period · energy only · excl. VAT{quality?` · ${quality}`:""}</span></div>
    <div className="site-financial-cards" style={{gridTemplateColumns:`repeat(${cards.length},minmax(0,1fr))`}}>
      {cards.map(({label,icon:Icon,value})=><article key={label}>
        <span><Icon aria-hidden="true"/>{label}</span>
        <strong className={value?.amount!=null&&value.amount<0?"negative":""}>{money(value?.amount,value?.currency??data?.currency??"ZAR")}</strong>
        <p>{loading?"Calculating from meter readings and tariffs…":current?.error??value?.detail??"Unavailable"}</p>
      </article>)}
    </div>
    <details className="site-financial-basis"><summary>Calculation basis{unavailable?" · some amounts unavailable":""}</summary>
      <p>Municipal savings value solar energy retained on site at the contract’s municipal energy tariff. PPA income is the solar owner’s revenue on that energy; it is deducted once to show the customer’s net savings. EPC contracts have no PPA deduction.</p>
      <p>Uses the reporting tariff engine and 30-minute meter register intervals. Excludes VAT, demand and fixed charges, feed-in credits and operating costs. These figures are not a full bill or project profit.</p>
      {data?.coveragePercent!=null&&<p>Matched meter coverage: {data.coveragePercent.toFixed(1)}% of the selected period. {data.selfConsumedKwh!=null?`Retained solar energy: ${new Intl.NumberFormat("en-ZA",{maximumFractionDigits:1}).format(data.selfConsumedKwh)} kWh.`:""}</p>}
      {data?.messages.map(message=><p key={message}>{message}</p>)}
      {data&&<p>Tariff profiles: municipal {data.municipalSavings.tariffProfileId??"not configured"}{applicable?` · PPA ${data.ppaIncome.tariffProfileId??"not configured"}`:""}. Source: {data.source}.</p>}
      {data&&cards.flatMap(card=>(card.value?.reasonCodes??[]).map(code=><p key={card.label+code}>{card.label}: {code.replaceAll("_"," ").toLowerCase()}</p>))}
      {unavailable&&<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry financials</button>}
    </details>
  </section>;
}
