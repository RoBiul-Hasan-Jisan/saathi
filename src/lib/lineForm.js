import { buildPattern, inferFreqDose } from "./templates";

// Client-side form state for one medicine line <-> API payload.
export const emptyLine = () => ({
  name: "",
  strength: "",
  form: "tablet",
  freq: "101",
  dose: 1,
  food: "after",
  days: 5,
  unclear: false,
  note: "",
});

export function lineToPayload(l) {
  return {
    name: l.name,
    strength: l.strength,
    form: l.form,
    food: l.food,
    days: Number(l.days),
    pattern: buildPattern(l.freq, l.dose),
    unclear: !!l.unclear,
    note: l.note || "",
  };
}

export function lineToState(line) {
  const { freq, dose } = inferFreqDose(line.pattern);
  return {
    name: line.name,
    strength: line.strength || "",
    form: line.form,
    freq,
    dose,
    food: line.food,
    days: line.days || 5,
    unclear: false,
    note: "",
  };
}
