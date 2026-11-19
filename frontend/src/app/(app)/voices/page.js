"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, del, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLibrary } from "@/lib/library";
import { numberText } from "@/lib/speech";

const textFor = (P, key) => (key.startsWith("num.") ? numberText(Number(key.slice(4).replace("_", "."))) : P[key] || key);

const toBase64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });

export default function Voices() {
  const { user } = useAuth();
  const { phrases: P } = useLibrary();
  const [man, setMan] = useState(null);
  const [clips, setClips] = useState([]);
  const [dialect, setDialect] = useState("ctg");
  const [rec, setRec] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const mr = useRef(null);

  const load = useCallback(async () => {
    try { const [m, c] = await Promise.all([api("/api/voices/manifest"), api("/api/voices")]); setMan(m); setClips(c.clips); } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function start(key) {
    setErr(""); setMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const r = new MediaRecorder(stream);
      mr.current = r;
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType });
        setRec(null);
        try {
          await post("/api/voices", { dialect, key, mime: r.mimeType.split(";")[0], data: await toBase64(blob) });
          setMsg(user.role === "admin" ? "Saved and approved." : "Saved. An admin must approve it before it is used.");
          load();
        } catch (e) { setErr(e.message); }
      };
      r.start();
      setRec(key);
      setTimeout(() => r.state === "recording" && r.stop(), 6000);
    } catch { setErr("Microphone not available. Allow microphone access in the browser."); }
  }

  if (!man) return err ? <div className="notice bad">{err}</div> : <p className="muted">Loading…</p>;
  const approved = man.clips[dialect] || {};
  const mine = (key) => clips.filter((c) => c.dialect === dialect && c.key === key && c.status === "pending");
  const count = man.keys.filter((k) => approved[k]).length;

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>Dialect voice studio</h1>
      <p className="muted small">Native speakers record the fixed phrases and numbers (up to 6 seconds each). An admin approves each clip before families hear it. Patient and medicine names are never recorded: the device voice reads them.</p>
      <div className="row">
        <select value={dialect} onChange={(e) => setDialect(e.target.value)} style={{ maxWidth: 240 }}>{man.dialects.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
        <span className="badge">{count} of {man.keys.length} approved</span>
      </div>
      {err && <div className="notice bad">{err}</div>}
      {msg && <div className="notice ok">{msg}</div>}
      <div className="card tablewrap"><table>
        <thead><tr><th>Say this</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {man.keys.map((k) => (
            <tr key={k}>
              <td className="bn big-bn">{textFor(P, k)}<div className="small muted">{k}</div></td>
              <td>{approved[k] ? <span className="badge ok">Approved</span> : mine(k).length ? <span className="badge warn">Waiting</span> : <span className="badge gray">None</span>}
                {approved[k] && <audio controls preload="none" src={`/api/voices/${approved[k]}/audio`} style={{ height: 30, display: "block", marginTop: 4 }} />}</td>
              <td><div className="row">
                <button className="btn secondary small" disabled={!!rec} onClick={() => start(k)}>{rec === k ? "Recording…" : "● Record"}</button>
                {rec === k && <button className="btn danger small" onClick={() => mr.current?.stop()}>Stop</button>}
                {user.role === "admin" && mine(k).map((c) => (
                  <span key={c.id} className="row">
                    <audio controls preload="none" src={`/api/voices/${c.id}/audio`} style={{ height: 30 }} onPlay={undefined} />
                    <button className="btn small" onClick={async () => { await post(`/api/voices/${c.id}/review`, { decision: "approve" }); load(); }}>Approve</button>
                    <button className="btn danger small" onClick={async () => { await post(`/api/voices/${c.id}/review`, { decision: "reject" }); load(); }}>Reject</button>
                  </span>
                ))}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
