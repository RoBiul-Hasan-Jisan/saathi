"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Stat from "@/components/Stat";
import { fmtDateTime, titleCase } from "@/lib/format";

export default function Admin() {
  const { user } = useAuth();
  const [o, setO] = useState(null);
  const [cards, setCards] = useState([]);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState("cards");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, c, l] = await Promise.all([api("/api/admin/overview"), api("/api/admin/cards"), api("/api/admin/audit?limit=100")]);
      setO(a); setCards(c.cards); setAudit(l.audit);
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { if (user?.role === "admin") load(); }, [user, load]);

  if (user && user.role !== "admin") return <div className="notice warn">Admins only.</div>;
  if (err) return <div className="notice bad">{err}</div>;
  if (!o) return <p className="muted">Loading…</p>;
  const s = o.stats;
  const gate = o.safetyGate;

  async function gateAct(path, body) {
    setErr("");
    try { await post(`/api/admin/safety-gate/${path}`, body); setNote(""); load(); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="stack">
      <h1>Pilot overview</h1>
      <p className="muted small">De-identified. Admins never see patient names, phone numbers or card contents.</p>

      <div className={`notice ${gate?.paused ? "bad" : "ok"}`}>
        {gate?.paused ? <><b>Safety gate: new cards are paused.</b> {gate.reason}</> : <><b>Safety gate: open.</b> New cards can be created.</>}
        <div className="row" style={{ marginTop: ".5rem", flexWrap: "nowrap" }}>
          <input placeholder={gate?.paused ? "What was reviewed and decided? (10+ characters)" : "Reason for pausing"} value={note} onChange={(e) => setNote(e.target.value)} />
          {gate?.paused ? <button className="btn small" disabled={note.trim().length < 10} onClick={() => gateAct("clear", { note })}>Resume</button>
            : <button className="btn danger small" onClick={() => confirm("Pause new cards for everyone?") && gateAct("pause", { reason: note })}>Pause</button>}
        </div>
      </div>

      <div className="grid">
        <Stat label="Cards issued" value={s.issued} />
        <Stat label="Teach-back success" value={s.teachBackRate == null ? "—" : `${s.teachBackRate}%`} hint={`goal ≥ 90% · ${s.teachBackCount} recorded`} />
        <Stat label="Median card time" value={s.medianSeconds == null ? "—" : `${s.medianSeconds}s`} hint="goal ≤ 60s" />
        <Stat label="Verified by a named person" value={s.verifiedRate == null ? "—" : `${s.verifiedRate}%`} hint="goal 100%" />
        <Stat label="Offline readiness" value={o.readiness.averageScore == null ? "—" : `${o.readiness.averageScore}%`} hint={`${o.readiness.devices} device(s) · ${o.readiness.belowTarget} below 95%`} />
        <Stat label="DoctorGuard flags" value={s.guardFlags} />
        <Stat label="Open reports" value={o.incidents.open} hint={`${o.incidents.seriousOpen} serious`} />
        <Stat label="Voice clips" value={o.voices.approved} hint={`${o.voices.pending} waiting`} />
      </div>

      {o.users.pendingApproval > 0 && <div className="notice warn"><b>{o.users.pendingApproval} account(s) waiting for approval.</b> <Link href="/admin/people">Open people & places</Link></div>}

      <div className="card stack">
        <h3>Library status</h3>
        <div className="row">{Object.entries(o.library).map(([k, m]) => <span key={k} className={`badge ${m.reviewed ? "ok" : "warn"}`}>{k} v{m.version}: {m.reviewed ? `approved by ${m.reviewedBy}` : "sample, not reviewed"}</span>)}</div>
        <Link href="/library" className="small">Open the library</Link>
      </div>

      <div className="card stack">
        <h3>By pharmacy / clinic</h3>
        <div className="tablewrap"><table><thead><tr><th>Place</th><th>Issued</th><th>Teach-back</th><th>Median time</th><th>Offline cards</th></tr></thead>
          <tbody>{o.perOrg.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.issued}</td><td>{p.teachBackRate == null ? "—" : `${p.teachBackRate}%`}</td><td>{p.medianSeconds == null ? "—" : `${p.medianSeconds}s`}</td><td>{p.offlineCards}</td></tr>)}</tbody></table></div>
      </div>

      <div className="card stack">
        <h3>Exports (de-identified)</h3>
        <p className="small muted">Only cards where the patient agreed to data use are included. Groups smaller than 5 are hidden.</p>
        <div className="row"><a className="btn secondary" href="/api/admin/export/cards.csv">Card-level CSV</a><a className="btn secondary" href="/api/admin/export/weekly.csv">Weekly summary CSV</a></div>
      </div>

      <div className="tabs"><button className={`tab ${tab === "cards" ? "on" : ""}`} onClick={() => setTab("cards")}>Verification log</button><button className={`tab ${tab === "audit" ? "on" : ""}`} onClick={() => setTab("audit")}>Audit log</button></div>
      {tab === "cards" ? (
        <div className="card tablewrap"><table><thead><tr><th>Ref</th><th>Place</th><th>Status</th><th>Age</th><th>Medicines</th><th>Flags</th><th>Verified by</th><th>Teach-back</th></tr></thead>
          <tbody>{cards.map((c) => <tr key={c.ref}><td>{c.ref}</td><td>{c.orgName}</td><td>{titleCase(c.status)}{c.offline ? " · offline" : ""}</td><td>{c.ageBand}</td><td>{c.medicines}{c.unclear ? ` (${c.unclear} unclear)` : ""}</td><td>{c.guardFlags}</td><td>{c.verifiedBy || "—"}<div className="small muted">{c.verifiedAt ? fmtDateTime(c.verifiedAt) : ""}</div></td><td>{c.teachBack || "—"}</td></tr>)}</tbody></table></div>
      ) : (
        <div className="card tablewrap"><table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>{audit.map((a, i) => <tr key={i}><td className="small">{fmtDateTime(a.at)}</td><td>{a.actor?.name || "—"} <span className="small muted">{a.actor?.role}</span></td><td>{a.action.replace(/_/g, " ")}</td><td className="small muted">{a.detail}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}
