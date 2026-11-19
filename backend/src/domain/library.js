import { ValidationError } from "../lib/errors.js";
import { clean } from "../lib/validate.js";
import { DEFAULT_CONTENT, DEFAULT_PHRASES, KINDS } from "./defaultLibrary.js";

const KEY = /^[a-z0-9_-]{2,40}$/;
const SEVERITIES = ["high", "medium", "low"];

function cleanSource(s) {
  if (!s || typeof s !== "object") return { name: "", url: "" };
  const url = clean(s.url, 300);
  if (url && !/^https?:\/\//i.test(url)) throw new ValidationError("Source links must start with http:// or https://");
  return { name: clean(s.name, 120), url };
}

function cleanSeverity(v) {
  return SEVERITIES.includes(v) ? v : "medium";
}

// Returns a cleaned copy of `content` for the kind, or throws ValidationError with a plain message.
export function validateContent(kind, content) {
  if (!KINDS.includes(kind)) throw new ValidationError("Unknown library section.");

  if (kind === "phrases") {
    if (!content || typeof content !== "object") throw new ValidationError("Phrases must be an object.");
    const out = {};
    for (const key of Object.keys(DEFAULT_PHRASES)) {
      const v = clean(content[key] ?? DEFAULT_PHRASES[key], 200);
      if (!v) throw new ValidationError(`The phrase "${key}" cannot be empty.`);
      out[key] = v;
    }
    return out;
  }

  if (kind === "infoPanel") {
    const title = clean(content?.titleBn, 80);
    const items = (Array.isArray(content?.itemsBn) ? content.itemsBn : []).map((s) => clean(s, 220)).filter(Boolean);
    if (!title || items.length < 1 || items.length > 10) throw new ValidationError("The info panel needs a title and 1 to 10 lines.");
    return { titleBn: title, itemsBn: items };
  }

  if (!Array.isArray(content) || content.length > 200) throw new ValidationError("Expected a list with at most 200 entries.");

  if (kind === "ingredients") {
    const seen = new Set();
    return content.map((raw) => {
      const key = clean(raw?.key, 40).toLowerCase();
      if (!KEY.test(key)) throw new ValidationError(`Ingredient key "${key}" must be 2 to 40 letters, numbers, - or _.`);
      if (seen.has(key)) throw new ValidationError(`Ingredient "${key}" is listed twice.`);
      seen.add(key);
      const nameEn = clean(raw?.nameEn, 80);
      if (!nameEn) throw new ValidationError(`Ingredient "${key}" needs an English name.`);
      const aliases = (Array.isArray(raw?.aliases) ? raw.aliases : String(raw?.aliases ?? "").split(","))
        .map((a) => clean(a, 60).toLowerCase())
        .filter(Boolean)
        .slice(0, 10);
      return {
        key,
        nameEn,
        nameBn: clean(raw?.nameBn, 80),
        aliases,
        class: clean(raw?.class, 30).toLowerCase(),
        antibiotic: raw?.antibiotic === true,
        source: cleanSource(raw?.source),
      };
    });
  }

  // rules
  const ids = new Set();
  return content.map((raw, i) => {
    const id = clean(raw?.id, 60).toLowerCase() || `rule-${i + 1}`;
    if (!KEY.test(id)) throw new ValidationError(`Rule id "${id}" must be 2 to 60 letters, numbers, - or _.`);
    if (ids.has(id)) throw new ValidationError(`Rule id "${id}" is used twice.`);
    ids.add(id);
    const base = { id, type: raw?.type, source: cleanSource(raw?.source) };
    switch (raw?.type) {
      case "allergyMap": {
        const allergy = clean(raw.allergy, 60).toLowerCase();
        const covers = (Array.isArray(raw.covers) ? raw.covers : String(raw.covers ?? "").split(","))
          .map((c) => clean(c, 40).toLowerCase())
          .filter(Boolean);
        if (!allergy || !covers.length) throw new ValidationError(`Rule "${id}": give the allergy term and what it covers.`);
        return { ...base, allergy, covers };
      }
      case "classDuplicate": {
        const cls = clean(raw.class, 30).toLowerCase();
        if (!cls) throw new ValidationError(`Rule "${id}": choose a class.`);
        return { ...base, class: cls, severity: cleanSeverity(raw.severity), message: clean(raw.message, 300) };
      }
      case "interaction": {
        const a = clean(raw.a, 40).toLowerCase();
        const b = clean(raw.b, 40).toLowerCase();
        if (!a || !b) throw new ValidationError(`Rule "${id}": give both ingredients or classes.`);
        return { ...base, a, b, severity: cleanSeverity(raw.severity), message: clean(raw.message, 300) };
      }
      case "maxDaily": {
        const ingredient = clean(raw.ingredient, 40).toLowerCase();
        const maxDailyMg = Number(raw.maxDailyMg);
        const ageMin = raw.ageMin === "" || raw.ageMin == null ? 0 : Number(raw.ageMin);
        if (!ingredient || !(maxDailyMg > 0) || !(ageMin >= 0)) throw new ValidationError(`Rule "${id}": give an ingredient and a daily maximum in mg.`);
        return { ...base, ingredient, maxDailyMg, ageMin, severity: cleanSeverity(raw.severity), message: clean(raw.message, 300) };
      }
      default:
        throw new ValidationError(`Rule "${id}" has an unknown type.`);
    }
  });
}

// Active content = the newest APPROVED version of each section. `meta` says whether a clinician signed it off.
export function activeLibrary(docs) {
  const out = { content: {}, meta: {} };
  for (const kind of KINDS) {
    const approved = docs.filter((d) => d.kind === kind && d.status === "approved").sort((a, b) => b.version - a.version)[0];
    out.content[kind] = approved ? approved.content : DEFAULT_CONTENT[kind];
    out.meta[kind] = {
      version: approved?.version ?? 0,
      reviewed: !!approved?.reviewedBy,
      reviewedBy: approved?.reviewedBy?.name ?? null,
      reviewedAt: approved?.reviewedAt ?? null,
    };
  }
  return out;
}
