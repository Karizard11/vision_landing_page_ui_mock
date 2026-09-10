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

export const inverterDcSeries = [
  {time:"04:00",i01:1.492,i02:1.223,i03:1.101,i04:1.096,i05:1.165,i06:1.343,i07:0.833,i08:1.207,i09:1.205,i10:1.133,i11:1.12,i12:1.026},
  {time:"05:00",i01:21.228,i02:20.845,i03:15.486,i04:18.063,i05:17.825,i06:18.326,i07:6.535,i08:13.321,i09:13.768,i10:9.308,i11:12.762,i12:13.664},
  {time:"06:00",i01:51.034,i02:51.714,i03:49.154,i04:49.516,i05:48.83,i06:48.598,i07:33.158,i08:36.764,i09:38.763,i10:37.173,i11:35.862,i12:37.508},
  {time:"07:00",i01:75.086,i02:76.212,i03:70.456,i04:73.13,i05:73.991,i06:74.352,i07:55.944,i08:58.038,i09:61.239,i10:62.919,i11:56.764,i12:58.553},
  {time:"08:00",i01:90.556,i02:92.09,i03:86.353,i04:88.529,i05:89.466,i06:91.334,i07:70.702,i08:72.684,i09:76.547,i10:79.502,i11:70.996,i12:72.907},
  {time:"09:00",i01:96.948,i02:98.98,i03:100.217,i04:95.247,i05:96.197,i06:98.993,i07:77.573,i08:79.746,i09:83.873,i10:87.252,i11:77.562,i12:79.547},
  {time:"10:00",i01:95.377,i02:97.337,i03:98.522,i04:93.56,i05:94.541,i06:97.634,i07:76.879,i08:79.296,i09:83.308,i10:86.602,i11:77.078,i12:78.947},
  {time:"11:00",i01:87.177,i02:88.819,i03:89.768,i04:85.435,i05:86.284,i06:88.892,i07:70.349,i08:72.862,i09:76.572,i10:79.214,i11:70.766,i12:72.465},
  {time:"12:00",i01:70.894,i02:72.345,i03:73.017,i04:69.419,i05:70.124,i06:72.082,i07:57.202,i08:59.211,i09:62.023,i10:64.216,i11:57.429,i12:58.731},
  {time:"13:00",i01:40.264,i02:40.968,i03:41.138,i04:39.346,i05:39.755,i06:40.649,i07:32.673,i08:34.047,i09:35.242,i10:36.339,i11:32.638,i12:33.42},
  {time:"14:00",i01:9.599,i02:9.74,i03:9.815,i04:9.402,i05:9.272,i06:9.809,i07:8.537,i08:9.379,i09:9.063,i10:9.403,i11:8.382,i12:8.542},
  {time:"15:00",i01:2.325,i02:2.268,i03:2.366,i04:2.297,i05:2.108,i06:2.308,i07:2.048,i08:2.636,i09:2.082,i10:2.265,i11:1.882,i12:1.959},
];

export const singleInverterSeries = [
  {time:"04:00",ac:1.236,dc:1.492,strings:1.172},{time:"05:00",ac:20.457,dc:21.228,strings:16.719},
  {time:"06:00",ac:49.938,dc:51.034,strings:40.176},{time:"07:00",ac:73.871,dc:75.086,strings:59.019},
  {time:"08:00",ac:89.197,dc:90.556,strings:71.018},{time:"09:00",ac:95.494,dc:96.948,strings:76.015},
  {time:"10:00",ac:93.946,dc:95.377,strings:74.765},{time:"11:00",ac:85.87,dc:87.177,strings:68.303},
  {time:"12:00",ac:69.831,dc:70.894,strings:55.54},{time:"13:00",ac:39.653,dc:40.264,strings:31.519},
  {time:"14:00",ac:9.325,dc:9.599,strings:7.542},{time:"15:00",ac:2.099,dc:2.325,strings:1.847},
];

export type StringTelemetry = { channel: number; current: number; voltage: number; power: number; deviation: number };

