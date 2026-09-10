export const site = {
  provider: "Terradew Four",
  projectCode: "P0480",
  contractId: "3",
  siteId: "4",
  systemKey: "5ID4A",
  name: "PreCool Cold Storage",
  location: "Elangeni, KwaZulu-Natal",
  address: "2 Anderson Road, Elangeni, Mpumalanga, KZN",
  capacityKwp: 1851.33,
  areaM2: 8622.72,
  commissionDate: "31 Aug 2023",
  tariff: 0.88,
  yieldGuarantee: 95,
  snapshotDate: "22 Aug 2026",
  snapshotDateIso: "2026-08-22",
  lastDorisRefresh: "10 Sep 2026",
};

export const meters = [
  { id: "solar-total", name: "Solar Total", type: "solar" as const, serial: "2 physical meters", description: "PVDB 1 + PVDB 2", energyMwh: 6.779, peakKw: 1057.145 },
  { id: "pvdb-1", name: "PVDB 1", type: "solar" as const, serial: "230502183", description: "Eastron SDM630MCT V2", energyMwh: 3.044, peakKw: 478.857 },
  { id: "pvdb-2", name: "PVDB 2", type: "solar" as const, serial: "230508643", description: "Eastron SDM630MCT V2", energyMwh: 3.735, peakKw: 578.289 },
  { id: "incomer-1", name: "Incomer 1", type: "grid" as const, serial: "230711634", description: "Schneider IEM3255", energyMwh: 9.302, peakKw: 659.725 },
  { id: "incomer-2", name: "Incomer 2", type: "grid" as const, serial: "230711751", description: "Schneider IEM3255", energyMwh: 11.225, peakKw: 721.371 },
  { id: "incomer-3", name: "Incomer 3", type: "grid" as const, serial: "230711742", description: "Eastron SDM630MCT V2", energyMwh: 5.702, peakKw: 343.474 },
];

export const powerSeries = [
  {time:"00:00",solar:0,grid:1368.573,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:548.777,incomer2:598.964,incomer3:220.832},
  {time:"01:00",solar:0,grid:1334.124,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:506.425,incomer2:587.233,incomer3:240.466},
  {time:"02:00",solar:0,grid:1253.864,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:493.263,incomer2:562.907,incomer3:197.694},
  {time:"03:00",solar:0,grid:1226.86,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:501.473,incomer2:540.493,incomer3:184.894},
  {time:"04:00",solar:12.825,grid:989.476,inverter:10.705,ghi:0,pvdb1:5.79,pvdb2:7.035,incomer1:371.539,incomer2:406.139,incomer3:211.798},
  {time:"05:00",solar:184.892,grid:810.099,inverter:172.125,ghi:74.5,pvdb1:69.82,pvdb2:115.072,incomer1:237.861,incomer2:338.869,incomer3:233.369},
  {time:"06:00",solar:517.344,grid:854.448,inverter:505.311,ghi:276.5,pvdb1:219.076,pvdb2:298.268,incomer1:228.117,incomer2:396.052,incomer3:230.279},
  {time:"07:00",solar:787.921,grid:733.076,inverter:781.45,ghi:473,pvdb1:349.764,pvdb2:438.157,incomer1:140.77,incomer2:340.173,incomer3:252.133},
  {time:"08:00",solar:964.748,grid:613.954,inverter:963.575,ghi:630.5,pvdb1:435.629,pvdb2:529.119,incomer1:63.104,incomer2:279.726,incomer3:271.124},
  {time:"09:00",solar:1047.284,grid:624.813,inverter:1051.584,ghi:730,pvdb1:474.263,pvdb2:573.021,incomer1:77.89,incomer2:258.747,incomer3:288.176},
  {time:"10:00",solar:1030.866,grid:651.912,inverter:1038.409,ghi:763.5,pvdb1:469.151,pvdb2:561.715,incomer1:82.347,incomer2:270.754,incomer3:298.811},
  {time:"11:00",solar:939.518,grid:707.706,inverter:949.801,ghi:727.5,pvdb1:428.533,pvdb2:510.985,incomer1:145.371,incomer2:285.018,incomer3:277.317},
  {time:"12:00",solar:758.33,grid:1023.846,inverter:771.623,ghi:625,pvdb1:345.613,pvdb2:412.717,incomer1:283.883,incomer2:457.15,incomer3:282.813},
  {time:"13:00",solar:406.485,grid:1356.351,inverter:437.141,ghi:465.5,pvdb1:185.71,pvdb2:220.775,incomer1:491.662,incomer2:583.884,incomer3:280.805},
  {time:"14:00",solar:98.175,grid:1480.38,inverter:106.02,ghi:146,pvdb1:46.669,pvdb2:51.506,incomer1:580.74,incomer2:645.208,incomer3:254.432},
  {time:"15:00",solar:18.93,grid:1173.034,inverter:22.816,ghi:24,pvdb1:8.639,pvdb2:10.291,incomer1:466.351,incomer2:486.012,incomer3:220.671},
  {time:"16:00",solar:.259,grid:1095.479,inverter:0,ghi:0,pvdb1:.153,pvdb2:.106,incomer1:419.261,incomer2:450.414,incomer3:225.804},
  {time:"17:00",solar:0,grid:1052.032,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:402.075,incomer2:421.469,incomer3:228.488},
  {time:"18:00",solar:0,grid:1350.805,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:551.95,incomer2:568.831,incomer3:230.024},
  {time:"19:00",solar:0,grid:1410.565,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:614.846,incomer2:581.882,incomer3:213.837},
  {time:"20:00",solar:0,grid:1403.607,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:567.824,incomer2:602.169,incomer3:233.614},
  {time:"21:00",solar:0,grid:1363.876,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:558.291,incomer2:565.351,incomer3:240.234},
  {time:"22:00",solar:0,grid:1295.165,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:532.738,incomer2:548.666,incomer3:213.761},
  {time:"23:00",solar:0,grid:1267.646,inverter:0,ghi:0,pvdb1:0,pvdb2:0,incomer1:520.88,incomer2:530.158,incomer3:216.608},
].map(row => ({...row, expected: Math.round(row.ghi * 1.85133 * .78)}));

