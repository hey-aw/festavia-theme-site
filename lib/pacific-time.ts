const PACIFIC_TIME_ZONE = "America/Los_Angeles";

export function pacificDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatPacificDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function phaseForPoll(
  now: Date,
  opensAt: string,
  closesAt: string,
  hasAppliedTheme: boolean,
): "scheduled" | "open" | "preparing" | "complete" {
  if (hasAppliedTheme) return "complete";
  const nowMs = now.getTime();
  if (nowMs < Date.parse(opensAt)) return "scheduled";
  if (nowMs < Date.parse(closesAt)) return "open";
  return "preparing";
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
