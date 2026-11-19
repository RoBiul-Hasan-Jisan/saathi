// The approved library: Bangla phrases, the fixed info panel, the ingredient dictionary and the
// DoctorGuard rules. Version 1 below is SAMPLE content. It is shown as "not clinically reviewed"
// until the clinical panel (a doctor) approves a version through the review workflow.

export const KINDS = ["phrases", "infoPanel", "ingredients", "rules"];

export const DEFAULT_PHRASES = {
  "guide.intro": "ওষুধের নির্দেশনা শুনুন।",
  "guide.total": "মোট ওষুধ",
  "guide.medicine": "ওষুধ",
  "guide.outro": "কোনো প্রশ্ন থাকলে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞেস করুন।",
  "time.morning": "সকালে",
  "time.afternoon": "দুপুরে",
  "time.night": "রাতে",
  "timeLabel.morning": "সকাল",
  "timeLabel.afternoon": "দুপুর",
  "timeLabel.night": "রাত",
  "unit.tablet": "টি ট্যাবলেট",
  "unit.tabletHalf": "আধা ট্যাবলেট",
  "unit.capsule": "টি ক্যাপসুল",
  "unit.syrup": "মিলি",
  "unit.drops": "ফোঁটা",
  "unit.other": "মাত্রা",
  "food.before": "খাওয়ার আগে",
  "food.after": "খাওয়ার পরে",
  "food.none": "খাবারের সময় নির্দিষ্ট নয়",
  "days.word": "দিন",
  "course.finish": "ডাক্তারের নির্দেশমতো পুরো কোর্স শেষ করুন।",
};

// Keys the audio guide speaks (and that a voice artist can record). timeLabel.* is display-only.
export const SPOKEN_PHRASE_KEYS = Object.keys(DEFAULT_PHRASES).filter((k) => !k.startsWith("timeLabel."));

// Numbers the guide can speak as recordable clips.
export const NUMBER_VALUES = [0.5, 1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
export const numberKey = (n) => `num.${String(n).replace(".", "_")}`;
export const NUMBER_KEYS = NUMBER_VALUES.map(numberKey);
export const ALL_CLIP_KEYS = [...SPOKEN_PHRASE_KEYS, ...NUMBER_KEYS];

export const DEFAULT_INFO_PANEL = {
  titleBn: "ওষুধ রাখা ও সতর্কতা",
  itemsBn: [
    "ওষুধ ঠান্ডা, শুকনো জায়গায় এবং শিশুদের নাগালের বাইরে রাখুন।",
    "ওষুধের গায়ে লেখা নির্দেশনা থাকলে তা মেনে চলুন।",
    "কিছু বুঝতে অসুবিধা হলে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞেস করুন।",
    "শ্বাসকষ্ট, মুখ বা গলা ফুলে যাওয়া অথবা গুরুতর অসুস্থ লাগলে সঙ্গে সঙ্গে হাসপাতালে যান।",
  ],
};

const WHO = {
  name: "WHO Model List of Essential Medicines (sample reference)",
  url: "https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines/essential-medicines-lists",
};
const NHS_PCM = { name: "NHS: paracetamol for adults (sample reference)", url: "https://www.nhs.uk/medicines/paracetamol-for-adults/" };
const NHS_IBU = { name: "NHS: ibuprofen for adults (sample reference)", url: "https://www.nhs.uk/medicines/ibuprofen-for-adults/" };

export const DEFAULT_INGREDIENTS = [
  { key: "paracetamol", nameEn: "Paracetamol", nameBn: "প্যারাসিটামল", aliases: ["acetaminophen"], class: "analgesic", antibiotic: false, source: NHS_PCM },
  { key: "ibuprofen", nameEn: "Ibuprofen", nameBn: "আইবুপ্রোফেন", aliases: [], class: "nsaid", antibiotic: false, source: NHS_IBU },
  { key: "aspirin", nameEn: "Aspirin", nameBn: "অ্যাসপিরিন", aliases: ["acetylsalicylic acid"], class: "nsaid", antibiotic: false, source: WHO },
  { key: "diclofenac", nameEn: "Diclofenac", nameBn: "ডাইক্লোফেনাক", aliases: [], class: "nsaid", antibiotic: false, source: WHO },
  { key: "amoxicillin", nameEn: "Amoxicillin", nameBn: "অ্যামোক্সিসিলিন", aliases: [], class: "penicillin", antibiotic: true, source: WHO },
  { key: "azithromycin", nameEn: "Azithromycin", nameBn: "অ্যাজিথ্রোমাইসিন", aliases: [], class: "macrolide", antibiotic: true, source: WHO },
  { key: "metronidazole", nameEn: "Metronidazole", nameBn: "মেট্রোনিডাজল", aliases: [], class: "nitroimidazole", antibiotic: true, source: WHO },
  { key: "cetirizine", nameEn: "Cetirizine", nameBn: "সেটিরিজিন", aliases: [], class: "antihistamine", antibiotic: false, source: WHO },
  { key: "omeprazole", nameEn: "Omeprazole", nameBn: "ওমেপ্রাজল", aliases: [], class: "ppi", antibiotic: false, source: WHO },
];

export const DEFAULT_RULES = [
  { id: "allergy-penicillin", type: "allergyMap", allergy: "penicillin", covers: ["penicillin"], source: WHO },
  { id: "allergy-penicillins", type: "allergyMap", allergy: "penicillins", covers: ["penicillin"], source: WHO },
  { id: "allergy-nsaid", type: "allergyMap", allergy: "nsaid", covers: ["nsaid"], source: WHO },
  { id: "allergy-nsaids", type: "allergyMap", allergy: "nsaids", covers: ["nsaid"], source: WHO },
  {
    id: "dup-nsaid", type: "classDuplicate", class: "nsaid", severity: "medium",
    message: "Two different NSAID medicines are on this plan or on an active card. Combining NSAIDs needs prescriber review.",
    source: WHO,
  },
  {
    id: "inter-ibuprofen-aspirin", type: "interaction", a: "ibuprofen", b: "aspirin", severity: "medium",
    message: "Ibuprofen and aspirin are listed together as an interaction to confirm with the prescriber.",
    source: NHS_IBU,
  },
  {
    id: "max-paracetamol", type: "maxDaily", ingredient: "paracetamol", maxDailyMg: 4000, ageMin: 16, severity: "high",
    message: "Total paracetamol per day is above the adult maximum used by this rule. Children are different: the prescriber must confirm.",
    source: NHS_PCM,
  },
];

export const DEFAULT_CONTENT = {
  phrases: DEFAULT_PHRASES,
  infoPanel: DEFAULT_INFO_PANEL,
  ingredients: DEFAULT_INGREDIENTS,
  rules: DEFAULT_RULES,
};
