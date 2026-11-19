"use client";
import { useState } from "react";
import { post } from "@/lib/api";

// Anyone holding the card can tell the care team about a reaction. There is no AI answer: a person follows up.
export default function ReportProblem({ token }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ feeling: "mild", description: "", contactOk: false, contactPhone: "" });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      setRes(await post(`/api/public/cards/${token}/incidents`, f));
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  }

  if (res)
    return <div className={`notice ${res.urgent ? "bad" : "ok"}`}><b>{res.message}</b></div>;

  return (
    <div className="card noprint">
      {!open ? (
        <button className="btn secondary" onClick={() => setOpen(true)}>Feeling unwell after this medicine? Tell the pharmacy</button>
      ) : (
        <form onSubmit={send} className="stack">
          <h3>Tell the care team</h3>
          <div className="notice bad small">Trouble breathing, swollen face or throat, fainting, or feeling very sick: go to a hospital now. Do not wait for a reply.</div>
          <div className="field">
            <label>How bad is it?</label>
            <select value={f.feeling} onChange={(e) => setF({ ...f, feeling: e.target.value })}>
              <option value="mild">A little unwell (mild)</option>
              <option value="worried">I am worried</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="field">
            <label>What happened? (a few words)</label>
            <textarea required minLength={5} value={f.description} maxLength={600} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
          <label className="check"><input type="checkbox" checked={f.contactOk} onChange={(e) => setF({ ...f, contactOk: e.target.checked })} /> The pharmacy may contact me</label>
          {f.contactOk && <div className="field"><label>Phone number</label><input value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} inputMode="tel" /></div>}
          {err && <div className="notice bad">{err}</div>}
          <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
        </form>
      )}
    </div>
  );
}