export const inverterSummary = [
  {code:"01",id:"Id227186.4",peakAc:96.087,peakDc:97.55,energy:630.918,cumulative:446169},
  {code:"02",id:"Id227186.11",peakAc:98.232,peakDc:99.728,energy:641.508,cumulative:457733},
  {code:"03",id:"Id227186.5",peakAc:98.7,peakDc:101.158,energy:621.144,cumulative:451862},
  {code:"04",id:"Id227186.12",peakAc:94.296,peakDc:95.919,energy:612.904,cumulative:440954},
  {code:"05",id:"Id227186.9",peakAc:95.309,peakDc:96.891,energy:618.653,cumulative:444852},
  {code:"06",id:"Id227186.7",peakAc:97.523,peakDc:99.913,energy:628.198,cumulative:452525},
  {code:"07",id:"Id227186.13",peakAc:77.354,peakDc:78.537,energy:482.93,cumulative:294580},
  {code:"08",id:"Id227186.10",peakAc:78.436,peakDc:80.665,energy:500.208,cumulative:408856},
  {code:"09",id:"Id227186.3",peakAc:83.232,peakDc:84.846,energy:531.873,cumulative:409998},
  {code:"10",id:"Id227186.6",peakAc:86.239,peakDc:88.116,energy:541.517,cumulative:407985},
  {code:"11",id:"Id227186.2",peakAc:77.276,peakDc:78.453,energy:494.705,cumulative:399052},
  {code:"12",id:"Id227186.8",peakAc:78.86,peakDc:80.438,energy:506.003,cumulative:391671},
].map(row => ({...row,name:`Inverter ${row.code}`,model:"Sungrow SG125CX-P2"}));

