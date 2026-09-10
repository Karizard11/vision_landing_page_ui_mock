export type MeterSnapshotValue = {
  energyMwh: number;
  peakKw: number;
  peakKva?: number;
  readings: number;
};

export function combineMeterSnapshots(snapshots: MeterSnapshotValue[]) {
  return {
    energyMwh:snapshots.reduce((sum,item) => sum + item.energyMwh,0),
    peakKw:Math.max(0,...snapshots.map(item => item.peakKw)),
    peakKva:Math.max(0,...snapshots.map(item => item.peakKva ?? 0)),
    readings:snapshots.reduce((sum,item) => sum + item.readings,0),
  };
}
