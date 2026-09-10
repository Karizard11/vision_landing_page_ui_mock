export type PortfolioNode = {
  id: string;
  parentId?: string;
  name: string;
  type: string;
  meters: number;
};

export type PortfolioSite = {
  code: string;
  name: string;
  city: string;
  capacityKwp: number;
  annualYieldKwh: number;
  guarantee: number;
  tariff?: number;
  commissioned: string;
  meterCount: number;
  nodeCount: number;
  systemKey: string;
  nodes: PortfolioNode[];
};

const n = (id: string, parentId: string | undefined, name: string, type: string, meters = 1): PortfolioNode => ({ id, parentId, name, type, meters });

export type PortfolioNavigationNode = PortfolioNode & { navigationKey: string };

export function isVirtualTotalNode(node: PortfolioNode) {
  const type = node.type.toLowerCase();
  return type === "site total" || type === "solar total" || type === "municipal total";
}

export function siteNavigationNodes(item: PortfolioSite): PortfolioNavigationNode[] {
  if (item.code !== "P0480") return item.nodes.map((node,index) => ({...node,navigationKey:`${node.id}-${index}`}));
  const nodes = new Map(item.nodes.map(node => [node.id,node]));
  const branch = (id: string, parentId: string | undefined, navigationKey: string): PortfolioNavigationNode => ({...nodes.get(id)!,parentId,navigationKey});
  return [
    branch("1140726",undefined,"site-total"),
    branch("1140727","1140726","municipal-total"),
    branch("1140724","1140727","municipal-incomer-1"),
    branch("1140730","1140724","municipal-pvdb-1"),
    branch("1140728","1140727","municipal-incomer-2"),
    branch("1140721","1140728","municipal-pvdb-2"),
    branch("1140729","1140727","municipal-incomer-3"),
    branch("1140723","1140726","solar-total"),
    branch("1140730","1140723","solar-pvdb-1"),
    branch("1140721","1140723","solar-pvdb-2"),
  ];
}

