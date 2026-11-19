"use client";
import { DAY_OPTIONS, DOSE_OPTIONS, FOOD_OPTIONS, FORMS, FREQUENCIES } from "@/lib/templates";
import { matchIngredient } from "@/lib/rxscan";

// One medicine line. Everything except the name is picked from approved lists.
export default function LineFields({ index, line, onChange, onRemove, canRemove, ingredients }) {
  const set = (patch) => onChange({ ...line, ...patch });
  const doses = DOSE_OPTIONS[line.form] || [1];
  const unit = FORMS.find((f) => f.key === line.form)?.unit;
  const listId = `ing-${index}`;

  return (
    <div className={`medline ${line.unclear ? "unclear" : ""}`}>
      <div className="row between">
        <b>Medicine {index + 1}</b>
        {canRemove && <button type="button" className="btn secondary small" onClick={onRemove}>Remove</button>}
      </div>
      <div className="grid" style={{ marginTop: ".5rem" }}>
        <div className="field">
          <label>Name (copy exactly from the prescription)</label>
          <input list={listId} value={line.name} maxLength={80} onChange={(e) => set({ name: e.target.value, ingredient: matchIngredient(e.target.value, ingredients) || line.ingredient })} required />
          <datalist id={listId}>{ingredients.map((i) => <option key={i.key} value={i.nameEn} />)}</datalist>
          {line.ingredient && <div className="small muted">Matched to library: {line.ingredient}</div>}
        </div>
        <div className="field">
          <label>Strength (e.g. 500 mg)</label>
          <input value={line.strength} maxLength={30} onChange={(e) => set({ strength: e.target.value })} />
        </div>
        <div className="field">
          <label>Form</label>
          <select value={line.form} onChange={(e) => set({ form: e.target.value, dose: (DOSE_OPTIONS[e.target.value] || [1])[0] === line.dose ? line.dose : (DOSE_OPTIONS[e.target.value] || [1]).includes(line.dose) ? line.dose : (DOSE_OPTIONS[e.target.value] || [1])[0] })}>
            {FORMS.map((f) => <option key={f.key} value={f.key}>{f.en}</option>)}
          </select>
        </div>
        <div className="field">
          <label>When</label>
          <select value={line.freq} onChange={(e) => set({ freq: e.target.value })}>
            {FREQUENCIES.map((f) => <option key={f.key} value={f.key}>{f.en}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Each time ({unit})</label>
          <select value={line.dose} onChange={(e) => set({ dose: Number(e.target.value) })}>
            {doses.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Food</label>
          <select value={line.food} onChange={(e) => set({ food: e.target.value })}>
            {FOOD_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.en}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Days</label>
          <select value={line.days} onChange={(e) => set({ days: Number(e.target.value) })}>
            {[...new Set([...DAY_OPTIONS, line.days])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      <label className="check" style={{ marginTop: ".6rem" }}>
        <input type="checkbox" checked={line.unclear} onChange={(e) => set({ unclear: e.target.checked, confirmed: false })} />
        I cannot read this line clearly: send it to a doctor
      </label>
      {line.unclear ? (
        <div className="field"><label>Question for the doctor</label><textarea value={line.note} maxLength={300} onChange={(e) => set({ note: e.target.value })} /></div>
      ) : (
        <label className="check" style={{ marginTop: ".4rem" }}>
          <input type="checkbox" checked={line.confirmed} onChange={(e) => set({ confirmed: e.target.checked })} />
          I checked this line against the prescription paper
        </label>
      )}
    </div>
  );
}
