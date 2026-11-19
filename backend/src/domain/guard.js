import { TIMES } from "./constants.js";

// DoctorGuard: flags and explains. It never blocks and never decides. A named person has to
// acknowledge every flag (or refer the line to the prescriber), and that is logged on the card.

const norm = (s) => String(s || "").trim().toLowerCase();

// "500 mg", "1 g", "125 mg/5 ml"  ->  { mg, perMl }
export function parseStrength(text) {
  const m = /(\d+(?:\.\d+)?)\s*(mg|g|mcg)\b(?:\s*\/\s*(\d+(?:\.\d+)?)\s*ml)?/i.exec(String(text || ""));
  if (!m) return null;
  const factor = { mg: 1, g: 1000, mcg: 0.001 }[m[2].toLowerCase()];
  const mg = Number(m[1]) * factor;
  return { mg, perMl: m[3] ? mg / Number(m[3]) : null };
}

// Milligrams per day for one line, or null when it cannot be worked out.
export function dailyMg(line) {
  const s = parseStrength(line.strength);
  if (!s) return null;
  let perUnit = null;
  if (line.form === "tablet" || line.form === "capsule") perUnit = s.mg;
  else if (line.form === "syrup") perUnit = s.perMl;
  if (perUnit == null) return null;
  return TIMES.reduce((sum, t) => sum + (line.pattern?.[t] || 0) * perUnit, 0);
}

function buildIndex(ingredients) {
  const byKey = new Map();
  const byName = new Map();
  for (const ing of ingredients) {
    byKey.set(ing.key, ing);
    for (const n of [ing.key, ing.nameEn, ...(ing.aliases || [])]) if (n) byName.set(norm(n), ing);
  }
  return { byKey, byName };
}

function resolve(line, idx) {
  if (line.ingredient && idx.byKey.has(line.ingredient)) return idx.byKey.get(line.ingredient);
  const name = norm(line.name);
  if (idx.byName.has(name)) return idx.byName.get(name);
  // whole-word match inside a longer name, e.g. "Paracetamol 500 tablet"
  for (const [alias, ing] of idx.byName) {
    if (alias.length >= 4 && new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(name)) return ing;
  }
  return null;
}

const matchesRef = (ing, ref) => ing.key === ref || ing.class === ref;

/**
 * lines:        the lines being entered (sanitised)
 * patient:      { allergies: string[], ageYears: number|null }
 * activeCards:  other cards of the same patient whose course is still running
 * library:      { ingredients, rules }
 * Returns { flags, unchecked }.
 */