export const inverterStringTelemetry: Record<string, { medianCurrent: number; capturedAt: string; strings: StringTelemetry[] }> = {
  "01": { medianCurrent:9.779, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.552,voltage:710.85,power:13.899,deviation:99.9},{channel:2,current:19.646,voltage:713.972,power:14.027,deviation:100.9},{channel:3,current:9.826,voltage:713.14,power:7.007,deviation:0.5},{channel:4,current:9.64,voltage:712.348,power:6.867,deviation:-1.4},{channel:5,current:9.672,voltage:711.084,power:6.878,deviation:-1.1},{channel:6,current:9.674,voltage:710.742,power:6.876,deviation:-1.1},{channel:7,current:9.82,voltage:711.354,power:6.985,deviation:0.4},{channel:8,current:9.738,voltage:712.712,power:6.94,deviation:-0.4},{channel:9,current:9.866,voltage:712.63,power:7.031,deviation:0.9},{channel:10,current:9.622,voltage:710.854,power:6.84,deviation:-1.6},{channel:11,current:9.876,voltage:711.316,power:7.025,deviation:1},{channel:12,current:9.694,voltage:710.508,power:6.888,deviation:-0.9}] },
  "02": { medianCurrent:9.779, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:18.596,voltage:733.83,power:13.646,deviation:90.2},{channel:2,current:19.23,voltage:735.004,power:14.134,deviation:96.6},{channel:3,current:9.832,voltage:734.092,power:7.218,deviation:0.5},{channel:4,current:9.548,voltage:733.294,power:7.001,deviation:-2.4},{channel:5,current:9.698,voltage:733.994,power:7.118,deviation:-0.8},{channel:6,current:9.766,voltage:733.11,power:7.16,deviation:-0.1},{channel:7,current:9.69,voltage:736.412,power:7.136,deviation:-0.9},{channel:8,current:9.678,voltage:733.462,power:7.098,deviation:-1},{channel:9,current:10.014,voltage:732.804,power:7.338,deviation:2.4},{channel:10,current:9.774,voltage:733.206,power:7.166,deviation:-0.1},{channel:11,current:9.904,voltage:732.374,power:7.253,deviation:1.3},{channel:12,current:9.784,voltage:732.506,power:7.167,deviation:0.1}] },
  "03": { medianCurrent:9.825, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.684,voltage:739.866,power:14.564,deviation:100.3},{channel:2,current:18.726,voltage:755.144,power:14.141,deviation:90.6},{channel:3,current:9.576,voltage:585.198,power:5.604,deviation:-2.5},{channel:4,current:18.924,voltage:548.332,power:10.377,deviation:92.6},{channel:5,current:9.89,voltage:717.538,power:7.096,deviation:0.7},{channel:6,current:9.692,voltage:714.17,power:6.922,deviation:-1.4},{channel:7,current:9.852,voltage:714.824,power:7.042,deviation:0.3},{channel:8,current:9.75,voltage:724.938,power:7.068,deviation:-0.8},{channel:9,current:9.908,voltage:722.758,power:7.161,deviation:0.8},{channel:10,current:9.64,voltage:724.972,power:6.989,deviation:-1.9},{channel:11,current:9.798,voltage:716.588,power:7.021,deviation:-0.3},{channel:12,current:9.644,voltage:723.29,power:6.975,deviation:-1.8}] },
  "04": { medianCurrent:9.723, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.362,voltage:714.47,power:13.834,deviation:99.1},{channel:2,current:19.41,voltage:721.646,power:14.007,deviation:99.6},{channel:3,current:9.712,voltage:574.038,power:5.575,deviation:-0.1},{channel:4,current:9.41,voltage:719.108,power:6.767,deviation:-3.2},{channel:5,current:9.78,voltage:712.908,power:6.972,deviation:0.6},{channel:6,current:9.524,voltage:719.804,power:6.855,deviation:-2},{channel:7,current:9.764,voltage:722.092,power:7.051,deviation:0.4},{channel:8,current:9.53,voltage:715.212,power:6.816,deviation:-2},{channel:9,current:9.674,voltage:714.848,power:6.915,deviation:-0.5},{channel:10,current:9.65,voltage:717.758,power:6.926,deviation:-0.8},{channel:11,current:9.786,voltage:715.834,power:7.005,deviation:0.6},{channel:12,current:9.734,voltage:717.114,power:6.98,deviation:0.1}] },
  "05": { medianCurrent:9.786, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.192,voltage:719.954,power:13.817,deviation:96.1},{channel:2,current:19.41,voltage:716.426,power:13.906,deviation:98.3},{channel:3,current:9.586,voltage:647.448,power:6.206,deviation:-2},{channel:4,current:9.646,voltage:717.92,power:6.925,deviation:-1.4},{channel:5,current:10.054,voltage:708.274,power:7.121,deviation:2.7},{channel:6,current:9.856,voltage:708.626,power:6.984,deviation:0.7},{channel:7,current:9.82,voltage:708.692,power:6.959,deviation:0.3},{channel:8,current:9.686,voltage:719.646,power:6.97,deviation:-1},{channel:9,current:9.752,voltage:713.012,power:6.953,deviation:-0.3},{channel:10,current:9.91,voltage:711.944,power:7.055,deviation:1.3},{channel:11,current:9.672,voltage:713.282,power:6.899,deviation:-1.2},{channel:12,current:9.66,voltage:709.688,power:6.856,deviation:-1.3}] },
  "06": { medianCurrent:9.913, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.552,voltage:716.478,power:14.009,deviation:97.2},{channel:2,current:19.478,voltage:717.236,power:13.97,deviation:96.5},{channel:3,current:10.024,voltage:712.506,power:7.142,deviation:1.1},{channel:4,current:9.802,voltage:712.57,power:6.985,deviation:-1.1},{channel:5,current:9.744,voltage:717.042,power:6.987,deviation:-1.7},{channel:6,current:19.532,voltage:585.062,power:11.427,deviation:97},{channel:7,current:9.752,voltage:586.674,power:5.721,deviation:-1.6},{channel:8,current:9.604,voltage:558.494,power:5.364,deviation:-3.1},{channel:9,current:16.494,voltage:584.938,power:9.648,deviation:66.4},{channel:10,current:8.104,voltage:600.624,power:4.867,deviation:-18.2},{channel:11,current:8.202,voltage:558.674,power:4.582,deviation:-17.3},{channel:12,current:16.302,voltage:556.102,power:9.066,deviation:64.5}] },
  "07": { medianCurrent:8.217, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:16.39,voltage:733.5,power:12.022,deviation:99.5},{channel:2,current:16.302,voltage:731.114,power:11.919,deviation:98.4},{channel:3,current:8.438,voltage:732.25,power:6.179,deviation:2.7},{channel:4,current:8.156,voltage:733.708,power:5.984,deviation:-0.7},{channel:5,current:8.316,voltage:731.504,power:6.083,deviation:1.2},{channel:6,current:8.13,voltage:731.154,power:5.944,deviation:-1.1},{channel:7,current:0.2,voltage:336.308,power:0.067,deviation:-97.6},{channel:8,current:8.154,voltage:731.162,power:5.962,deviation:-0.8},{channel:9,current:8.298,voltage:731.494,power:6.07,deviation:1},{channel:10,current:8.214,voltage:733.632,power:6.026,deviation:0},{channel:11,current:8.168,voltage:731.638,power:5.976,deviation:-0.6},{channel:12,current:8.22,voltage:731.542,power:6.013,deviation:0}] },
  "08": { medianCurrent:8.444, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:16.94,voltage:736.784,power:12.481,deviation:100.6},{channel:2,current:16.702,voltage:736.29,power:12.298,deviation:97.8},{channel:3,current:8.548,voltage:735.156,power:6.284,deviation:1.2},{channel:4,current:8.404,voltage:736.336,power:6.188,deviation:-0.5},{channel:5,current:8.444,voltage:734.598,power:6.203,deviation:0},{channel:6,current:8.318,voltage:736.394,power:6.125,deviation:-1.5},{channel:7,current:8.438,voltage:737.36,power:6.222,deviation:-0.1},{channel:8,current:8.346,voltage:735.434,power:6.138,deviation:-1.2},{channel:9,current:8.538,voltage:739,power:6.31,deviation:1.1},{channel:11,current:8.198,voltage:735.636,power:6.031,deviation:-2.9},{channel:12,current:8.518,voltage:735.748,power:6.267,deviation:0.9}] },
  "09": { medianCurrent:8.216, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:16.572,voltage:739.366,power:12.253,deviation:101.7},{channel:2,current:16.538,voltage:729.104,power:12.058,deviation:101.3},{channel:3,current:7.91,voltage:736.75,power:5.828,deviation:-3.7},{channel:4,current:8.146,voltage:727.662,power:5.928,deviation:-0.9},{channel:5,current:8.202,voltage:726.316,power:5.957,deviation:-0.2},{channel:6,current:8.174,voltage:730.002,power:5.967,deviation:-0.5},{channel:7,current:8.362,voltage:737.818,power:6.17,deviation:1.8},{channel:8,current:8.188,voltage:738.076,power:6.043,deviation:-0.3},{channel:9,current:8.262,voltage:748.988,power:6.188,deviation:0.6},{channel:10,current:8.136,voltage:741.808,power:6.035,deviation:-1},{channel:11,current:8.326,voltage:733.72,power:6.109,deviation:1.3},{channel:12,current:8.23,voltage:743.57,power:6.12,deviation:0.2}] },
  "10": { medianCurrent:8.507, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:19.372,voltage:493.072,power:9.552,deviation:127.7},{channel:2,current:9.374,voltage:543.752,power:5.097,deviation:10.2},{channel:3,current:16.36,voltage:514.802,power:8.422,deviation:92.3},{channel:4,current:8.22,voltage:508.858,power:4.183,deviation:-3.4},{channel:5,current:16.632,voltage:729.338,power:12.13,deviation:95.5},{channel:6,current:16.266,voltage:728.282,power:11.846,deviation:91.2},{channel:7,current:8.436,voltage:730.18,power:6.16,deviation:-0.8},{channel:8,current:8.306,voltage:728.97,power:6.055,deviation:-2.4},{channel:9,current:8.514,voltage:730.962,power:6.223,deviation:0.1},{channel:10,current:8.41,voltage:728.994,power:6.131,deviation:-1.1},{channel:11,current:8.5,voltage:728.038,power:6.188,deviation:-0.1},{channel:12,current:8.28,voltage:730.876,power:6.052,deviation:-2.7}] },
  "11": { medianCurrent:8.218, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:8.234,voltage:731.742,power:6.025,deviation:0.2},{channel:2,current:16.368,voltage:729.83,power:11.946,deviation:99.2},{channel:3,current:8.188,voltage:730.992,power:5.985,deviation:-0.4},{channel:4,current:8.088,voltage:730.91,power:5.912,deviation:-1.6},{channel:5,current:8.198,voltage:730.45,power:5.988,deviation:-0.2},{channel:6,current:8.104,voltage:728.492,power:5.904,deviation:-1.4},{channel:7,current:8.282,voltage:729.658,power:6.043,deviation:0.8},{channel:8,current:8.372,voltage:729.512,power:6.107,deviation:1.9},{channel:9,current:8.394,voltage:728.77,power:6.117,deviation:2.1},{channel:10,current:8.202,voltage:729.062,power:5.98,deviation:-0.2},{channel:11,current:8.46,voltage:731.678,power:6.19,deviation:2.9},{channel:12,current:8.08,voltage:730.13,power:5.899,deviation:-1.7}] },
  "12": { medianCurrent:8.308, capturedAt:"2026-08-22T09:45:00", strings:[{channel:1,current:16.396,voltage:718.472,power:11.78,deviation:97.4},{channel:2,current:16.382,voltage:723.692,power:11.856,deviation:97.2},{channel:3,current:8.348,voltage:716.222,power:5.979,deviation:0.5},{channel:4,current:8.256,voltage:717.006,power:5.92,deviation:-0.6},{channel:5,current:8.268,voltage:719.026,power:5.945,deviation:-0.5},{channel:6,current:8.2,voltage:722.538,power:5.925,deviation:-1.3},{channel:7,current:8.432,voltage:734.326,power:6.192,deviation:1.5},{channel:8,current:8.102,voltage:622.468,power:5.043,deviation:-2.5},{channel:9,current:8.246,voltage:625.274,power:5.156,deviation:-0.7},{channel:10,current:7.928,voltage:652.414,power:5.172,deviation:-4.6},{channel:11,current:9.91,voltage:567.796,power:5.627,deviation:19.3},{channel:12,current:9.74,voltage:583.118,power:5.68,deviation:17.2}] },
};

