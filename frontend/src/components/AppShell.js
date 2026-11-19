"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { checkPin, getAutoLockMinutes, hasPin } from "@/lib/pin";
import { countPending, syncPending } from "@/lib/offline";

const LINKS = {
  pharmacist: [["/dashboard", "Home"], ["/cards/new", "New card"], ["/patients", "Patients"], ["/eprescriptions", "E-prescriptions"], ["/incidents", "Reports"], ["/settings", "This device"]],
  chw: [["/dashboard", "Home"], ["/cards/new", "New card"], ["/patients", "Patients"], ["/eprescriptions", "E-prescriptions"], ["/incidents", "Reports"], ["/settings", "This device"]],
  doctor: [["/dashboard", "Home"], ["/eprescriptions", "E-prescriptions"], ["/library", "Library review"], ["/incidents", "Reports"], ["/settings", "Settings"]],
  admin: [["/dashboard", "Home"], ["/admin", "Overview"], ["/admin/people", "People & places"], ["/library", "Library"], ["/voices", "Voices"], ["/incidents", "Reports"], ["/settings", "Settings"]],
  patient: [["/dashboard", "My cards"], ["/settings", "Settings"]],
  caregiver: [["/dashboard", "Family cards"], ["/settings", "Settings"]],
};

function LockScreen({ user, onUnlock, onLogout }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  async function go(e) {
    e.preventDefault();
    if (await checkPin(user.id, pin)) onUnlock();
    else { setErr("Wrong PIN."); setPin(""); }
  }
  return (
    <div className="lock" role="dialog" aria-label="Screen locked">
      <form className="card stack" onSubmit={go}>
        <h2>Screen locked</h2>
        <p className="muted small">Locked to protect the last customer's information.</p>
        <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" aria-label="PIN" />
        {err && <div className="notice bad">{err}</div>}
        <button className="btn">Unlock</button>
        <button type="button" className="btn secondary" onClick={onLogout}>Sign out instead</button>
      </form>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, loading, offline, logout } = useAuth();
  const path = usePathname();
  const [locked, setLocked] = useState(false);
  const [pending, setPending] = useState(0);
  const [syncMsg, setSyncMsg] = useState("");
  const timer = useRef(null);
  const staff = user && ["pharmacist", "chw"].includes(user.role);

  // Auto-lock after inactivity (staff with a PIN only).
  const arm = useCallback(() => {
    clearTimeout(timer.current);
    if (!staff || !hasPin(user.id)) return;
    timer.current = setTimeout(() => setLocked(true), getAutoLockMinutes() * 60000);
  }, [staff, user]);
  useEffect(() => {
    if (!staff) return;
    if (hasPin(user.id) && !sessionStorage.getItem("saathi.unlocked")) setLocked(true);
    const evs = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, arm));
    arm();
    return () => { evs.forEach((e) => window.removeEventListener(e, arm)); clearTimeout(timer.current); };
  }, [staff, user, arm]);

  // Offline queue: count it, and send it when the connection returns.
  const refreshCount = useCallback(() => countPending().then(setPending), []);
  const sync = useCallback(async () => {
    if (!staff || !navigator.onLine) return;
    const r = await syncPending();
    const ok = r.filter((x) => x.ok).length;
    const bad = r.filter((x) => x.error).length;
    if (ok || bad) setSyncMsg(`${ok} offline card(s) sent to the server${bad ? `, ${bad} need attention (see This device)` : ""}.`);
    refreshCount();
  }, [staff, refreshCount]);
  useEffect(() => {
    refreshCount();
    window.addEventListener("saathi:pending-changed", refreshCount);
    window.addEventListener("online", sync);
    sync();
    return () => { window.removeEventListener("saathi:pending-changed", refreshCount); window.removeEventListener("online", sync); };
  }, [refreshCount, sync]);

  if (loading) return <div className="narrow center muted" style={{ paddingTop: "4rem" }}>Loading…</div>;
  if (!user) {
    return (
      <div className="narrow center stack" style={{ paddingTop: "3rem" }}>
        <h2>Please sign in</h2>
        <Link className="btn" href="/login">Go to sign in</Link>
      </div>
    );
  }

  const links = LINKS[user.role] || [];
  return (
    <>
      {locked && <LockScreen user={user} onUnlock={() => { sessionStorage.setItem("saathi.unlocked", "1"); setLocked(false); arm(); }} onLogout={logout} />}
      <nav className="nav noprint">
        <div className="container">
          <Link href="/dashboard" className="brand">Saathi</Link>
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={`link ${path === href || (href !== "/dashboard" && path.startsWith(href + "/")) ? "active" : ""}`}>{label}</Link>
          ))}
          <span style={{ marginLeft: "auto" }} className="row">
            <span className="small muted">{user.name} · {user.role}{user.demo ? " · demo" : ""}</span>
            {staff && hasPin(user.id) && <button className="btn secondary small" onClick={() => setLocked(true)}>Lock</button>}
            <button className="btn secondary small" onClick={logout}>Sign out</button>
          </span>
        </div>
      </nav>
      {(offline || (typeof navigator !== "undefined" && !navigator.onLine)) && <div className="banner">You are offline. You can still create cards: they are saved on this device and sent later.</div>}
      {pending > 0 && <div className="banner">{pending} card(s) waiting to be sent. <Link href="/settings">See details</Link></div>}
      {syncMsg && <div className="banner ok" onClick={() => setSyncMsg("")}>{syncMsg}</div>}
      <main className="container">{children}</main>
    </>
  );
}
