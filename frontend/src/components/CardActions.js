"use client";
import { useState } from "react";
import { patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import GuardPanel from "./GuardPanel";

const STAFF = ["pharmacist", "chw"];

// Everything staff or a doctor can do to a saved card. Each action calls one named backend action.
export default function CardActions({ card, onChange, reviewedRules }) {
  const { user } = useAuth();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [readBack, setReadBack] = useState(false);
  const [voidF, setVoidF] = useState({ reason: "patient_request", note: "" });
  const [acks, setAcks] = useState({});
  const [docNotes, setDocNotes] = useState({});
  const [fix, setFix] = useState({});
  const [shared, setShared] = useState((card.sharedWith || []).join(", "));
  const staff = STAFF.includes(user?.role);

  async function act(body) {
    setBusy(true); setErr("");
    try {
      const d = await patch(`/api/cards/${card.id}`, body);
      onChange(d.card);
      return true;
    } catch (e) { setErr(e.message); return false; }
    finally { setBusy(false); }
  }

  const pendingFlags = (card.guard?.flags || []).filter((f) => !f.ack);
  const referredFlags = (card.guard?.flags || []).filter((f) => f.ack?.action === "referred" && !f.ack.resolved);

  return (
    <div className="stack noprint">
      {err && <div className="notice bad">{err}</div>}

      {user?.role === "doctor" && card.lines.some((l) => l.status === "unclear") && (
        <div className="card stack">
          <h3>Lines waiting for you</h3>
          {card.lines.map((l, i) => l.status === "unclear" && (
            <div key={i} className="medline unclear">
              <b>{l.name} {l.strength}</b> <span className="small muted">({l.days} days)</span>
              <p className="small">Question: {l.note}</p>
              <div className="row">
                <button className="btn small" disabled={busy} onClick={() => act({ action: "prescriber_confirm", lineIndex: i })}>Confirm as written</button>
                <input style={{ maxWidth: 160 }} placeholder="Corrected name" value={fix[i] || ""} onChange={(e) => setFix({ ...fix, [i]: e.target.value })} />
                <button className="btn secondary small" disabled={busy || !fix[i]} onClick={() => act({ action: "prescriber_confirm", lineIndex: i, correction: { name: fix[i] } })}>Confirm with correction</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {user?.role === "doctor" && referredFlags.length > 0 && (
        <div className="card stack">
          <h3>DoctorGuard flags referred to you</h3>
          {referredFlags.map((f) => (
            <div key={f.key} className="guardflag">
              <b>{f.title}</b>
              <p className="small">{f.message} <i>Staff note: {f.ack.note || "—"}</i></p>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input placeholder="Your decision (min 5 characters)" value={docNotes[f.key] || ""} onChange={(e) => setDocNotes({ ...docNotes, [f.key]: e.target.value })} />
                <button className="btn small" disabled={busy} onClick={() => act({ action: "guard_ack", key: f.key, note: docNotes[f.key] || "" })}>Resolve</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {staff && pendingFlags.length > 0 && (
        <div className="card stack">
          <h3>DoctorGuard flags to review</h3>
          <GuardPanel flags={pendingFlags} acks={acks} setAck={(k, v) => setAcks((p) => ({ ...p, [k]: v }))} reviewed={reviewedRules} />
          <button className="btn" disabled={busy} onClick={async () => {
            for (const f of pendingFlags) {
              const a = acks[f.key];
              if (!a?.action) return setErr(`Answer the flag: ${f.title}`);
              if (!(await act({ action: "guard_ack", key: f.key, decision: a.action, note: a.note || "" }))) return;
            }
          }}>Save review</button>
        </div>
      )}

      {staff && card.status === "ready_to_issue" && (
        <div className="card stack">
          <h3>Issue this card</h3>
          <label className="check"><input type="checkbox" checked={readBack} onChange={(e) => setReadBack(e.target.checked)} /> I read this card back to the patient and they understood it.</label>
          <button className="btn" disabled={busy || !readBack} onClick={() => act({ action: "issue", readBack: true })}>Issue card as {user.name}</button>
        </div>
      )}

      {staff && card.status === "issued" && (
        <div className="card stack">
          <h3>Teach-back</h3>
          <p className="small muted">Ask the patient to explain in their own words when to take each medicine.</p>
          {card.teachBack ? <div className={`notice ${card.teachBack.result === "pass" ? "ok" : "warn"}`}>Recorded: {card.teachBack.result} by {card.teachBack.by}</div> : null}
          <div className="row">
            <button className="btn small" disabled={busy} onClick={() => act({ action: "teachback", result: "pass" })}>Patient explained it correctly</button>
            <button className="btn secondary small" disabled={busy} onClick={() => act({ action: "teachback", result: "fail" })}>Needs more explaining</button>
          </div>
        </div>
      )}

      {staff && card.status !== "voided" && (
        <div className="card stack">
          <h3>Family sharing</h3>
          <label className="check"><input type="checkbox" checked={!!card.consent?.family} onChange={(e) => act({ action: "consent", family: e.target.checked, dataUse: !!card.consent?.dataUse })} /> Patient agrees to share with family</label>
          <label className="check"><input type="checkbox" checked={!!card.consent?.dataUse} onChange={(e) => act({ action: "consent", family: !!card.consent?.family, dataUse: e.target.checked })} /> Patient agrees to de-identified pilot statistics</label>
          {card.consent?.family && (
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input value={shared} placeholder="Family emails, comma separated" onChange={(e) => setShared(e.target.value)} />
              <button className="btn secondary small" disabled={busy} onClick={() => act({ action: "share", sharedWith: shared })}>Save</button>
            </div>
          )}
        </div>
      )}

      {(staff || user?.role === "doctor") && ["issued", "ready_to_issue", "awaiting_prescriber"].includes(card.status) && (
        <details className="card">
          <summary><b>Withdraw this card</b></summary>
          <div className="stack" style={{ marginTop: ".6rem" }}>
            <select value={voidF.reason} onChange={(e) => setVoidF({ ...voidF, reason: e.target.value })}>
              <option value="patient_request">Patient asked</option>
              <option value="wrong_entry">Wrong entry (pauses new cards until an admin reviews)</option>
              <option value="other">Other</option>
            </select>
            <textarea value={voidF.note} maxLength={300} onChange={(e) => setVoidF({ ...voidF, note: e.target.value })} placeholder="Why? (min 5 characters)" />
            <button className="btn danger" disabled={busy} onClick={() => confirm("Withdraw this card? The patient's QR page will show it as cancelled.") && act({ action: "void", ...voidF })}>Withdraw card</button>
          </div>
        </details>
      )}
    </div>
  );
}
