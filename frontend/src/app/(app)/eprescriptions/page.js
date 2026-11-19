"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLibrary } from "@/lib/library";
import { emptyLine, lineToPayload } from "@/lib/lineForm";
import LineFields from "@/components/LineFields";
import { lineSummaryBn } from "@/lib/bangla";
import { fmtDateTime } from "@/lib/format";

const BADGE = { sent: ["warn", "Waiting"], imported: ["ok", "Used for a card"], cancelled: ["gray", "Cancelled"] };

export default function ERx() {
  const { user } = useAuth();
  const { ingredients, phrases } = useLibrary();
  const [list, setList] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ toOrg: "", patientName: "", patientAge: "", patientPhone: "", note: "" });
  const [lines, setLines] = useState([emptyLine()]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api("/api/eprescriptions").then((d) => setList(d.eprescriptions)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); api("/api/orgs").then((d) => setOrgs(d.orgs)).catch(() => {}); }, [load]);

  async function send(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await post("/api/eprescriptions", { ...f, lines: lines.map(lineToPayload) });
      setOpen(false); setLines([emptyLine()]); setF({ toOrg: "", patientName: "", patientAge: "", patientPhone: "", note: "" });
      load();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const doctor = user?.role === "doctor";
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="row between"><h1>E-prescriptions</h1>{doctor && <button className="btn" onClick={() => setOpen(!open)}>{open ? "Close" : "+ New e-prescription"}</button>}</div>
      {!doctor && <p className="muted">Doctors send prescriptions here. Open one to start a card with the medicines already filled in. You still check every line and answer DoctorGuard.</p>}
      {err && <div className="notice bad">{err}</div>}

      {open && (
        <form className="card stack" onSubmit={send}>
          <div className="grid">
            <div className="field"><label>Send to</label>
              <select value={f.toOrg} onChange={(e) => setF({ ...f, toOrg: e.target.value })} required><option value="">Choose pharmacy/clinic…</option>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
            <div className="field"><label>Patient name</label><input value={f.patientName} onChange={(e) => setF({ ...f, patientName: e.target.value })} required /></div>
            <div className="field"><label>Age</label><input value={f.patientAge} inputMode="numeric" onChange={(e) => setF({ ...f, patientAge: e.target.value.replace(/\D/g, "") })} /></div>
            <div className="field"><label>Patient phone</label><input value={f.patientPhone} inputMode="tel" onChange={(e) => setF({ ...f, patientPhone: e.target.value })} /></div>
          </div>
          {lines.map((l, i) => (
            <LineFields key={i} index={i} line={{ ...l, unclear: false, confirmed: true }} ingredients={ingredients} canRemove={lines.length > 1}
              onChange={(nl) => setLines((ls) => ls.map((x, j) => (j === i ? nl : x)))} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
          ))}
          <button type="button" className="btn secondary" onClick={() => setLines([...lines, emptyLine()])}>+ Add medicine</button>
          <div className="field"><label>Note for the pharmacist (optional)</label><input value={f.note} maxLength={300} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
          <button className="btn" disabled={busy}>{busy ? "Sending…" : "Send e-prescription"}</button>
        </form>
      )}

      {list?.length === 0 && <p className="muted">No e-prescriptions yet.</p>}
      {list?.map((e) => {
        const [cls, label] = BADGE[e.status] || ["gray", e.status];
        return (
          <div key={e.id} className="card stack">
            <div className="row between"><b className="bn">{e.patientName}</b><span className={`badge ${cls}`}>{label}</span></div>
            <div className="small muted">From {e.doctorName} · {fmtDateTime(e.createdAt)}</div>
            {e.lines.map((l, i) => <div key={i} className="small"><b>{l.name} {l.strength}</b> <span className="bn muted">{lineSummaryBn(phrases, l)}</span></div>)}
            {e.note && <div className="small">Note: {e.note}</div>}
            <div className="row">
              {e.status === "sent" && !doctor && <Link className="btn small" href={`/cards/new?erx=${e.id}`}>Make card from this</Link>}
              {e.status === "sent" && doctor && <button className="btn secondary small" onClick={async () => { await post(`/api/eprescriptions/${e.id}/cancel`); load(); }}>Cancel</button>}
              {e.importedCardId && !doctor && <Link className="btn secondary small" href={`/cards/${e.importedCardId}`}>Open card</Link>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
