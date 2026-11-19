"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { clearPin, getAutoLockMinutes, hasPin, setAutoLockMinutes, setPin } from "@/lib/pin";
import { prepareOffline, reportReadiness, runReadiness } from "@/lib/readiness";
import { listPending, removePending, syncPending } from "@/lib/offline";
import Link from "next/link";

export default function Settings() {
  const { user, logoutEverywhere } = useAuth();
  const staff = ["pharmacist", "chw"].includes(user?.role);
  const [pin, setPinText] = useState("");
  const [has, setHas] = useState(false);
  const [mins, setMins] = useState(3);
  const [ready, setReady] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const refresh = useCallback(() => listPending().then(setPending).catch(() => {}), []);
  useEffect(() => { if (user) { setHas(hasPin(user.id)); setMins(getAutoLockMinutes()); refresh(); } }, [user, refresh]);

  async function savePin() {
    setErr(""); setMsg("");
    try { await setPin(user.id, pin); setHas(true); setPinText(""); setMsg("PIN saved on this device."); } catch (e) { setErr(e.message); }
  }
  async function check() {
    setBusy(true);
    const r = await runReadiness(user);
    setReady(r);
    try { await reportReadiness(r); } catch {}
    setBusy(false);
  }
  async function prepare() {
    setBusy(true);
    await prepareOffline();
    await check();
  }

  if (!user) return null;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>{staff ? "This device" : "Settings"}</h1>
      {msg && <div className="notice ok">{msg}</div>}
      {err && <div className="notice bad">{err}</div>}

      <div className="card stack">
        <h3>Account</h3>
        <div className="small">{user.name} · {user.role}{user.email ? ` · ${user.email}` : ""}</div>
        <button className="btn secondary" style={{ alignSelf: "flex-start" }} onClick={() => confirm("Sign out on every device?") && logoutEverywhere()}>Sign out on all devices</button>
        <p className="small muted">Use this if a phone or shared computer was lost. Everyone signed in with this account is signed out at once.</p>
      </div>

      {staff && (
        <>
          <div className="card stack">
            <h3>Screen-lock PIN</h3>
            <p className="small muted">On a shared counter computer, a PIN hides the screen between customers. It locks after {mins} minute(s) of no use. The PIN is stored only on this device.</p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="password" inputMode="numeric" placeholder="New PIN (4 to 8 digits)" value={pin} onChange={(e) => setPinText(e.target.value.replace(/\D/g, "").slice(0, 8))} />
              <button className="btn" onClick={savePin} disabled={pin.length < 4}>{has ? "Change PIN" : "Set PIN"}</button>
            </div>
            <div className="row">
              <label style={{ margin: 0 }}>Lock after</label>
              <select style={{ maxWidth: 120 }} value={mins} onChange={(e) => { setMins(Number(e.target.value)); setAutoLockMinutes(Number(e.target.value)); }}>{[1, 2, 3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
              {has && <button className="btn secondary small" onClick={() => { clearPin(user.id); setHas(false); }}>Remove PIN</button>}
            </div>
          </div>

          <div className="card stack">
            <h3>Offline readiness</h3>
            <p className="small muted">Goal: at least 95% of devices ready to work with no internet.</p>
            <div className="row"><button className="btn" onClick={prepare} disabled={busy}>Prepare this device for offline use</button><button className="btn secondary" onClick={check} disabled={busy}>Check only</button></div>
            {ready && (
              <>
                <div className={`notice ${ready.score >= 95 ? "ok" : "warn"}`}><b>Readiness: {ready.score}%</b></div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>{ready.checks.map((c) => <li key={c.key}>{c.ok ? "✓" : "✗"} {c.label}{!c.ok && <div className="small muted">{c.hint}</div>}</li>)}</ul>
              </>
            )}
          </div>

          <div className="card stack">
            <h3>Cards waiting on this device</h3>
            {!pending.length && <p className="small muted">None. Everything has been sent.</p>}
            {pending.map((p) => (
              <div key={p.localId} className="row between">
                <div><Link href={`/cards/local?id=${p.localId}`} className="bn">{p.card.patientName}</Link> <span className="small muted">{p.status === "error" ? `failed: ${p.error}` : "waiting"}</span></div>
                {p.status === "error" && <button className="btn danger small" onClick={async () => { if (confirm("Delete this offline card from the device? It cannot be recovered.")) { await removePending(p.localId); refresh(); } }}>Delete</button>}
              </div>
            ))}
            {pending.length > 0 && <button className="btn secondary" style={{ alignSelf: "flex-start" }} onClick={async () => { await syncPending(); refresh(); }}>Send now</button>}
          </div>
        </>
      )}
    </div>
  );
}
