"use client";
import { useState } from "react";
import { isFirebaseConfigured, getFirebaseAuth } from "@/lib/firebaseClient";

const ROLES = [
  { key: "patient", label: "Patient" },
  { key: "caregiver", label: "Caregiver / family" },
  { key: "pharmacist", label: "Pharmacist / clinic worker" },
  { key: "chw", label: "Community health worker" },
];

export default function FirebaseAuthForm() {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "patient" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isFirebaseConfigured) {
    return (
      <p className="muted">
        Email sign-in is not configured yet. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> values to{" "}
        <code>.env.local</code> to enable it. Demo accounts above work without it.
      </p>
    );
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import(
        "firebase/auth"
      );
      const auth = getFirebaseAuth();
      let cred;
      if (mode === "signup") {
        cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
        if (form.name) await updateProfile(cred.user, { displayName: form.name });
      } else {
        cred = await signInWithEmailAndPassword(auth, form.email, form.password);
      }
      const idToken = await cred.user.getIdToken();
      const res = await fetch("/api/auth/firebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, role: form.role, name: form.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign-in failed.");
      window.location.href = "/dashboard";
    } catch (err) {
      const code = err?.code || "";
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
          ? "Email or password is not correct."
          : code.includes("email-already-in-use")
          ? "That email already has an account. Sign in instead."
          : code.includes("weak-password")
          ? "Use a password with at least 6 characters."
          : err.message || "Something went wrong."
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="tabs">
        <button type="button" className={mode === "signin" ? "tab active" : "tab"} onClick={() => setMode("signin")}>
          Sign in
        </button>
        <button type="button" className={mode === "signup" ? "tab active" : "tab"} onClick={() => setMode("signup")}>
          Create account
        </button>
      </div>

      {mode === "signup" && (
        <>
          <label>
            Your name
            <input value={form.name} onChange={set("name")} required />
          </label>
          <label>
            I am a
            <select value={form.role} onChange={set("role")}>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <label>
        Email
        <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" />
      </label>
      <label>
        Password
        <input
          type="password"
          value={form.password}
          onChange={set("password")}
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