export function runGuard({ lines, patient = {}, activeCards = [], library }) {
  const idx = buildIndex(library.ingredients || []);
  const rules = library.rules || [];
  const flags = [];
  const unchecked = [];

  const current = lines.map((line, i) => ({ line, i, ing: resolve(line, idx), where: "this card" }));
  const others = [];
  for (const card of activeCards) {
    const when = (card.issuedAt || card.createdAt || "").slice(0, 10);
    for (const line of card.lines || []) {
      if (line.status !== "confirmed") continue;
      others.push({ line, i: -1, ing: resolve(line, idx), where: `the card issued on ${when}` });
    }
  }
  const all = [...current, ...others];

  for (const c of current) {
    if (!c.ing) unchecked.push({ line: c.i, reason: "Medicine is not in the ingredient library, so it could not be checked." });
  }

  const add = (flag) => {
    if (!flags.some((f) => f.key === flag.key)) flags.push(flag);
  };
  const src = (rule, ing) => rule?.source?.name || rule?.source?.url ? rule.source : ing?.source || { name: "", url: "" };

  // 1) Allergy
  const allergies = (patient.allergies || []).map(norm).filter(Boolean);
  for (const term of allergies) {
    const maps = rules.filter((r) => r.type === "allergyMap" && norm(r.allergy) === term);
    for (const c of current) {
      if (!c.ing) continue;
      const direct = [c.ing.key, norm(c.ing.nameEn), c.ing.class, ...(c.ing.aliases || [])].includes(term);
      const viaRule = maps.find((r) => r.covers.some((cv) => matchesRef(c.ing, cv)));
      if (direct || viaRule) {
        add({
          key: `allergy|${term}|${c.i}`, kind: "allergy", severity: "high",
          title: `Recorded allergy: ${term}`,
          message: `Line ${c.i + 1} (${c.ing.nameEn}) matches the patient's recorded allergy "${term}".`,
          lines: [c.i], ruleId: viaRule?.id || null, source: src(viaRule, c.ing),
        });
      }
    }
  }

  // 2) Same ingredient twice (within this card or with a still-active card)
  const byIng = new Map();
  for (const e of all) if (e.ing) byIng.set(e.ing.key, [...(byIng.get(e.ing.key) || []), e]);
  for (const [key, group] of byIng) {
    if (group.length < 2 || !group.some((e) => e.i >= 0)) continue;
    const ing = group[0].ing;
    const lineIdx = group.filter((e) => e.i >= 0).map((e) => e.i);
    add({
      key: `dup|${key}`, kind: "duplicate", severity: "medium",
      title: `Same active ingredient more than once: ${ing.nameEn}`,
      message: `${ing.nameEn} appears ${group.length} times (${group.map((e) => (e.i >= 0 ? `line ${e.i + 1}` : e.where)).join(", ")}).`,
      lines: lineIdx, ruleId: null, source: ing.source || { name: "", url: "" },
    });
  }

  // 3) Rules
  for (const rule of rules) {
    if (rule.type === "classDuplicate") {
      const inClass = all.filter((e) => e.ing && e.ing.class === rule.class);
      const distinct = new Set(inClass.map((e) => e.ing.key));
      if (distinct.size >= 2 && inClass.some((e) => e.i >= 0)) {
        add({
          key: `classdup|${rule.id}`, kind: "classDuplicate", severity: rule.severity,
          title: `More than one ${rule.class} medicine`,
          message: rule.message || `Several ${rule.class} medicines are active together.`,
          lines: inClass.filter((e) => e.i >= 0).map((e) => e.i), ruleId: rule.id, source: src(rule),
        });
      }
    }
    if (rule.type === "interaction") {
      const as = all.filter((e) => e.ing && matchesRef(e.ing, rule.a));
      const bs = all.filter((e) => e.ing && matchesRef(e.ing, rule.b));
      const pairs = as.flatMap((a) => bs.filter((b) => b.ing.key !== a.ing.key && (a.i >= 0 || b.i >= 0)).map((b) => [a, b]));
      if (pairs.length) {
        add({
          key: `inter|${rule.id}`, kind: "interaction", severity: rule.severity,
          title: `Interaction to confirm: ${rule.a} + ${rule.b}`,
          message: rule.message || `${rule.a} and ${rule.b} are listed as an interaction.`,
          lines: [...new Set(pairs.flat().filter((e) => e.i >= 0).map((e) => e.i))], ruleId: rule.id, source: src(rule),
        });
      }
    }
    if (rule.type === "maxDaily") {
      const ofIng = all.filter((e) => e.ing && e.ing.key === rule.ingredient);
      if (!ofIng.some((e) => e.i >= 0)) continue;
      if (patient.ageYears != null && patient.ageYears < (rule.ageMin || 0)) {
        for (const e of ofIng.filter((x) => x.i >= 0)) {
          unchecked.push({ line: e.i, reason: `Daily-dose rule for ${rule.ingredient} applies from age ${rule.ageMin}; child doses were not checked.` });
        }
        continue;
      }
      let total = 0;
      let unreadable = false;
      for (const e of ofIng) {
        const mg = dailyMg(e.line);
        if (mg == null) {
          unreadable = true;
          if (e.i >= 0) unchecked.push({ line: e.i, reason: "Strength could not be read, so the daily total was not checked." });
        } else total += mg;
      }
      if (!unreadable && total > rule.maxDailyMg) {
        add({
          key: `maxdaily|${rule.id}`, kind: "maxDaily", severity: rule.severity || "high",
          title: `Daily total above ${rule.maxDailyMg} mg (${rule.ingredient})`,
          message: `${rule.message || "Daily total is above the maximum in this rule."} Calculated total: ${Math.round(total)} mg per day.`,
          lines: ofIng.filter((e) => e.i >= 0).map((e) => e.i), ruleId: rule.id, source: src(rule),
        });
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  flags.sort((a, b) => order[a.severity] - order[b.severity] || a.key.localeCompare(b.key));
  return { flags, unchecked };
}