export const inverterStack = [
  {time:"04:00",i01:1.236,i02:1.003,i03:.81,i04:.8,i05:.892,i06:1.061,i07:.593,i08:.824,i09:.985,i10:.85,i11:.902,i12:.75},
  {time:"05:00",i01:20.457,i02:20.108,i03:14.686,i04:17.258,i05:17.116,i06:17.541,i07:5.963,i08:12.186,i09:13.048,i10:8.594,i11:12.219,i12:12.95},
  {time:"06:00",i01:49.938,i02:50.612,i03:47.915,i04:48.391,i05:47.884,i06:47.393,i07:32.419,i08:35.327,i09:37.706,i10:36.12,i11:35.084,i12:36.522},
  {time:"07:00",i01:73.871,i02:74.961,i03:68.971,i04:71.88,i05:72.83,i06:72.796,i07:55.013,i08:56.364,i09:59.959,i10:61.603,i11:55.789,i12:57.411},
  {time:"08:00",i01:89.197,i02:90.704,i03:84.389,i04:87.05,i05:88.056,i06:89.243,i07:69.642,i08:70.711,i09:75.178,i10:77.901,i11:69.928,i12:71.576},
  {time:"09:00",i01:95.494,i02:97.495,i03:97.77,i04:93.629,i05:94.609,i06:96.578,i07:76.404,i08:77.541,i09:82.277,i10:85.374,i11:76.398,i12:78.014},
  {time:"10:00",i01:93.946,i02:95.876,i03:96.085,i04:91.949,i05:93.019,i06:95.225,i07:75.721,i08:76.975,i09:81.655,i10:84.652,i11:75.922,i12:77.384},
  {time:"11:00",i01:85.87,i02:87.486,i03:87.598,i04:84.021,i05:84.923,i06:86.739,i07:69.268,i08:70.635,i09:75.078,i10:77.43,i11:69.704,i12:71.047},
  {time:"12:00",i01:69.831,i02:71.26,i03:71.273,i04:68.277,i05:69.044,i06:70.431,i07:56.321,i08:57.284,i09:60.917,i10:62.796,i11:56.567,i12:57.622},
  {time:"13:00",i01:39.653,i02:40.353,i03:40.202,i04:38.645,i05:39.155,i06:39.71,i07:31.995,i08:32.492,i09:34.564,i10:35.455,i11:32.149,i12:32.768},
  {time:"14:00",i01:9.325,i02:9.537,i03:9.373,i04:9.015,i05:9.115,i06:9.427,i07:8.02,i08:8.145,i09:8.707,i10:8.881,i11:8.252,i12:8.224},
  {time:"15:00",i01:2.099,i02:2.113,i03:2.072,i04:1.988,i05:2.01,i06:2.054,i07:1.571,i08:1.723,i09:1.799,i10:1.861,i11:1.791,i12:1.736},
];

export const singleInverterSeries = [
  {time:"04:00",ac:1.236,dc:1.492,strings:1.172},{time:"05:00",ac:20.457,dc:21.228,strings:16.719},
  {time:"06:00",ac:49.938,dc:51.034,strings:40.176},{time:"07:00",ac:73.871,dc:75.086,strings:59.019},
  {time:"08:00",ac:89.197,dc:90.556,strings:71.018},{time:"09:00",ac:95.494,dc:96.948,strings:76.015},
  {time:"10:00",ac:93.946,dc:95.377,strings:74.765},{time:"11:00",ac:85.87,dc:87.177,strings:68.303},
  {time:"12:00",ac:69.831,dc:70.894,strings:55.54},{time:"13:00",ac:39.653,dc:40.264,strings:31.519},
  {time:"14:00",ac:9.325,dc:9.599,strings:7.542},{time:"15:00",ac:2.099,dc:2.325,strings:1.847},
];

export const stringData = [13.899,14.027,7.007,6.867,6.878,6.876,6.985,6.94,7.031].map((power,index)=>({name:`String ${index+1}`,power}));

export const totals = {
  solarEnergyMwh: 6.779,
  inverterEnergyMwh: 6.811,
  gridImportMwh: 26.228,
  gridExportKwh: 3.375,
  estimatedLoadMwh: 33.004,
  avoidedCostZar: 5965.52,
  cumulativeEnergyGwh: 5.006,
  peakAcMw: 1.052,
  peakSolarKw: 1057.145,
  solcastPeakGhi: 763.5,
  prEstimate: 74.2,
};
