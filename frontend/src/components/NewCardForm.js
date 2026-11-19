"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLibrary } from "@/lib/library";
import { emptyLine, lineToPayload, lineToState } from "@/lib/lineForm";
import { queueCard } from "@/lib/offline";
import { fmtDate } from "@/lib/format";
import LineFields from "./LineFields";
import GuardPanel from "./GuardPanel";
import RxScan from "./RxScan";

export default function NewCardForm() {
  const { user } = useAuth();
  const { ingredients, meta } = useLibrary();
  const router = useRouter();
  const search = useSearchParams();
  const erxId = search.get("erx") || "";

  const started = useRef(Date.now());
  const [step, setStep] = useState("details"); // details | check
  const [f, setF] = useState({ name: "", age: "", phone: "", allergies: "", family: false, dataUse: false, shared: "", readBack: false });
  const [lines, setLines] = useState([emptyLine()]);
  const [source, setSource] = useState("manual");
  const [prior, setPrior] = useState([]);
  const [guard, setGuard] = useState(null);
  const [acks, setAcks] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [erxNote, setErxNote] = useState("");

  const reviewed = !!(meta?.rules?.reviewed && meta?.ingredients?.reviewed);

  useEffect(() => {
    if (!erxId) return;
    api(`/api/eprescriptions/${erxId}`).then(({ eprescription: e }) => {
      setF((p) => ({ ...p, name: e.patientName || "", age: e.patientAge ?? "", phone: e.patientPhone || "" }));
      setLines((e.lines || []).map((l) => ({ ...lineToState(l), confirmed: false })));
      setSource("eprescription");
      setErxNote(`From e-prescription by ${e.doctorName}. Check each line against what the doctor sent.`);
    }).catch((x) => setErr(x.message));
  }, [erxId]);

  async function lookup() {
    setErr("");
    try {
      const d = await api(`/api/patients/lookup?phone=${encodeURIComponent(f.phone)}`);
      if (!d.patient) return setPrior([]);
      setF((p) => ({ ...p, name: p.name || d.patient.name, age: p.age === "" ? d.patient.ageYears ?? "" : p.age, allergies: (d.patient.allergies || []).join(", ") }));
      setPrior(d.cards || []);
    } catch (e) { setErr(e.message); }
  }

  const payload = () => ({
    patientName: f.name,
    patientAge: f.age,
    patientPhone: f.phone,
    patientAllergies: f.allergies,
    consent: { family: f.family, dataUse: f.dataUse },
    sharedWith: f.family ? f.shared : "",
    lines: lines.map(lineToPayload),
    source,
    eprescriptionId: erxId,
    startedAt: started.current,
  });

  function validateLocal() {
    if (!f.name.trim()) return "Enter the patient name.";
    for (const [i, l] of lines.entries()) {
      if (!l.name.trim()) return `Medicine ${i + 1}: enter the name.`;
      if (l.unclear && !l.note.trim()) return `Medicine ${i + 1}: write the question for the doctor.`;
      if (!l.unclear && !l.confirmed) return `Medicine ${i + 1}: tick that you checked it against the prescription.`;
    }
    return "";
  }

  async function toCheck(e) {
    e.preventDefault();
    const v = validateLocal();
    if (v) return setErr(v);
    setErr(""); setBusy(true);
    try {
      const g = await api("/api/cards/guard-check", { method: "POST", body: { lines: payload().lines, phone: f.phone, allergies: f.allergies.split(","), age: f.age } });
      setGuard(g);
      setAcks({});
      setStep("check");
    } catch (x) {
      if (x.unreachable) {
        setGuard({ flags: [], unchecked: [], offline: true });
        setStep("check");
      } else setErr(x.message);
    }
    setBusy(false);
  }

  function ackError() {
    for (const fl of guard.flags) {
      const a = acks[fl.key];
      if (!a?.action) return `Answer the flag: ${fl.title}`;
      if (a.action === "accepted" && fl.severity === "high" && (a.note || "").trim().length < 10) return "High-severity flag: write why you are continuing (10+ characters) or refer it to the doctor.";
    }
    return "";
  }

  async function submit() {
    if (!f.readBack) return setErr("Read the card back to the patient and tick the confirmation.");
    const unanswered = guard.offline ? "" : ackError();
    if (unanswered) return setErr(unanswered);
    setErr(""); setBusy(true);
    const body = { ...payload(), guardAcks: Object.entries(acks).map(([key, a]) => ({ key, action: a.action, note: a.note || "" })) };
    try {
      const r = await api("/api/cards", { method: "POST", body });
      router.push(`/cards/${r.id}`);
    } catch (x) {
      if (x.unreachable) {
        try {
          const item = await queueCard(body, user);
          router.push(`/cards/local?id=${encodeURIComponent(item.localId)}`);
          return;
        } catch { setErr("This device could not save the card offline."); }
      } else setErr(x.message);
    }
    setBusy(false);
  }

  if (step === "check")
    return (
      <div className="stack">
        <h1>Check before issuing</h1>
        {guard.offline && <div className="notice warn">You are offline. DoctorGuard cannot run. The card will be saved on this device, and any flags will be shown to you for review once it syncs.</div>}
        {!guard.offline && <GuardPanel flags={guard.flags} unchecked={guard.unchecked} acks={acks} setAck={(k, v) => setAcks((p) => ({ ...p, [k]: v }))} reviewed={guard.reviewed ?? reviewed} />}
        <div className="card">
          <label className="check"><input type="checkbox" checked={f.readBack} onChange={(e) => setF({ ...f, readBack: e.target.checked })} /> I read this card back to the patient (or caregiver) and they understood it. I am {user?.name}, the named verifier.</label>
        </div>
        {err && <div className="notice bad">{err}</div>}
        <div className="row">
          <button className="btn secondary" onClick={() => setStep("details")}>← Back</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Issue card"}</button>
        </div>
      </div>
    );

  return (
    <form className="stack" onSubmit={toCheck}>
      <h1>New medicine card</h1>
      {erxNote && <div className="notice info">{erxNote}</div>}
      <div className="card">
        <h3>Patient</h3>
        <div className="grid">
          <div className="field">
            <label>Phone (to find earlier cards)</label>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="01XXXXXXXXX" />
              <button type="button" className="btn secondary small" onClick={lookup}>Find</button>
            </div>
          </div>
          <div className="field"><label>Name</label><input value={f.name} maxLength={80} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
          <div className="field"><label>Age (years)</label><input value={f.age} inputMode="numeric" onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} /></div>
          <div className="field"><label>Known allergies (comma separated)</label><input value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} placeholder="e.g. penicillin" /></div>
        </div>
        {prior.length > 0 && (
          <div className="notice info small" style={{ marginTop: ".7rem" }}>
            Earlier cards for this patient: {prior.slice(0, 4).map((c) => `${fmtDate(c.createdAt?.slice(0, 10))} (${c.lines.map((l) => l.name).join(", ")})`).join(" · ")}. DoctorGuard checks new medicines against active ones.
          </div>
        )}
      </div>

      <RxScan ingredients={ingredients} onPick={(ing) => { setSource("rxscan"); setLines((ls) => (ls.length === 1 && !ls[0].name ? [] : ls).concat({ ...emptyLine(), name: ing.nameEn, ingredient: ing.key })); }} />

      <div className="stack">
        {lines.map((l, i) => (
          <LineFields key={i} index={i} line={l} ingredients={ingredients} canRemove={lines.length > 1}
            onChange={(nl) => setLines((ls) => ls.map((x, j) => (j === i ? nl : x)))} onRemove={() => setLines((ls) => ls.filter((_, j) => j !== i))} />
        ))}
        {lines.length < 10 && <button type="button" className="btn secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>+ Add medicine</button>}
      </div>

      <div className="card">
        <h3>Consent</h3>
        <label className="check"><input type="checkbox" checked={f.family} onChange={(e) => setF({ ...f, family: e.target.checked })} /> Patient agrees to share this card with family</label>
        {f.family && <div className="field"><label>Family emails (comma separated, optional)</label><input value={f.shared} onChange={(e) => setF({ ...f, shared: e.target.value })} /></div>}
        <label className="check" style={{ marginTop: ".5rem" }}><input type="checkbox" checked={f.dataUse} onChange={(e) => setF({ ...f, dataUse: e.target.checked })} /> Patient agrees that de-identified data may be used for pilot statistics</label>
      </div>

      {err && <div className="notice bad">{err}</div>}
      <button className="btn" disabled={busy}>{busy ? "Checking…" : "Continue → safety check"}</button>
    </form>
  );
}
