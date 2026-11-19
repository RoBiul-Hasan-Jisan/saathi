import { TIMES, SLOT_TIMES, GRACE_MIN } from "./constants.js";
import { addDays, dhakaDate, dhakaToIso, diffDays } from "../lib/dates.js";

// Everything about "when is each dose due" lives here so reminders, missed-dose alerts,
// adherence history and refill prompts all agree.

const confirmedLines = (card) => card.lines.filter((l) => l.status === "confirmed");

export const courseStart = (card) => (card.issuedAt ? dhakaDate(card.issuedAt) : null);

export function courseDays(card) {
  return Math.max(0, ...confirmedLines(card).map((l) => l.days || 0));
}

export function courseEndsOn(card) {
  if (!card.issuedAt) return null;
  const days = courseDays(card);
  return days ? addDays(courseStart(card), days - 1) : null;
}

// Slots that have at least one active line on this date (ignores the time of day).
export function activeSlots(card, dateStr) {
  const start = courseStart(card);
  if (!start) return [];
  const idx = diffDays(start, dateStr);
  if (idx < 0) return [];
  const slots = new Set();
  for (const line of confirmedLines(card)) {
    if (idx >= line.days) continue;
    for (const t of TIMES) if (line.pattern?.[t] > 0) slots.add(t);
  }
  return TIMES.filter((t) => slots.has(t));
}

// Slots we expect a tick for: on the first day, slots earlier than the moment of issue are skipped.
export function expectedSlots(card, dateStr) {
  const start = courseStart(card);
  return activeSlots(card, dateStr).filter(
    (t) => diffDays(start, dateStr) > 0 || dhakaToIso(dateStr, SLOT_TIMES[t]) >= card.issuedAt
  );
}

export function adherence(card, intakes, nowIsoStr = new Date().toISOString()) {
  const start = courseStart(card);
  const end = courseEndsOn(card);
  const empty = { start, end, expected: 0, taken: 0, percent: null, missed: [], rows: [] };
  if (!start || !end) return empty;

  const today = dhakaDate(nowIsoStr);
  const last = today < end ? today : end;
  const now = Date.parse(nowIsoStr);
  const rows = [];
  const missed = [];
  let expected = 0;
  let taken = 0;

  for (let d = start, n = 0; d <= last && n < 100; d = addDays(d, 1), n++) {
    for (const slot of expectedSlots(card, d)) {
      const done = intakes.some((i) => i.date === d && i.slot === slot);
      const overdue = now > Date.parse(dhakaToIso(d, SLOT_TIMES[slot])) + GRACE_MIN * 60000;
      const status = done ? "taken" : overdue ? "missed" : "upcoming";
      rows.push({ date: d, slot, status });
      if (status === "upcoming") continue;
      expected++;
      if (done) taken++;
      else missed.push({ date: d, slot });
    }
  }
  return { start, end, expected, taken, percent: expected ? Math.round((taken / expected) * 100) : null, missed, rows };
}

// Refill / "course complete" prompts for staff: courses ending within 2 days or finished in the last 3.
export function followUpInfo(card, today = dhakaDate()) {
  const end = courseEndsOn(card);
  if (!end) return null;
  const daysLeft = diffDays(today, end);
  return { endsOn: end, daysLeft, due: daysLeft <= 2 && daysLeft >= -3 };
}
