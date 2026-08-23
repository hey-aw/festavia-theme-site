import { pinkDoorSunset } from "../lib/pink-door-sunset.mjs";

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

function offsetMinutes(date) {
  const offsetName = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  const match = offsetName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Unable to resolve Pacific offset for ${date}.`);
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function instant(date, hour, minute) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, hour, minute) -
    offsetMinutes(date) * 60_000;
  const result = new Date(utcMs);
  if (Number.isNaN(result.getTime())) throw new Error("Invalid date.");
  return result.toISOString();
}

export function pollTiming(date) {
  const localNoon = new Date(instant(date, 12, 0));
  return {
    opensAt: instant(date, 8, 0),
    closesAt: pinkDoorSunset(localNoon).toISOString(),
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.stdout.write(`${JSON.stringify(pollTiming(process.argv[2]))}\n`);
}
