"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { lineSummaryBn } from "@/lib/bangla";

async function patch(id, body) {
  const res = await fetch(`/api/cards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export default function CardActions({ card, role }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readBack, setReadBack] = useState(false);
  const isStaff = role === "pharmacist" || role === "chw";

  async function run(body) {
    setBusy(true);
    setError("");
    try {
      await patch(card.id, body);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (card.status === "awaiting_prescriber") {
    return (
      <div className="banner banner-warn no-print">
        Waiting for the prescriber to confirm {card.lines.filter((l) => l.status === "unclear").length} unclear line(s).
        The card cannot be printed or issued until then.
      </div>
    );
  }

  if (card.status === "ready_to_issue" && isStaff) {
    return (
      <div className="panel no-print">
        <h2>Prescriber confirmed — read back and issue</h2>
        <ul className="plain">
          {card.lines.map((l, i) => (
            <li key={i}>
              <b>{l.name} {l.strength}</b>
              <div className="bn">{lineSummaryBn(l)}</div>
              {l.correctedByPrescriber && <span className="badge badge-warn">corrected by prescriber</span>}
            </li>
          ))}
        </ul>
        <label className="check">
          <input type="checkbox" checked={readBack} onChange={(e) => setReadBack(e.target.checked)} />
          I read the final card back to the patient and re-checked every line
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={!readBack || busy} onClick={() => run({ action: "issue", readBack: true })}>
          {busy ? "Issuing…" : "Verify and issue card"}
        </button>
      </div>
    );
  }

  if (card.status === "issued" && isStaff) {
    if (card.teachBack) {
      return (
        <div className={`banner no-print ${card.teachBack.result === "pass" ? "banner-ok" : "banner-warn"}`}>
          Teach-back: <b>{card.teachBack.result === "pass" ? "patient repeated the schedule correctly" : "patient needs another explanation"}</b>{" "}
          (recorded by {card.teachBack.by})
        </div>
      );
    }
    return (
      <div className="panel no-print">
        <h2>Teach-back check</h2>
        <p>Ask the patient or caregiver to repeat the schedule in their own words. Did they get it right?</p>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={busy} onClick={() => run({ action: "teachback", result: "pass" })}>
            ✓ Yes, correct
          </button>
          <button className="btn" disabled={busy} onClick={() => run({ action: "teachback", result: "fail" })}>
            ✗ Not yet
          </button>
        </div>
      </div>
    );
  }

  return null;
}