export const portfolioSites: PortfolioSite[] = [
  { code:"P0427", name:"Cavaleros - Welkom Shopping Centre", city:"Welkom", capacityKwp:497.20, annualYieldKwh:808563, guarantee:100, tariff:1.19119, commissioned:"20 Oct 2022", meterCount:4, nodeCount:8, systemKey:"TN413", nodes:[
    n("1140644",undefined,"Solar total","Solar total",2), n("1140648","1140644","MPV1","Solar"), n("1140643","1140644","MPV2","Solar"), n("1140646",undefined,"Main Incomer 1","Transformer"), n("1140642",undefined,"Main Incomer 2","Transformer") ] },
  { code:"P0428", name:"Cavaleros Norwood Mall", city:"Norwood", capacityKwp:2390.30, annualYieldKwh:3882029, guarantee:95, commissioned:"09 Dec 2022", meterCount:7, nodeCount:12, systemKey:"IP2EH", nodes:[
    n("1140733",undefined,"PVDB Total","Solar total",3), n("1140734",undefined,"Transformer 2","Transformer"), n("1140743","1140734","MPV2","Solar"), n("1140737",undefined,"Transformer 4","Transformer"), n("1140739","1140737","MPV1","Solar"), n("1140736",undefined,"Transformer 1","Transformer"), n("1140735",undefined,"Transformer 3","Transformer"), n("1140732","1140735","MPV3","Solar") ] },
  { code:"P0480", name:"PreCool Cold Storage", city:"Elangeni", capacityKwp:1851.33, annualYieldKwh:2390607.535, guarantee:95, tariff:.88, commissioned:"31 Aug 2023", meterCount:5, nodeCount:9, systemKey:"5ID4A", nodes:[
    n("1140726",undefined,"Site Total","Site total",5), n("1140727","1140726","Municipal Total","Municipal total",3), n("1140724","1140727","Incomer 1","Transformer"), n("1140730","1140724","PVDB 1","Solar"), n("1140728","1140727","Incomer 2","Transformer"), n("1140721","1140728","PVDB 2","Solar"), n("1140729","1140727","Incomer 3","Transformer"), n("1140723","1140726","Solar Total","Solar total",2) ] },
  { code:"P0504", name:"CBI African Cables", city:"Vereeniging", capacityKwp:2259, annualYieldKwh:3541266, guarantee:95, tariff:1.03, commissioned:"27 Feb 2024", meterCount:5, nodeCount:14, systemKey:"A3R64", nodes:[
    n("1500014",undefined,"Solar Total","Solar total",3), n("1500017","1500014","PVDB 3","Solar"), n("1500016","1500014","PVDB 1","Solar"), n("1500015","1500014","PVDB 2","Solar"), n("4509502",undefined,"Site Total","Municipal total",2), n("4505338","4509502","Main Incomer 2","Transformer"), n("4546205","4505338","Main Incomer 2 - Load","Transformer",2), n("4510451","4509502","Main Incomer 1","Transformer"), n("4508818","4510451","Main Incomer 1 - Load","Transformer",3) ] },
  { code:"P0517", name:"Country Bird Holdings - Germiston", city:"Germiston", capacityKwp:2621, annualYieldKwh:3917462, guarantee:95, tariff:.941, commissioned:"05 Oct 2023", meterCount:4, nodeCount:10, systemKey:"UKRDS", nodes:[
    n("1140666",undefined,"Solar total","Solar total",3), n("1140663","1140666","MPV2","Solar"), n("1140661","1140666","MPV3","Solar"), n("1140664","1140666","MPV1","Solar"), n("1140665",undefined,"Municipal Total","Municipal total") ] },
  { code:"P0533", name:"SPAR DC Western Cape", city:"Cape Town", capacityKwp:2100.21, annualYieldKwh:3231315, guarantee:95, tariff:.845, commissioned:"09 Feb 2024", meterCount:20, nodeCount:31, systemKey:"A6DL8", nodes:[
    n("121925",undefined,"Solar total BOO","Solar total",3), n("8122054","121925","PVDB 3","Solar"), n("8122053","121925","PVDB 2","Solar"), n("8000125","121925","PVDB 1","Solar"), n("8040779",undefined,"Solar PV total EPC","Solar total"), n("4506325","8040779","Perishables Solar PV","Solar"), n("5540642",undefined,"Admin Block Main Incomer","Transformer"), n("5540641",undefined,"Battery Bay Main Incomer","Transformer"), n("8122055",undefined,"Perishables Main Incomer","Transformer"), n("4581523",undefined,"Warehouse Main Incomer","Transformer"), n("4547362","5540642","Conference","Meter"), n("4547862","5540642","AC","Meter"), n("4504802","5540642","Local Circuits","Meter",5), n("4509171","5540642","Admin Block Main Breaker","Transformer"), n("4509062","8122055","Generator 2","Generator"), n("4508007","8122055","Office 1","Meter"), n("4505411","8122055","Sub DB 4","Transformer"), n("4545529","8122055","Generator 1","Generator"), n("4506256","8122055","Perishables Remainder","Remainder",7), n("4508696","4509171","Floor 2","Meter"), n("4546633","4509171","Various Other Circuits","Meter",6), n("4547813","4509171","Floor 1","Meter"), n("4505174","4509171","U.P.S","Meter"), n("4507951","4509171","Admin AC","Meter"), n("4547674","4509171","Floor 3","Meter") ] },
  { code:"P0534", name:"SPAR DC South Rand", city:"Boksburg", capacityKwp:600.43, annualYieldKwh:932173, guarantee:95, tariff:1.047, commissioned:"28 Sep 2023", meterCount:7, nodeCount:13, systemKey:"5TT8R", nodes:[
    n("8122060",undefined,"Solar total","Solar total",3), n("162566",undefined,"PVDB 3 Perishables BOO","Solar"), n("8000134",undefined,"Perishables Room No.1","Transformer"), n("8081283",undefined,"Perishables Room No.2","Transformer"), n("4510137",undefined,"PVDB 2 Admin","Solar"), n("4547756","8122060","PVDB 1 New Warehouse","Solar"), n("8040822",undefined,"Admin Mini Sub","Transformer"), n("8122061",undefined,"New Warehouse","Transformer") ] },
  { code:"P0535", name:"SPAR KZN Dry Goods", city:"Phoenix", capacityKwp:256.55, annualYieldKwh:318430, guarantee:95, tariff:1.355, commissioned:"13 Nov 2019", meterCount:8, nodeCount:13, systemKey:"LPZGR", nodes:[
    n("1140750",undefined,"Solar total","Solar total",2), n("1140759",undefined,"Trf New Warehouse","Transformer"), n("1140746","1140759","Solar Phase 2","Solar"), n("1140748","1140759","Solar Phase 1","Solar"), n("1140751",undefined,"Trf 2 Old Warehouse","Transformer"), n("1140756","1140751","Admin Aircon","Meter"), n("1140753","1140751","Battery Bay Rear","Meter"), n("4548179","1140751","Trf 2 Remainder","Remainder",5), n("1140752","1140751","Battery Bay","Meter"), n("1140760","1140751","Old Warehouse","Meter") ] },
  { code:"P0549", name:"Botshilu Private Hospital", city:"Soshanguve", capacityKwp:730.73, annualYieldKwh:1137518, guarantee:95, tariff:1.067, commissioned:"03 Jun 2024", meterCount:6, nodeCount:7, systemKey:"6H5FJ", nodes:[
    n("7",undefined,"Solar total","Solar total",2), n("10000000",undefined,"MBAT Meter","BESS"), n("8121972",undefined,"Minisub 1","Transformer",2), n("8040698","8121972","Solar PV","Solar",2), n("8000054",undefined,"Minisub 2","Transformer") ] },
  { code:"P0555", name:"Cavaleros Arcon Park", city:"Vereeniging", capacityKwp:1137, annualYieldKwh:1789933.641, guarantee:95, commissioned:"30 Oct 2024", meterCount:5, nodeCount:9, systemKey:"3FAZB", nodes:[
    n("4546693",undefined,"Arcon Park - Solar Total","Solar total",2), n("4507407","4546693","Arcon Park - PVDB 1","Solar"), n("4507077","4546693","Arcon Park - PVDB 2","Solar"), n("4509842",undefined,"Arcon Park - Main incomer 1","Transformer"), n("4506592",undefined,"Arcon Park - Main incomer 2","Transformer"), n("4507954",undefined,"Arcon Park - Generator","Generator") ] },
  { code:"P0556", name:"Caveleros Village View", city:"Bedfordview", capacityKwp:838, annualYieldKwh:1358775, guarantee:100, commissioned:"28 Sep 2024", meterCount:4, nodeCount:7, systemKey:"CY4C2", nodes:[
    n("1662565",undefined,"PVDB Total","Solar total"), n("1662563","1662565","MPV","Solar"), n("1662572",undefined,"Checkers Minisub","Transformer"), n("1662569",undefined,"Main Incomer 1","Transformer"), n("1662570",undefined,"Main Incomer 2","Transformer") ] },
  { code:"P0562", name:"Rebamoritiwa Tswelopele", city:"Tembisa", capacityKwp:241, annualYieldKwh:364452, guarantee:95, tariff:.963, commissioned:"19 Feb 2024", meterCount:2, nodeCount:6, systemKey:"V9N7B", nodes:[
    n("40645",undefined,"Solar total","Solar total"), n("8040651","40645","Solar","Solar"), n("81291",undefined,"Municipal total","Municipal total") ] },
  { code:"P0563", name:"Rebamoritiwa Nzhelele", city:"Makhado", capacityKwp:473.68, annualYieldKwh:746252, guarantee:95, tariff:.897, commissioned:"11 Apr 2024", meterCount:3, nodeCount:9, systemKey:"UWQKB", nodes:[
    n("1140651",undefined,"Solar total","Solar total",2), n("1140652","1140651","MPV 1","Solar"), n("4547578","1140651","MPV 2","Solar"), n("1140654",undefined,"Municipal total","Municipal total"), n("1140653","1140654","M1","Transformer") ] },
  { code:"P0568", name:"Reunert - Nashua Building", city:"Midrand", capacityKwp:231, annualYieldKwh:383930, guarantee:95, tariff:1.1, commissioned:"21 Dec 2015", meterCount:8, nodeCount:16, systemKey:"P0568", nodes:[
    n("4546369",undefined,"PV total","Solar total",2), n("4546370","4546369","Solar PV 1","Solar"), n("4506375","4546369","Solar PV 2","Solar"), n("4509210",undefined,"Inverter Total","Municipal total",2), n("4509868","4509210","Inverter 2","Meter"), n("4506881","4509210","Inverter 1","Meter"), n("4548169",undefined,"Battery Total","BESS",3), n("4509940","4548169","Battery Bank 3","BESS"), n("4508923","4548169","Battery Bank 2","BESS"), n("4510013","4548169","Battery Bank 1","BESS"), n("4507901",undefined,"MLoad","Load") ] },
  { code:"P0589", name:"Paarl Village Centre", city:"Paarl", capacityKwp:969, annualYieldKwh:1493751, guarantee:95, tariff:.9, commissioned:"09 Sep 2024", meterCount:3, nodeCount:6, systemKey:"UXGH5", nodes:[
    n("1500006",undefined,"Solar Total","Solar total"), n("1500007","1500006","PVDB","Solar"), n("1500004",undefined,"M1","Transformer"), n("1500011",undefined,"M2","Transformer") ] },
  { code:"P0590", name:"Vector eThekwini", city:"Durban", capacityKwp:1254, annualYieldKwh:1688704, guarantee:95, tariff:1.195, commissioned:"17 Jun 2025", meterCount:7, nodeCount:12, systemKey:"BPXI8", nodes:[
    n("10581284",undefined,"Solar total","Solar total",3), n("10581288","10581284","PVDB 1","Solar"), n("10581289","10581284","PVDB 2","Solar"), n("10581290","10581284","PVDB 3","Solar"), n("10581291",undefined,"Main incomer 1","Transformer"), n("10581292",undefined,"Main incomer 2","Transformer"), n("10581293",undefined,"Main incomer 3","Transformer"), n("10581294",undefined,"Main incomer 4","Transformer") ] },
  { code:"P0594", name:"NCP", city:"Chloorkop", capacityKwp:1091, annualYieldKwh:1858630, guarantee:92, tariff:.845, commissioned:"21 Nov 2024", meterCount:6, nodeCount:9, systemKey:"IBDCH", nodes:[
    n("4546013",undefined,"NCP Solar total","Solar total",6), n("4506450","4546013","Phase 2B - PVDB 3","Solar"), n("8081324","4546013","Phase 2F - PVDB 6","Solar"), n("4509497","4546013","Phase 2A - PVDB 2","Solar"), n("4509803","4546013","Phase 2C - PVDB 5","Solar"), n("3040663","4546013","Solar PV","Solar total"), n("10581306","3040663","PVDB 1","Solar"), n("4506207","4546013","Phase 2C - PVDB 4","Solar"), n("7121922",undefined,"Solar Total Phase 2a","Solar total") ] },
  { code:"P0600", name:"CBH-Supreme Poultry Mafikeng", city:"Mafikeng", capacityKwp:1676.2, annualYieldKwh:2845924.078, guarantee:95, tariff:.905, commissioned:"07 Jan 2025", meterCount:3, nodeCount:8, systemKey:"BS88X", nodes:[
    n("4545254",undefined,"Solar Total","Solar total",2), n("4547927","4545254","MPV1","Solar"), n("4508738","4545254","MPV2","Solar"), n("4506273",undefined,"Site Total","Municipal total") ] },
  { code:"P0602", name:"NCP", city:"Edenvale", capacityKwp:2117, annualYieldKwh:3594074.982, guarantee:95, tariff:1.105, commissioned:"25 Apr 2025", meterCount:6, nodeCount:9, systemKey:"U365Q", nodes:[
    n("4546013",undefined,"NCP Solar total","Solar total",6), n("4506450","4546013","Phase 2B - PVDB 3","Solar"), n("8081324","4546013","Phase 2F - PVDB 6","Solar"), n("4509497","4546013","Phase 2A - PVDB 2","Solar"), n("4509803","4546013","Phase 2C - PVDB 5","Solar"), n("3040663","4546013","Solar PV","Solar total"), n("10581306","3040663","PVDB 1","Solar"), n("4506207","4546013","Phase 2C - PVDB 4","Solar"), n("7121922",undefined,"Solar Total Phase 2a","Solar total") ] },
  { code:"P0609", name:"Maxion Wheels", city:"Alberton", capacityKwp:2441.8, annualYieldKwh:4188797.275, guarantee:95, tariff:1.18, commissioned:"15 May 2025", meterCount:3, nodeCount:9, systemKey:"ES67V", nodes:[
    n("4622015",undefined,"Solar total","Solar total",2), n("8000026",undefined,"Municipal total","Municipal total"), n("4510080","8000026","M1","Transformer"), n("4545415","4510080","MPV 1","Solar"), n("8040657","4510080","MPV 2","Solar") ] },
  { code:"P0613", name:"CBH Nutri Feed Viljoenskroon", city:"Viljoenskroon", capacityKwp:2014.1, annualYieldKwh:3425816.274, guarantee:95, tariff:.905, commissioned:"11 Feb 2025", meterCount:3, nodeCount:8, systemKey:"1Q7P2", nodes:[
    n("4547143",undefined,"Solar Total","Solar total",2), n("4504031","4547143","PVDB 1","Solar"), n("4547380","4547143","PVDB 2","Solar"), n("4509531",undefined,"Municipal total","Municipal total") ] },
  { code:"P0622", name:"Reutech Radar Systems", city:"Stellenbosch", capacityKwp:136.3, annualYieldKwh:204042.742, guarantee:95, tariff:1.2296, commissioned:"01 Apr 2025", meterCount:4, nodeCount:8, systemKey:"T56H8", nodes:[
    n("4507474",undefined,"Solar Total","Solar total",2), n("4506622",undefined,"Main Incomer 1","Transformer"), n("4508184","4506622","PVDB 1","Solar"), n("4510102",undefined,"Main Incomer 2","Transformer"), n("4510113","4510102","PVDB 2","Solar") ] },
  { code:"P0624", name:"NCP", city:"Johannesburg", capacityKwp:2435.42, annualYieldKwh:4137446, guarantee:95, tariff:.946, commissioned:"16 Dec 2025", meterCount:6, nodeCount:9, systemKey:"5QBHI", nodes:[
    n("4546013",undefined,"NCP Solar total","Solar total",6), n("4506450","4546013","Phase 2B - PVDB 3","Solar"), n("8081324","4546013","Phase 2F - PVDB 6","Solar"), n("4509497","4546013","Phase 2A - PVDB 2","Solar"), n("4509803","4546013","Phase 2C - PVDB 5","Solar"), n("3040663","4546013","Solar PV","Solar total"), n("10581306","3040663","PVDB 1","Solar"), n("4506207","4546013","Phase 2C - PVDB 4","Solar"), n("7121922",undefined,"Solar Total Phase 2a","Solar total") ] },
];

export const portfolioTotals = {
  sites: portfolioSites.length,
  meters: portfolioSites.reduce((sum, item) => sum + item.meterCount, 0),
  capacityMwp: portfolioSites.reduce((sum, item) => sum + item.capacityKwp, 0) / 1000,
  annualYieldGwh: portfolioSites.reduce((sum, item) => sum + item.annualYieldKwh, 0) / 1_000_000,
  weightedGuarantee: portfolioSites.reduce((sum, item) => sum + item.guarantee * item.capacityKwp, 0) / portfolioSites.reduce((sum, item) => sum + item.capacityKwp, 0),
};
