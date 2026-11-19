import { buildPattern, inferFreqDose } from "./templates";

// Form state for one medicine line <-> API payload.
export const emptyLine = () => ({
  name: "", strength: "", form: "tablet", freq: "101", dose: 1, food: "after", days: 5, ingredient: "", unclear: false, note: "", confirmed: false,
});

export function lineToPayload(l) {
  return {
    name: l.name,
    strength: l.strength,
    form: l.form,
    food: l.food,
    days: Number(l.days),
    ingredient: l.ingredient || "",
    pattern: buildPattern(l.freq, l.dose),
    unclear: !!l.unclear,
    note: l.note || "",
    confirmed: !!l.confirmed,
  };
}

// From a stored line (card, e-prescription) back into form state.
export function lineToState(line) {
  const { freq, dose } = inferFreqDose(line.pattern);
  return {
    name: line.name?.startsWith("(") ? "" : line.name || "",
    strength: line.strength || "",
    form: line.form || "tablet",
    freq,
    dose,
    food: line.food || "after",
    days: line.days || 5,
    ingredient: line.ingredient || "",
    unclear: false,
    note: "",
  };
}
