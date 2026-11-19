"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebaseClient";

const ROLES = [["patient", "Patient"], ["caregiver", "Family caregiver"], ["pharmacist", "Pharmacist"], ["chw", "Community health worker"]];

export default function Login() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [mode, setMode] = useState("in");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "patient", orgId: "" });
  const [orgs, setOrgs] = useState([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const staff = ["pharmacist", "chw"].includes(f.role);

  useEffect(() => { api("/api/orgs").then((d) => setOrgs(d.orgs)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setInfo(""); setBusy(true);
    try {
      const auth = getFirebaseAuth();
      let cred;
      if (mode === "up") {
        cred = await createUserWithEmailAndPassword(auth, f.email, f.password);
        if (f.name) await updateProfile(cred.user, { displayName: f.name });
      } else cred = await signInWithEmailAndPassword(auth, f.email, f.password);
      const idToken = await cred.user.getIdToken();
      const d = await api("/api/auth/firebase", { method: "POST", body: { idToken, role: f.role, name: f.name, orgId: f.orgId } });
      setUser(d.user);
      router.push("/dashboard");
    } catch (x) {
      if (x.data?.pending) setInfo("Your account was created. An admin must approve staff accounts before you can sign in. Please check back soon.");
      else {
        const code = x.code || "";
        setErr(
          code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") ? "Wrong email or password."
          : code.includes("email-already-in-use") ? "This email already has an account. Use Sign in."
          : code.includes("weak-password") ? "Password must be at least 6 characters."
          : code.includes("operation-not-allowed") ? "Email/Password sign-in is not enabled in Firebase yet (Authentication → Sign-in method)."
          : x.message
        );
      }
    }
    setBusy(false);
  }

  return (
    <div className="narrow stack" style={{ paddingTop: "2rem" }}>
      <Link href="/" className="small">← Back (try a demo account)</Link>
      <div className="card stack">
        <div className="tabs">
          <button className={`tab ${mode === "in" ? "on" : ""}`} onClick={() => setMode("in")}>Sign in</button>
          <button className={`tab ${mode === "up" ? "on" : ""}`} onClick={() => setMode("up")}>Create account</button>
        </div>
        {!isFirebaseConfigured && <div className="notice warn">Firebase is not set up yet. Add the NEXT_PUBLIC_FIREBASE_* values to frontend/.env.local and restart. Demo accounts on the home page work without it.</div>}
        <form className="stack" onSubmit={submit}>
          {mode === "up" && (
            <>
              <div className="field"><label>Your name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} /></div>
              <div className="field"><label>I am a…</label>
                <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </div>
              {staff && (
                <>
                  <div className="field"><label>My pharmacy / clinic</label>
                    <select value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })}>
                      <option value="">Choose…</option>
                      {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.district ? ` (${o.district})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="notice info small">Staff accounts need approval by an admin before first use. Doctor and admin accounts are granted by an admin only.</div>
                </>
              )}
            </>
          )}
          <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="email" /></div>
          <div className="field"><label>Password</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={6} autoComplete={mode === "up" ? "new-password" : "current-password"} /></div>
          {err && <div className="notice bad">{err}</div>}
          {info && <div className="notice info">{info}</div>}
          <button className="btn" disabled={busy || !isFirebaseConfigured}>{busy ? "Please wait…" : mode === "up" ? "Create account" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
