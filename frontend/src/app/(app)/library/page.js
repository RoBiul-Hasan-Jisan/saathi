"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

const KINDS = [["phrases", "Bangla phrases"], ["infoPanel", "Storage & warning panel"], ["ingredients", "Ingredients"], ["rules", "DoctorGuard rules"]];

function Meta({ m }) {
  if (!m) return null;
  return m.reviewed
    ? <span className="badge ok">Clinically approved v{m.version} by {m.reviewedBy}</span>
    : <span className="badge warn">v{m.version}: sample, not clinically reviewed</span>;
}

export default function Library() {
  const { user } = useAuth();
  const [kind, setKind] = useState("phrases");
  const [cur, setCur] = useState(null);
  const [props, setProps] = useState([]);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [rev, setRev] = useState({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [c, p] = await Promise.all([api(`/api/library/full/${kind}`), api("/api/library/proposals")]);
      setCur(c); setText(JSON.stringify(c.content, null, 2)); setProps(p.proposals);
    } catch (e) { setErr(e.message); }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const canPropose = ["admin", "doctor"].includes(user?.role);

  async function propose() {
    setErr(""); setMsg("");
    let content;
    try { content = JSON.parse(text); } catch { return setErr("That is not valid JSON. Check commas and quotes."); }
    try { await post(`/api/library/${kind}/propose`, { content, note }); setNote(""); setMsg("Sent for clinical review. It changes nothing until a different doctor approves it."); load(); } catch (e) { setErr(e.message); }
  }
  async function review(id, decision) {
    setErr("");
    try { await post(`/api/library/proposals/${id}/review`, { decision, note: rev[id] || "" }); load(); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <h1>Medicine library</h1>
      <p className="muted small">The wording, ingredients and DoctorGuard rules used on every card. Admins and doctors can propose changes; a <b>different doctor</b> must approve before anything changes. Shipped content is a sample and is labelled until a doctor approves it.</p>
      <div className="tabs">{KINDS.map(([k, l]) => <button key={k} className={`tab ${kind === k ? "on" : ""}`} onClick={() => setKind(k)}>{l}</button>)}</div>
      {err && <div className="notice bad">{err}</div>}
      {msg && <div className="notice ok">{msg}</div>}
      {cur && <div><Meta m={cur.meta} /></div>}

      {props.filter((p) => p.status === "pending_review").map((p) => (
        <div key={p.id} className="card stack">
          <div className="row between"><b>{KINDS.find(([k]) => k === p.kind)?.[1]} · proposal v{p.version}</b><span className="badge warn">Waiting for review</span></div>
          <div className="small muted">By {p.proposedBy?.name} · {fmtDateTime(p.createdAt)} · “{p.note}”</div>
          <details><summary>Show proposed content</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem", maxHeight: 320, overflow: "auto" }}>{JSON.stringify(p.content, null, 2)}</pre></details>
          {user?.role === "doctor" && p.proposedBy?.id !== user.id && (
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input placeholder="Review note (required to reject)" value={rev[p.id] || ""} onChange={(e) => setRev({ ...rev, [p.id]: e.target.value })} />
              <button className="btn small" onClick={() => review(p.id, "approve")}>Approve</button>
              <button className="btn danger small" onClick={() => review(p.id, "reject")}>Reject</button>
            </div>
          )}
          {p.proposedBy?.id === user?.id && <button className="btn secondary small" style={{ alignSelf: "flex-start" }} onClick={async () => { await post(`/api/library/proposals/${p.id}/withdraw`); load(); }}>Withdraw</button>}
          {user?.role === "doctor" && p.proposedBy?.id === user.id && <div className="small muted">You proposed this, so another doctor must review it.</div>}
        </div>
      ))}

      {canPropose && cur && (
        <div className="card stack">
          <h3>Propose a change</h3>
          <textarea style={{ minHeight: 320, fontFamily: "ui-monospace, monospace", fontSize: ".82rem" }} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <input placeholder="What changed and why? (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={propose} disabled={note.trim().length < 5}>Send for clinical review</button>
        </div>
      )}
      {!canPropose && cur && <details className="card"><summary>Show current content</summary><pre style={{ whiteSpace: "pre-wrap", fontSize: ".8rem" }}>{text}</pre></details>}

      <h3>History</h3>
      <div className="stack">{props.filter((p) => p.status !== "pending_review").slice(0, 12).map((p) => <div key={p.id} className="small muted">{p.kind} v{p.version}: {p.status} {p.reviewedBy ? `by ${p.reviewedBy.name}` : ""} {p.reviewNote ? `— ${p.reviewNote}` : ""}</div>)}</div>
    </div>
  );
}
