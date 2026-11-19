"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, patch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, titleCase } from "@/lib/format";

const SEV = { mild: "gray", moderate: "warn", serious: "bad" };

export default function Incidents() {
  const { user } = useAuth();
  const [list, setList] = useState(null);
  const [note, setNote] = useState({});
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/api/incidents").then((d) => setList(d.incidents)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function act(id, action) {
    setErr("");
    try { await patch(`/api/incidents/${id}`, { action, note: note[id] || "" }); setNote({ ...note, [id]: "" }); load(); } catch (e) { setErr(e.message); }
  }
  const admin = user?.role === "admin";

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Reports and incidents</h1>
      <p className="muted small">Reactions and problems reported by families or staff. A person follows up on every report: there are no automatic answers. {admin && "Admins see these without patient names."}</p>
      {err && <div className="notice bad">{err}</div>}
      {list?.length === 0 && <p className="muted">No reports.</p>}
      {list?.map((i) => (
        <div key={i.id} className="card stack">
          <div className="row between">
            <div className="row"><span className={`badge ${SEV[i.severity]}`}>{titleCase(i.severity)}</span><span className="badge gray">{titleCase(i.type)}</span><span className="badge">{titleCase(i.status)}</span></div>
            <span className="small muted">{fmtDateTime(i.createdAt)}</span>
          </div>
          {i.patientName && <div><b className="bn">{i.patientName}</b> {i.cardId && <Link href={`/cards/${i.cardId}`} className="small">open card</Link>}</div>}
          <p style={{ margin: 0 }}>{i.description}</p>
          {i.contactOk && i.contactPhone && <div className="small">May contact: {i.contactPhone}</div>}
          {i.notes?.map((n, k) => <div key={k} className="small muted">{fmtDateTime(n.at)} · {n.by} ({n.role}): {n.text}</div>)}
          {i.status !== "closed" && (
            <div className="stack">
              <input placeholder="Note / outcome" value={note[i.id] || ""} onChange={(e) => setNote({ ...note, [i.id]: e.target.value })} />
              <div className="row">
                {i.status === "new" && <button className="btn small" onClick={() => act(i.id, "acknowledge")}>Acknowledge</button>}
                <button className="btn secondary small" onClick={() => act(i.id, "note")}>Add note</button>
                {!["doctor", "admin"].includes(user?.role) && i.status !== "escalated" && <button className="btn secondary small" onClick={() => act(i.id, "escalate")}>Escalate to doctor</button>}
                <button className="btn danger small" onClick={() => act(i.id, "close")}>Close with outcome</button>
              </div>
            </div>
          )}
          {i.outcome && <div className="notice ok small">Outcome: {i.outcome}</div>}
        </div>
      ))}
    </div>
  );
}