export const stringData = inverterStringTelemetry["01"]?.strings ?? [];

export type MpptTelemetry = StringTelemetry;
export const inverterMpptTelemetry = inverterStringTelemetry;

export type InverterMpptConfig = { mppt: number; connectedStrings: number; inputCapacity: number; panelsPerString: number; moduleType: string; sectionId: string; section: string; orientation: number; tilt: number; mountingType: string };
export type InverterElectricalConfig = { inverterType: string; mpptCount: number; inputsPerMppt: number; connectedStrings: number; inputCapacity: number; configuredDcKwp: number; mppts: InverterMpptConfig[] };

const pldSections = {"ROOF_1_2":{"section":"ROOF 1.2","orientation":9,"tilt":3,"mountingType":"roof_mount"},"ROOF_2_2":{"section":"ROOF 2.2","orientation":189,"tilt":3,"mountingType":"roof_mount"},"ROOF_1_1":{"section":"ROOF 1.1","orientation":9,"tilt":3,"mountingType":"roof_mount"},"ROOF_2_1":{"section":"ROOF 2.1","orientation":189,"tilt":3,"mountingType":"roof_mount"}} as const;
const pldInverter = (configuredDcKwp: number, rows: Array<[connectedStrings: number, panelsPerString: number, sectionId: keyof typeof pldSections]>): InverterElectricalConfig => ({
  inverterType: "SG125CX_P2", mpptCount: 12, inputsPerMppt: 2, connectedStrings: rows.reduce((sum,row) => sum + row[0],0), inputCapacity: 24, configuredDcKwp,
  mppts: rows.map(([connectedStrings,panelsPerString,sectionId],index) => ({ mppt:index+1, connectedStrings, inputCapacity:2, panelsPerString, moduleType:"CS6W_550MS", sectionId, ...pldSections[sectionId] })),
});

