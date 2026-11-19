import { TIMES } from "./templates";

const DIGITS = "০১২৩৪৫৬৭৮৯";
export const bn = (n) => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);

export const TIME_BN = { morning: "সকালে", afternoon: "দুপুরে", night: "রাতে" };
export const TIME_LABEL_BN = { morning: "সকাল", afternoon: "দুপুর", night: "রাত" };
export const TIME_LABEL_EN = { morning: "Morning", afternoon: "Afternoon", night: "Night" };

export function doseText(line, n) {
  switch (line.form) {
    case "tablet":
      return n === 0.5 ? "আধা ট্যাবলেট" : `${bn(n)}টি ট্যাবলেট`;
    case "capsule":
      return `${bn(n)}টি ক্যাপসুল`;
    case "syrup":
      return `${bn(n)} মিলি`;
    case "drops":
      return `${bn(n)} ফোঁটা`;
    default:
      return `${bn(n)} মাত্রা`;
  }
}

export function foodBn(food) {
  if (food === "before") return "খাওয়ার আগে";
  if (food === "after") return "খাওয়ার পরে";
  return "খাবারের সময় নির্দিষ্ট নয়";
}

export const FOOD_ICON = { before: "🍽️", after: "🍚", none: "•" };

export function lineSummaryBn(line) {
  const parts = TIMES.filter((t) => line.pattern?.[t] > 0).map(
    (t) => `${TIME_BN[t]} ${doseText(line, line.pattern[t])}`
  );
  if (!parts.length) return "সময়সূচি নির্ধারিত হয়নি";
  const days = Number(line.days) > 0 ? `${bn(line.days)} দিন` : "";
  return [parts.join(", "), foodBn(line.food), days].filter(Boolean).join(" · ");
}

// Chunks for text-to-speech; short chunks avoid the browser cutting off long utterances.
export function speechChunksBn(card) {
  const chunks = [`${card.patientName} এর ওষুধের নির্দেশনা। মোট ${bn(card.lines.length)}টি ওষুধ।`];
  card.lines.forEach((line, i) => {
    chunks.push(`ওষুধ ${bn(i + 1)}। ${line.name} ${line.strength || ""}।`);
    chunks.push(lineSummaryBn(line).replace(/ · /g, "। ") + "।");
  });
  chunks.push("কোনো প্রশ্ন থাকলে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞেস করুন।");
  return chunks;
}
