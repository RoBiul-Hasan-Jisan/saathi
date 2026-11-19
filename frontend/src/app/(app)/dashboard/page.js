"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { patch } from "@/lib/api";
import Stat from "@/components/Stat";
import CardList from "@/components/CardList";
import { followUpText, smsLink, whatsappLink } from "@/lib/share";
import { fmtDate } from "@/lib/format";

export default function Dashboard() {
  const { user, offline } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api("/api/dashboard").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { if (user) load(); }, [user]);

  if (err) return <div className="notice bad">{offline ? "You are offline. New cards still work (New card), and will be sent later." : err}</div>;
  if (!d) return <p className="muted">Loading…</p>;
  const s = d.stats;
  const staff = ["pharmacist", "chw"].includes(user.role);

  return (
    <div className="stack">
      <h1>Hello, {user.name}</h1>
      {d.safetyGate?.paused && <div className="notice bad"><b>New cards are paused.</b> {d.safetyGate.reason} An admin must review the report and clear the safety gate.</div>}

      {staff && (
        <>
          <div className="row"><Link className="btn" href="/cards/new">+ New medicine card</Link>
            {d.eprescriptionsWaiting > 0 && <Link className="btn secondary" href="/eprescriptions">{d.eprescriptionsWaiting} e-prescription(s) waiting</Link>}
            {d.openIncidents > 0 && <Link className="btn secondary" href="/incidents">{d.openIncidents} open report(s)</Link>}
          </div>
          <div className="grid">
            <Stat label="Cards issued" value={s.issued} />
            <Stat label="Waiting for doctor" value={s.awaiting} />
            <Stat label="Teach-back success" value={s.teachBackRate == null ? "—" : `${s.teachBackRate}%`} hint={`${s.teachBackCount} recorded · goal ≥ 90%`} />
            <Stat label="Median time per card" value={s.medianSeconds == null ? "—" : `${s.medianSeconds}s`} hint="goal ≤ 60s" />
            <Stat label="Verified by a named person" value={s.verifiedRate == null ? "—" : `${s.verifiedRate}%`} hint="goal 100%" />
          </div>
          {d.guardReview?.length > 0 && (
            <div className="notice warn"><b>DoctorGuard flags need your answer:</b> {d.guardReview.map((g) => <Link key={g.cardId} href={`/cards/${g.cardId}`} style={{ marginRight: ".6rem" }}>{g.patientName}</Link>)}</div>
          )}
          {d.followUps?.length > 0 && (
            <div className="card stack">
              <h3>Follow-ups: course ending soon or just ended</h3>
              {d.followUps.map((f) => (
                <div key={f.cardId} className="row between">
                  <div><b className="bn">{f.patientName}</b> <span className="small muted">course ends {fmtDate(f.endsOn)}{f.antibiotic ? " · antibiotic" : ""}</span></div>
                  <div className="row">
                    {f.phone && <a className="btn secondary small" href={whatsappLink(f.phone, followUpText(f.patientName, fmtDate(f.endsOn)))} target="_blank" rel="noreferrer">WhatsApp</a>}
                    {f.phone && <a className="btn secondary small" href={smsLink(f.phone, followUpText(f.patientName, fmtDate(f.endsOn)))}>SMS</a>}
                    <button className="btn small" onClick={async () => { await patch(`/api/cards/${f.cardId}`, { action: "followup_done" }); load(); }}>Done</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {user.role === "doctor" && (
        <>
          <div className="grid">
            <Stat label="Lines waiting for you" value={d.queue.length} />
            <Stat label="DoctorGuard referrals" value={d.guardReferred.length} />
            <Stat label="Library changes to review" value={d.libraryPending} />
            <Stat label="Open reports" value={d.openIncidents} />
          </div>
          <div className="row"><Link className="btn" href="/eprescriptions">Write an e-prescription</Link>{d.libraryPending > 0 && <Link className="btn secondary" href="/library">Review library</Link>}</div>
          <h2>Waiting for you</h2>
          <CardList cards={d.queue} empty="Nothing waiting." />
          {d.guardReferred.length > 0 && <><h2>Referred by DoctorGuard</h2><CardList cards={d.cards.filter((c) => d.guardReferred.some((g) => g.cardId === c.id))} /></>}
        </>
      )}

      {(user.role === "patient" || user.role === "caregiver") && (
        <>
          {d.alerts?.map((a) => (
            <div key={a.cardId} className="notice warn"><b className="bn">{a.patientName}</b>: {a.missed.length} dose(s) not marked as taken recently. <Link href={`/cards/${a.cardId}`}>Open card</Link></div>
          ))}
          <CardList cards={d.cards} empty="No cards have been shared with you yet. Ask the pharmacy to use your email address." />
        </>
      )}

      {user.role === "admin" && (
        <div className="notice info">Admins see de-identified information only. Go to <Link href="/admin">Overview</Link> for pilot numbers, the safety gate, logs and exports.</div>
      )}

      {staff && (<><h2>Recent cards</h2><CardList cards={d.cards.slice(0, 20)} /></>)}
    </div>
  );
}
