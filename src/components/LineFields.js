"use client";
import { FORMS, FREQUENCIES, DOSE_OPTIONS, FOOD_OPTIONS, DAY_OPTIONS } from "@/lib/templates";

// One medicine line. Schedule fields are approved templates (dropdowns), not free text.
export default function LineFields({ value: l, onChange, showUnclear = true }) {
  const doses = DOSE_OPTIONS[l.form] || [1];
  const unit = FORMS.find((f) => f.key === l.form)?.unit || "";

  function changeForm(e) {
    const form = e.target.value;
    const opts = DOSE_OPTIONS[form] || [1];
    onChange({ form, dose: opts.includes(Number(l.dose)) ? l.dose : opts[0] });
  }

  return (
    <div className="grid-fields">
      <label className="f-wide">
        Medicine name (copy exactly from the prescription)
        <input value={l.name} onChange={(e) => onChange({ name: e.target.value })} maxLength={80} />
      </label>
      <label>
        Strength
        <input value={l.strength} onChange={(e) => onChange({ strength: e.target.value })} placeholder="e.g. 500 mg" maxLength={30} />
      </label>
      <label>
        Form
        <select value={l.form} onChange={changeForm}>
          {FORMS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.en}
            </option>
          ))}
        </select>
      </label>
      <label>
        When
        <select value={l.freq} onChange={(e) => onChange({ freq: e.target.value })}>
          {FREQUENCIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.en}
            </option>
          ))}
        </select>
      </label>
      <label>
        Amount each time
        <select value={l.dose} onChange={(e) => onChange({ dose: Number(e.target.value) })}>
          {doses.map((d) => (
            <option key={d} value={d}>
              {d} {unit}
            </option>
          ))}
        </select>
      </label>
      <label>
        With food
        <select value={l.food} onChange={(e) => onChange({ food: e.target.value })}>
          {FOOD_OPTIONS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.en}
            </option>
          ))}
        </select>
      </label>
      <label>
        Days
        <select value={l.days} onChange={(e) => onChange({ days: Number(e.target.value) })}>
          {DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      {showUnclear && (
        <div className="f-wide unclear-box">
          <label className="check">
            <input type="checkbox" checked={l.unclear} onChange={(e) => onChange({ unclear: e.target.checked })} />
            Handwriting or instruction is unclear — ask the prescriber (never guess)
          </label>
          {l.unclear && (
            <textarea
              placeholder="What exactly needs confirming? e.g. name, dose, timing or number of days"
              value={l.note}
              onChange={(e) => onChange({ note: e.target.value })}
              maxLength={300}
              rows={2}
            />
          )}
        </div>
      )}
    </div>
  );
}
