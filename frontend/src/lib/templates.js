// Approved choices for the card form (staff pick from these instead of typing free text).
// Keep in sync with backend/src/domain/constants.js, which enforces the same lists.

export const TIMES = ["morning", "afternoon", "night"];

export const FORMS = [
  { key: "tablet", en: "Tablet", unit: "tablet(s)" },
  { key: "capsule", en: "Capsule", unit: "capsule(s)" },
  { key: "syrup", en: "Syrup / liquid", unit: "ml" },
  { key: "drops", en: "Drops", unit: "drop(s)" },
  { key: "other", en: "Other (1 dose)", unit: "dose(s)" },
];

export const FREQUENCIES = [
  { key: "100", en: "Morning only", mask: [1, 0, 0] },
  { key: "010", en: "Afternoon only", mask: [0, 1, 0] },
  { key: "001", en: "Night only", mask: [0, 0, 1] },
  { key: "101", en: "Morning + Night", mask: [1, 0, 1] },
  { key: "110", en: "Morning + Afternoon", mask: [1, 1, 0] },
  { key: "011", en: "Afternoon + Night", mask: [0, 1, 1] },
  { key: "111", en: "Morning + Afternoon + Night", mask: [1, 1, 1] },
];

export const DOSE_OPTIONS = {
  tablet: [0.5, 1, 2],
  capsule: [1, 2],
  syrup: [2.5, 5, 10, 15],
  drops: [1, 2, 3, 5],
  other: [1, 2],
};

export const FOOD_OPTIONS = [
  { key: "after", en: "After food" },
  { key: "before", en: "Before food" },
  { key: "none", en: "Not specified" },
];

export const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 10, 14, 15, 21, 28, 30];

export function buildPattern(freqKey, dose) {
  const f = FREQUENCIES.find((x) => x.key === freqKey) || FREQUENCIES[3];
  const d = Number(dose) || 0;
  return { morning: f.mask[0] * d, afternoon: f.mask[1] * d, night: f.mask[2] * d };
}

export function inferFreqDose(pattern) {
  const mask = TIMES.map((t) => (pattern?.[t] > 0 ? 1 : 0)).join("");
  const dose = Math.max(0, ...TIMES.map((t) => pattern?.[t] || 0));
  return { freq: FREQUENCIES.some((f) => f.key === mask) ? mask : "101", dose: dose || 1 };
}

export const SEVERITY_LABEL = { high: "High", medium: "Medium", low: "Low" };
