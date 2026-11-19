"use client";
import { useState } from "react";

export default function DemoLogin({ users }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function go(role) {
    setBusy(role);
    setError("");
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Demo login failed.");
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err.message);
      setBusy("");
    }
  }

  return (
    <div>
      <div className="demo-grid">
        {users.map((u) => (
          <button key={u.role} className="demo-tile" onClick={() => go(u.role)} disabled={!!busy}>
            <strong>{busy === u.role ? "Signing in…" : u.title}</strong>
            <span>{u.blurb}</span>
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
