import { TIMES } from "./templates";
import { bn } from "./bangla";

// The audio guide is a list of small pieces. Fixed pieces (words, numbers) have a "key" so a native
// speaker can record them for a dialect; pieces with patient or medicine names are always spoken by
// the device voice.

const WORDS = {
  0.5: "আধা", 1: "এক", 2: "দুই", 2.5: "আড়াই", 3: "তিন", 4: "চার", 5: "পাঁচ", 6: "ছয়", 7: "সাত", 8: "আট", 9: "নয়", 10: "দশ",
  11: "এগারো", 12: "বারো", 13: "তেরো", 14: "চৌদ্দ", 15: "পনেরো", 16: "ষোলো", 17: "সতেরো", 18: "আঠারো", 19: "ঊনিশ", 20: "বিশ",
  21: "একুশ", 22: "বাইশ", 23: "তেইশ", 24: "চব্বিশ", 25: "পঁচিশ", 26: "ছাব্বিশ", 27: "সাতাশ", 28: "আঠাশ", 29: "ঊনত্রিশ", 30: "ত্রিশ",
};

export const numberKey = (n) => `num.${String(n).replace(".", "_")}`;
export const numberText = (n) => WORDS[n] || bn(n);
export const NUMBER_VALUES = Object.keys(WORDS).map(Number);

const UNIT_KEY = { tablet: "unit.tablet", capsule: "unit.capsule", syrup: "unit.syrup", drops: "unit.drops", other: "unit.other" };

// ingredients: library ingredient list (used to add the "finish the course" sentence for antibiotics)
export function buildSpeechPlan(P, card, ingredients = []) {
  const antibiotic = new Set(ingredients.filter((i) => i.antibiotic).map((i) => i.key));
  const phrase = (key) => ({ key, text: P[key] });
  const num = (n) => ({ key: numberKey(n), text: numberText(n) });
  const dynamic = (text) => ({ key: null, text });

  const plan = [dynamic(card.patientName), phrase("guide.intro"), phrase("guide.total"), num(card.lines.length)];

  card.lines.forEach((line, i) => {
    if (line.status !== "confirmed") return;
    plan.push(phrase("guide.medicine"), num(i + 1), dynamic(`${line.name} ${line.strength || ""}`.trim()));
    for (const t of TIMES) {
      const n = line.pattern?.[t];
      if (!(n > 0)) continue;
      plan.push(phrase(`time.${t}`));
      if (line.form === "tablet" && n === 0.5) plan.push(phrase("unit.tabletHalf"));
      else plan.push(num(n), phrase(UNIT_KEY[line.form] || "unit.other"));
    }
    plan.push(phrase(`food.${line.food || "none"}`), num(line.days), phrase("days.word"));
    if (antibiotic.has(line.ingredient)) plan.push(phrase("course.finish"));
  });

  plan.push(phrase("guide.outro"));
  return plan;
}

export const planKeys = (plan) => [...new Set(plan.filter((s) => s.key).map((s) => s.key))];
