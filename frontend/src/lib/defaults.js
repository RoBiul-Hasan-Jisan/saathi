// Built-in copy of the approved library. Used before the server answers and when the device is offline.
// The backend serves the live, clinically reviewed version at /api/library/active.

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

export const DEFAULT_INFO_PANEL = {
  titleBn: "ওষুধ রাখা ও সতর্কতা",
  itemsBn: [
    "ওষুধ ঠান্ডা, শুকনো জায়গায় এবং শিশুদের নাগালের বাইরে রাখুন।",
    "ওষুধের গায়ে লেখা নির্দেশনা থাকলে তা মেনে চলুন।",
    "কিছু বুঝতে অসুবিধা হলে ডাক্তার বা ফার্মাসিস্টকে জিজ্ঞেস করুন।",
    "শ্বাসকষ্ট, মুখ বা গলা ফুলে যাওয়া অথবা গুরুতর অসুস্থ লাগলে সঙ্গে সঙ্গে হাসপাতালে যান।",
  ],
};

export const DEFAULT_DIALECTS = [
  { code: "std", name: "Standard Bangla" },
  { code: "ctg", name: "Chattogram" },
  { code: "syl", name: "Sylheti" },
  { code: "noa", name: "Noakhali" },
];
