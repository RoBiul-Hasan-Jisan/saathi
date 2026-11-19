"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const { setUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    api("/api/auth/demo-users").then((d) => setUsers(d.users)).catch((e) => { setUsers([]); setErr(e.message); });
  }, []);

  async function go(role) {
    setBusy(role); setErr("");
    try {
      const d = await api("/api/auth/demo", { method: "POST", body: { role } });
      setUser(d.user);
      router.push("/dashboard");
    } catch (e) { setErr(e.message); setBusy(""); }
  }

  return (
    <div className="container stack">
      <div className="hero">
        <div className="badge">Saathi by NirapodRx</div>
        <h1 style={{ marginTop: ".6rem" }}>Medicine instructions a family can understand</h1>
        <p className="muted" style={{ maxWidth: 640, margin: "0 auto" }}>
          A verified Bangla medicine card with a QR code, a voice guide and pictures, made by a named pharmacist, in the pharmacy, in about a minute.
        </p>
        <div className="row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/login">Sign in / Sign up</Link>
        </div>
      </div>

      <div className="card">
        <h2>Try it now: one tap, no password</h2>
        {err && <div className="notice bad">{err}</div>}
        {users === null && <p className="muted">Loading demo accounts…</p>}
        {users?.length === 0 && !err && <p className="muted">Demo accounts are switched off on this server.</p>}
        <div className="grid">
          {users?.map((u) => (
            <button key={u.role} className="tile" disabled={!!busy} onClick={() => go(u.role)}>
              <b>{u.title}</b>
              <div className="small muted">{u.blurb}</div>
              <div className="small" style={{ marginTop: ".4rem", color: "var(--brand-dark)", fontWeight: 700 }}>{busy === u.role ? "Opening…" : "Open →"}</div>
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: ".8rem" }}>Demo data is sample data. Never enter real patient information in a demo account.</p>
      </div>
    </div>
  );
}
