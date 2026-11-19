import { TIMES } from "./templates";

// All wording comes from the approved phrase library (P = library.phrases), so a clinically
// approved change in the library changes the card, the audio script and the printout together.

const DIGITS = "০১২৩৪৫৬৭৮৯";
export const bn = (n) => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);

export const timeBn = (P, t) => P[`time.${t}`];
export const timeLabelBn = (P, t) => P[`timeLabel.${t}`];
export const TIME_LABEL_EN = { morning: "Morning", afternoon: "Afternoon", night: "Night" };

export function doseText(P, line, n) {
  switch (line.form) {
    case "tablet":
      return n === 0.5 ? P["unit.tabletHalf"] : `${bn(n)}${P["unit.tablet"]}`;
    case "capsule":
      return `${bn(n)}${P["unit.capsule"]}`;
    case "syrup":
      return `${bn(n)} ${P["unit.syrup"]}`;
    case "drops":
      return `${bn(n)} ${P["unit.drops"]}`;
    default:
      return `${bn(n)} ${P["unit.other"]}`;
  }
}

export const foodBn = (P, food) => P[`food.${food}`] || P["food.none"];

export function lineSummaryBn(P, line) {
  const parts = TIMES.filter((t) => line.pattern?.[t] > 0).map((t) => `${timeBn(P, t)} ${doseText(P, line, line.pattern[t])}`);
  if (!parts.length) return "—";
  const days = Number(line.days) > 0 ? `${bn(line.days)} ${P["days.word"]}` : "";
  return [parts.join(", "), foodBn(P, line.food), days].filter(Boolean).join(" · ");
}
