"use client";
import { useState } from "react";
import { api, patch } from "@/lib/api";
import CardList from "@/components/CardList";

export default function Patients() {
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState(null);
  const [allergies, setAllergies] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function find(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      const d = await api(`/api/patients/lookup?phone=${encodeURIComponent(phone)}`);
      setRes(d);
      setAllergies((d.patient?.allergies || []).join(", "));
    } catch (x) { setErr(x.message); }
  }
  async function save() {
    try {
      const d = await patch(`/api/patients/${res.patient.id}`, { allergies });
      setAllergies(d.patient.allergies.join(", "));
      setMsg("Saved. DoctorGuard will use these allergies on the next card.");
    } catch (x) { setErr(x.message); }
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1>Patients</h1>
      <form className="card row" onSubmit={find} style={{ flexWrap: "nowrap" }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number 01XXXXXXXXX" inputMode="tel" required />
        <button className="btn">Find</button>
      </form>
      {err && <div className="notice bad">{err}</div>}
      {res && !res.patient && <p className="muted">No patient with this number at your pharmacy yet. A record is created when you issue their first card.</p>}
      {res?.patient && (
        <>
          <div className="card stack">
            <h2 className="bn">{res.patient.name}</h2>
            <div className="small muted">{res.patient.ageYears != null ? `${res.patient.ageYears} years · ` : ""}{res.patient.phone}</div>
            <div className="field"><label>Known allergies (comma separated)</label><input value={allergies} onChange={(e) => setAllergies(e.target.value)} /></div>
            <button className="btn secondary small" style={{ alignSelf: "flex-start" }} onClick={save}>Save allergies</button>
            {msg && <div className="notice ok small">{msg}</div>}
          </div>
          <h2>Earlier cards</h2>
          <CardList cards={res.cards} />
        </>
      )}
    </div>
  );
}
