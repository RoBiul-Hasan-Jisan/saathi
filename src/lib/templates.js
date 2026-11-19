// Approved building blocks. Pharmacists pick from these instead of free typing.
// In a real deployment this library needs clinical sign-off before use.

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
  return {
    freq: FREQUENCIES.some((f) => f.key === mask) ? mask : "101",
    dose: dose || 1,
  };
}

// Fixed notes printed on every card. They MUST be reviewed by the clinical advisory
// panel before live use; the card shows a "not yet reviewed" badge until `reviewed` is true.
export const INFO_PANEL = {
  reviewed: false,
  titleBn: "ওষুধ রাখা ও সতর্কতা",
  itemsBn: [
    "ওষুধ ঠান্ডা, শুকনো জায়গায় এবং শিশুদের নাগালের বাইরে রাখুন।",
    "ওষুধের গায়ে লেখা নির্দেশনা থাকলে তা মেনে চলুন।",
    "কিছু বুঝতে অসুবিধা হলে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞেস করুন।",
    "শ্বাসকষ্ট, মুখ বা গলা ফুলে যাওয়া অথবা গুরুতর অসুস্থ লাগলে সঙ্গে সঙ্গে হাসপাতালে যান।",
  ],
};
