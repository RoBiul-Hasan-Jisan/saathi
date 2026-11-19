"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LineFields from "./LineFields";
import { emptyLine, lineToPayload } from "@/lib/lineForm";
import { lineSummaryBn, bn } from "@/lib/bangla";

export default function NewCardForm() {
  const router = useRouter();
  const startedAt = useRef(Date.now());
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState({ patientName: "", patientAge: "", patientPhone: "", sharedWith: "" });
  const [lines, setLines] = useState([emptyLine()]);
  const [confirmed, setConfirmed] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setP = (k) => (e) => setPatient((p) => ({ ...p, [k]: e.target.value }));
  const patchLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  function review() {
    setError("");
    if (!patient.patientName.trim()) return setError("Enter the patient name.");
    for (const [i, l] of lines.entries()) {
      if (!l.name.trim()) return setError(`Medicine ${i + 1}: enter the name exactly as written.`);
      if (l.unclear && !l.note.trim()) return setError(`Medicine ${i + 1}: write your question for the prescriber.`);
    }
    setConfirmed(lines.map(() => false));
    setStep(2);
    window.scrollTo(0, 0);
  }

  const anyUnclear = lines.some((l) => l.unclear);
  const allConfirmed = lines.every((l, i) => l.unclear || confirmed[i]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patient,
          startedAt: startedAt.current,
          lines: lines.map((l, i) => ({ ...lineToPayload(l), confirmed: !!confirmed[i] })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the card.");
      router.push(`/cards/${data.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <div className="stack">
        <div className="banner">
          <b>Read-back.</b> Compare each line with the paper prescription, read it aloud to the patient, then tick it.
          Nothing is guessed or corrected for you.
        </div>
        <p className="muted">Patient: <b>{patient.patientName}</b></p>

        {lines.map((l, i) => {
          const payload = lineToPayload(l);
          return (
            <div key={i} className={l.unclear ? "readback unclear" : "readback"}>
              <div className="pill">{bn(i + 1)}</div>
              <div style={{ flex: 1 }}>
                <b>
                  {l.name} {l.strength}
                </b>
                {l.unclear ? (
                  <p className="warn">Will be sent to the prescriber: {l.note}</p>
                ) : (
                  <>
                    <p className="bn big">{lineSummaryBn(payload)}</p>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!confirmed[i]}
                        onChange={(e) => setConfirmed((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                      />
                      I checked this line against the prescription
                    </label>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn" onClick={() => setStep(1)} disabled={busy}>
            ← Edit
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !allConfirmed}>
            {busy ? "Saving…" : anyUnclear ? "Send question to prescriber" : "Verify and issue card"}
          </button>
        </div>
        {anyUnclear && (
          <p className="muted">The card stays unissued until the prescriber confirms the unclear lines.</p>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="panel">
        <h2>Patient</h2>
        <div className="grid-fields">
          <label className="f-wide">
            Patient name
            <input value={patient.patientName} onChange={setP("patientName")} maxLength={80} />
          </label>
          <label>
            Age (optional)
            <input value={patient.patientAge} onChange={setP("patientAge")} inputMode="numeric" maxLength={3} />
          </label>
          <label>
            Phone (optional)
            <input value={patient.patientPhone} onChange={setP("patientPhone")} inputMode="tel" maxLength={20} />
          </label>
          <label className="f-wide">
            Share with family by email (optional, with the patient's consent)
            <input value={patient.sharedWith} onChange={setP("sharedWith")} placeholder="name@example.com, other@example.com" />
          </label>
        </div>
      </div>

      {lines.map((l, i) => (
        <div className="panel" key={i}>
          <div className="row between">
            <h2>Medicine {i + 1}</h2>
            {lines.length > 1 && (
              <button className="btn btn-ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                Remove
              </button>
            )}
          </div>
          <LineFields value={l} onChange={(patch) => patchLine(i, patch)} />
        </div>
      ))}

      {lines.length < 10 && (
        <button className="btn" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
          + Add another medicine
        </button>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" onClick={review}>
        Review read-back →
      </button>
    </div>
  );
}
