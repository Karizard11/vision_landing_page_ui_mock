export const SAST_TIME_ZONE = "Africa/Johannesburg";
export const DEFAULT_START_TIME = "00:00";
export const DEFAULT_END_TIME = "23:59";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function sastTimestamp(day: string, time: string) {
  if (!datePattern.test(day) || !timePattern.test(time)) {
    throw new Error("Expected a YYYY-MM-DD date and HH:MM time");
  }
  const value = Date.parse(`${day}T${time}:00+02:00`);
  if (!Number.isFinite(value)) throw new Error("Invalid SAST date and time");
  return value;
}

export function inclusiveRangeMinutes(fromDay: string, fromTime: string, toDay: string, toTime: string) {
  const start = sastTimestamp(fromDay,fromTime);
  const end = sastTimestamp(toDay,toTime);
  if (end < start) throw new Error("End must not be before start");
  return Math.floor((end-start)/60_000)+1;
}

export function selectedTimestampIsInRange(
  day: string,
  time: string,
  fromDay: string,
  fromTime: string,
  toDay: string,
  toTime: string,
) {
  const value = sastTimestamp(day,time);
  return value >= sastTimestamp(fromDay,fromTime) && value <= sastTimestamp(toDay,toTime);
}
