"use client";
import { SEVERITY_LABEL } from "@/lib/templates";

// DoctorGuard shows flags with a source and asks a named person to answer each one. It never blocks or decides.
// acks: { [flagKey]: { action, note } }
export default function GuardPanel({ flags, unchecked = [], acks, setAck, reviewed }) {
  return (
    <div className="stack">
      {!reviewed && <div className="notice warn small">DoctorGuard rules here are SAMPLE rules and have not been clinically reviewed. Use them as a prompt to check, never as medical advice.</div>}
      {!flags.length && <div className="notice ok">No flags from the rules in the library. This does not mean the prescription is safe.</div>}
      {flags.map((f) => {
        const a = acks[f.key] || {};
        return (
          <div key={f.key} className={`guardflag ${f.severity}`}>
            <div className="row between"><b>{f.title}</b><span className={`badge ${f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : "gray"}`}>{SEVERITY_LABEL[f.severity]}</span></div>
            <p className="small" style={{ margin: ".3rem 0" }}>{f.message}</p>
            {f.source?.url && <p className="small muted">Source: <a href={f.source.url} target="_blank" rel="noreferrer">{f.source.name}</a></p>}
            {f.ack ? (
              <div className="small"><span className="badge ok">{f.ack.action === "referred" ? "Referred" : "Reviewed"}</span> by {f.ack.by}</div>
            ) : (
              <div className="stack">
                <div className="row">
                  <label className="check"><input type="radio" name={f.key} checked={a.action === "accepted"} onChange={() => setAck(f.key, { ...a, action: "accepted" })} /> I reviewed this</label>
                  <label className="check"><input type="radio" name={f.key} checked={a.action === "referred"} onChange={() => setAck(f.key, { ...a, action: "referred" })} /> Refer to doctor</label>
                </div>
                <input placeholder={f.severity === "high" ? "Note (required if you continue: why?)" : "Note (optional)"} value={a.note || ""} maxLength={300} onChange={(e) => setAck(f.key, { ...a, note: e.target.value })} />
              </div>
            )}
          </div>
        );
      })}
      {unchecked.length > 0 && <div className="notice info small">Not checked (no library data): {unchecked.join(", ")}. Check these yourself.</div>}
    </div>
  );
}
