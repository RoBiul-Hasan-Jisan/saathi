"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLibrary } from "@/lib/library";
import { timeBn, TIME_LABEL_EN } from "@/lib/bangla";
import { fmtDate } from "@/lib/format";

// "I took it" ticks. `base` is /api/cards/:id (logged in) or /api/public/cards/:token (QR page).
export default function AdherencePanel({ base, canTick = true }) {
  const { phrases: P } = useLibrary();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const isPublic = base.startsWith("/api/public/");

  const load = useCallback(async () => {
    try {
      const d = await api(isPublic ? base : `${base}/adherence`);
      setData(isPublic ? d.adherence : d.adherence);
    } catch (e) {
      setErr(e.message);
    }
  }, [base, isPublic]);
  useEffect(() => { load(); }, [load]);

  async function toggle(r) {
    setErr("");
    try {
      const d = await api(`${base}/intake`, { method: r.status === "taken" ? "DELETE" : "POST", body: { slot: r.slot, date: r.date } });
      setData(d.adherence);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (!data?.rows?.length) return err ? <div className="notice bad">{err}</div> : null;
  const byDate = data.rows.reduce((m, r) => ((m[r.date] ||= []).push(r), m), {});
  return (
    <div className="card">
      <div className="row between">
        <h3>Doses taken</h3>
        <span className="badge">{data.percent == null ? "—" : `${data.percent}% so far`}</span>
      </div>
      {err && <div className="notice bad">{err}</div>}
      <div className="stack">
        {Object.entries(byDate).map(([date, rows]) => (
          <div key={date}>
            <div className="small muted">{fmtDate(date)}</div>
            <div className="row">
              {rows.map((r) => (
                <button key={r.slot} className={`btn small ${r.status === "taken" ? "" : "secondary"}`} disabled={!canTick || r.status === "upcoming"} onClick={() => toggle(r)} title={TIME_LABEL_EN[r.slot]}>
                  {r.status === "taken" ? "✓ " : r.status === "missed" ? "! " : ""}
                  <span className="bn">{timeBn(P, r.slot)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Tap a time after taking the medicine. Tap again to undo.</p>
    </div>
  );
}
