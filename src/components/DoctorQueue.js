"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LineFields from "./LineFields";
import { lineToState, lineToPayload } from "@/lib/lineForm";

function UnclearLine({ card, line, index }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => lineToState({ ...line, name: line.name.startsWith("(") ? "" : line.name }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prescriber_confirm", lineIndex: index, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save.");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function saveCorrection() {
    const p = lineToPayload(draft);
    send({
      correction: { name: p.name, strength: p.strength, form: p.form, food: p.food, days: p.days, pattern: p.pattern },
    });
  }

  return (
    <div className="readback unclear">
      <div style={{ flex: 1 }}>
        <p>
          <b>Line {index + 1}:</b> {line.name} {line.strength}
        </p>
        <p className="warn">Question from {card.createdBy?.name}: {line.note}</p>

        {editing ? (
          <>
            <LineFields value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} showUnclear={false} />
            <div className="row">
              <button className="btn btn-primary" disabled={busy} onClick={saveCorrection}>
                {busy ? "Saving…" : "Save correction & confirm"}
              </button>
              <button className="btn" disabled={busy} onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={() => setEditing(true)}>
              Enter correct details
            </button>
            <button className="btn" disabled={busy} onClick={() => send({})} title="Only works if the line already has a valid schedule">
              Confirm as written
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

export default function DoctorQueue({ cards }) {
  if (!cards.length) return <p className="muted">No questions waiting. 🎉</p>;
  return (
    <div className="stack">
      {cards.map((card) => (
        <div className="panel" key={card.id}>
          <h3>{card.patientName}</h3>
          {card.lines.map((line, i) =>
            line.status === "unclear" ? <UnclearLine key={i} card={card} line={line} index={i} /> : null
          )}
        </div>
      ))}
    </div>
  );
}
