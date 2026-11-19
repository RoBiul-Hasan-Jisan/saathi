// Bangladesh has no daylight saving, so Dhaka is always UTC+6.
const DHAKA_MIN = 360;
const DAY = 86400000;

export const nowIso = () => new Date().toISOString();

// "YYYY-MM-DD" in Dhaka for any instant.
export function dhakaDate(input = new Date()) {
  return new Date(new Date(input).getTime() + DHAKA_MIN * 60000).toISOString().slice(0, 10);
}

// Dhaka wall-clock date + "HH:MM" -> ISO instant (UTC).
export function dhakaToIso(dateStr, hhmm) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - DHAKA_MIN * 60000).toISOString();
}

const utcDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (dateStr, n) => new Date(utcDay(dateStr) + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((utcDay(b) - utcDay(a)) / DAY); // b - a

// Monday of the week (Dhaka) as YYYY-MM-DD.
export function weekStart(iso) {
  const d = dhakaDate(iso);
  const dow = new Date(utcDay(d)).getUTCDay(); // 0=Sun
  return addDays(d, -((dow + 6) % 7));
}
