import { ageBand } from "./views.js";
import { weekStart } from "../lib/dates.js";

// De-identified exports for NGOs and donors. Rules:
//  - only cards where the patient agreed to data use,
//  - no names, phones, emails, ids or exact ages,
//  - counts below 5 are hidden ("<5") so small groups cannot be singled out.

export const SUPPRESS_BELOW = 5;

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (header, rows) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";

export const consented = (cards) => cards.filter((c) => c.consent?.dataUse === true && c.status !== "voided");

export function cardLevelCsv(cards, orgTypeOf) {
  const header = ["week_start", "org_type", "age_band", "medicines", "unclear_flagged", "guard_flags", "created_offline", "teach_back", "creation_seconds", "course_days"];
  const rows = consented(cards).map((c) => [
    weekStart(c.createdAt),
    orgTypeOf(c.org),
    ageBand(c.patientAge),
    c.lines.length,
    c.lines.some((l) => l.prescriberQuestion || l.status === "unclear") ? "yes" : "no",
    c.guard?.flags?.length || 0,
    c.offline ? "yes" : "no",
    c.teachBack?.result || "not_done",
    c.creationSeconds ?? "",
    Math.max(0, ...c.lines.map((l) => l.days || 0)),
  ]);
  return toCsv(header, rows);
}

export function weeklySummaryCsv(cards, orgTypeOf) {
  const groups = new Map();
  for (const c of consented(cards)) {
    const key = `${weekStart(c.createdAt)}|${orgTypeOf(c.org)}`;
    const g = groups.get(key) || { n: 0, issued: 0, tbDone: 0, tbPass: 0 };
    g.n++;
    if (c.status === "issued") g.issued++;
    if (c.teachBack) {
      g.tbDone++;
      if (c.teachBack.result === "pass") g.tbPass++;
    }
    groups.set(key, g);
  }
  const hide = (n) => (n < SUPPRESS_BELOW ? `<${SUPPRESS_BELOW}` : n);
  const rows = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, g]) => {
      const [week, orgType] = key.split("|");
      const small = g.n < SUPPRESS_BELOW;
      return [week, orgType, hide(g.n), small ? "" : hide(g.issued), small || g.tbDone < SUPPRESS_BELOW ? "" : `${Math.round((g.tbPass / g.tbDone) * 100)}%`];
    });
  return toCsv(["week_start", "org_type", "cards", "issued", "teach_back_success"], rows);
}
