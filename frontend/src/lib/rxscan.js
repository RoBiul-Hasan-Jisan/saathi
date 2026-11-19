"use client";

// RxScan: reads a photo of the prescription and SUGGESTS medicine names from the approved ingredient
// library. It never fills in doses and never decides anything: a person still types and verifies every line.
// The photo is processed inside this browser and is never uploaded or stored.

export async function ocrImage(file, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: (m) => onProgress?.(m) });
  try {
    const { data } = await worker.recognize(file);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

function distance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

// Returns [{ ingredient, matched, exact }] for words in `text` that look like a library medicine.
export function suggestMedicines(text, ingredients) {
  const words = [...new Set((String(text).toLowerCase().match(/[a-z]{4,}/g) || []))];
  const found = new Map();
  for (const ing of ingredients) {
    const names = [ing.key, ing.nameEn, ...(ing.aliases || [])].map((n) => String(n).toLowerCase()).filter((n) => n.length >= 4);
    for (const word of words) {
      for (const name of names) {
        const exact = word === name;
        const close = !exact && name.length >= 7 && Math.abs(word.length - name.length) <= 1 && distance(word, name) <= 1;
        if ((exact || close) && (!found.has(ing.key) || exact)) found.set(ing.key, { ingredient: ing, matched: word, exact });
      }
    }
  }
  return [...found.values()];
}

// Typing a name that matches the library links the line to its ingredient (used by DoctorGuard).
export function matchIngredient(name, ingredients) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return "";
  const hit = ingredients.find((i) => [i.key, i.nameEn, ...(i.aliases || [])].some((x) => String(x).toLowerCase() === n));
  return hit ? hit.key : "";
}
