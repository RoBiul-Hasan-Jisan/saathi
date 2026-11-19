import { TIMES } from "./templates";
import { lineSummaryBn, timeBn } from "./bangla";

// A calendar file (.ics) with an alarm for every dose. It works with the phone's own calendar app,
// needs no account, and keeps ringing with no internet.

const SLOT_TIME = { morning: [8, 0], afternoon: [14, 0], night: [21, 0] };
const DHAKA = 6 * 3600_000;

const pad = (n) => String(n).padStart(2, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
};
const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(card, P) {
  if (!card.issuedAt) return null;
  const issued = Date.parse(card.issuedAt);
  const startDay = new Date(Math.floor((issued + DHAKA) / 86400000) * 86400000); // Dhaka midnight, expressed as UTC fields
  const lines = card.lines.filter((l) => l.status === "confirmed");
  const total = Math.max(0, ...lines.map((l) => l.days || 0));
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saathi//Medicine reminders//EN", "CALSCALE:GREGORIAN"];

  for (let day = 0; day < total; day++) {
    for (const slot of TIMES) {
      const due = lines.filter((l) => day < l.days && l.pattern?.[slot] > 0);
      if (!due.length) continue;
      const [h, m] = SLOT_TIME[slot];
      const at = startDay.getTime() + day * 86400000 + (h * 60 + m) * 60000 - DHAKA;
      if (at < issued && day === 0) continue;
      const text = due.map((l) => `${l.name}: ${lineSummaryBn(P, { ...l, days: 0 })}`).join("\n");
      out.push(
        "BEGIN:VEVENT",
        `UID:${card.token}-${day}-${slot}@saathi`,
        `DTSTAMP:${stamp(Date.now())}`,
        `DTSTART:${stamp(at)}`,
        `DTEND:${stamp(at + 15 * 60000)}`,
        `SUMMARY:${esc(`💊 ${timeBn(P, slot)} ওষুধ খাওয়ার সময়`)}`,
        `DESCRIPTION:${esc(text)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc("ওষুধ খাওয়ার সময় হয়েছে")}`,
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT"
      );
    }
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}

export function downloadIcs(card, P) {
  const text = buildIcs(card, P);
  if (!text) return false;
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "saathi-medicine-reminders.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}
