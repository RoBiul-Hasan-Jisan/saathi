"use client";
import { useState } from "react";
import { ocrImage, suggestMedicines } from "@/lib/rxscan";

// Photo → suggested medicine names only. A person still enters and verifies every line.
export default function RxScan({ ingredients, onPick }) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [hits, setHits] = useState(null);
  const [err, setErr] = useState("");

  async function run(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(""); setHits(null);
    try {
      const text = await ocrImage(file, (m) => m.status === "recognizing text" && setProg(Math.round(m.progress * 100)));
      setHits(suggestMedicines(text, ingredients));
    } catch {
      setErr("Could not read the photo. Reading needs internet the first time (it downloads language data). You can type the names instead.");
    }
    setBusy(false);
    e.target.value = "";
  }

  return (
    <div className="card tight noprint">
      <b>RxScan (optional)</b>
      <p className="small muted">Take a photo of the prescription. The app only suggests medicine names it knows. You still type doses and check every line. The photo stays on this device.</p>
      <input type="file" accept="image/*" capture="environment" onChange={run} disabled={busy} />
      {busy && <p className="small">Reading… {prog}%</p>}
      {err && <div className="notice bad small">{err}</div>}
      {hits && (hits.length ? (
        <div className="row" style={{ marginTop: ".5rem" }}>
          {hits.map((h) => <button type="button" key={h.ingredient.key} className="btn secondary small" onClick={() => onPick(h.ingredient)}>+ {h.ingredient.nameEn}{h.exact ? "" : " (?)"}</button>)}
        </div>
      ) : <p className="small">No known medicine names found. Type them manually.</p>)}
    </div>
  );
}