export const inverterConfiguration: Record<string, InverterElectricalConfig> = {
  "10": pldInverter(156.2,[[2,14,"ROOF_1_2"],[1,14,"ROOF_1_2"],[2,14,"ROOF_2_2"],[1,14,"ROOF_2_2"],[2,20,"ROOF_2_2"],[2,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"]]),
  "11": pldInverter(154,[[2,20,"ROOF_2_2"],[2,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"]]),
  "12": pldInverter(144.65,[[2,20,"ROOF_2_2"],[2,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,20,"ROOF_2_2"],[1,17,"ROOF_2_2"],[1,17,"ROOF_2_2"],[1,17,"ROOF_2_2"],[1,16,"ROOF_1_1"],[1,16,"ROOF_1_1"]]),
  "01": pldInverter(154,[[2,20,"ROOF_1_1"],[2,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"]]),
  "02": pldInverter(154,[[2,20,"ROOF_1_1"],[2,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"],[1,20,"ROOF_1_1"]]),
  "03": pldInverter(151.8,[[2,20,"ROOF_1_1"],[2,20,"ROOF_1_1"],[1,16,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"]]),
  "04": pldInverter(151.8,[[2,20,"ROOF_1_2"],[2,20,"ROOF_1_2"],[1,16,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"]]),
  "05": pldInverter(152.9,[[2,20,"ROOF_1_2"],[2,20,"ROOF_1_2"],[1,18,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"]]),
  "06": pldInverter(162.8,[[2,20,"ROOF_1_2"],[2,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[1,20,"ROOF_1_2"],[2,16,"ROOF_1_2"],[1,16,"ROOF_1_2"],[1,15,"ROOF_1_2"],[2,16,"ROOF_2_1"],[1,16,"ROOF_2_1"],[1,15,"ROOF_2_1"],[2,15,"ROOF_2_1"]]),
  "07": pldInverter(154,[[2,20,"ROOF_2_1"],[2,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"]]),
  "08": pldInverter(154,[[2,20,"ROOF_2_1"],[2,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"]]),
  "09": pldInverter(154,[[2,20,"ROOF_2_1"],[2,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"],[1,20,"ROOF_2_1"]]),
};

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
