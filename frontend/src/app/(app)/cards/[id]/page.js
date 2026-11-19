"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLibrary } from "@/lib/library";
import CardView from "@/components/CardView";
import AudioGuide from "@/components/AudioGuide";
import AdherencePanel from "@/components/AdherencePanel";
import CardActions from "@/components/CardActions";
import QrCode from "@/components/QrCode";
import { downloadIcs } from "@/lib/ics";
import { publicUrl, shareText, smsLink, whatsappLink } from "@/lib/share";
import { fmtDateTime } from "@/lib/format";

export default function CardPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { phrases, meta } = useLibrary();
  const [card, setCard] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (id.startsWith("local-")) return router.replace(`/cards/local?id=${id}`);
    api(`/api/cards/${id}`).then((d) => setCard(d.card)).catch((e) => setErr(e.message));
  }, [id, router]);

  if (err) return <div className="notice bad">{err}</div>;
  if (!card || !user) return <p className="muted">Loading…</p>;

  const staff = ["pharmacist", "chw"].includes(user.role);
  const family = ["patient", "caregiver"].includes(user.role);
  const issued = card.status === "issued";
  const canShare = staff && issued && card.consent?.family;

  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      {card.status === "awaiting_prescriber" && <div className="notice warn">One or more lines are waiting for a doctor. Do not hand this card to the patient yet.</div>}
      {card.guardReview === "pending" && staff && <div className="notice warn">DoctorGuard flags on this card still need your answer (below).</div>}
      <CardView card={card} />

      {issued && (
        <div className="card row between">
          <div className="stack"><b>QR code</b><span className="small muted">Family scans it to see, hear and tick off doses. Works on any phone.</span>
            <div className="row noprint">
              <button className="btn secondary small" onClick={() => window.print()}>Print card</button>
              <button className="btn secondary small" onClick={() => downloadIcs(card, phrases)}>Reminders (.ics)</button>
              {canShare && <a className="btn secondary small" target="_blank" rel="noreferrer" href={whatsappLink(card.patientPhone, shareText(card))}>WhatsApp</a>}
              {canShare && <a className="btn secondary small" href={smsLink(card.patientPhone, shareText(card))}>SMS</a>}
              {staff && issued && !card.consent?.family && <span className="small muted">Record family consent to enable sharing.</span>}
            </div>
          </div>
          <QrCode text={publicUrl(card.token)} />
        </div>
      )}

      {issued && <AudioGuide card={card} />}
      {issued && <AdherencePanel base={`/api/cards/${card.id}`} canTick />}

      {card.courseEndsOn && issued && <p className="small muted">Course ends {card.courseEndsOn}{card.daysLeft != null ? ` (${card.daysLeft >= 0 ? `${card.daysLeft} day(s) left` : "finished"})` : ""}.</p>}

      {!family && <CardActions card={card} onChange={setCard} reviewedRules={!!(meta?.rules?.reviewed && meta?.ingredients?.reviewed)} />}

      {!family && card.events && (
        <details className="card">
          <summary><b>Audit trail</b> <span className="small muted">({card.events.length} events{card.offline ? " · created offline" : ""})</span></summary>
          <table style={{ marginTop: ".5rem" }}><tbody>
            {card.events.map((e, i) => <tr key={i}><td className="small">{fmtDateTime(e.at)}</td><td>{e.type.replace(/_/g, " ")}{e.detail ? ` — ${e.detail}` : ""}</td><td className="small muted">{e.by} {e.role ? `(${e.role})` : ""}</td></tr>)}
          </tbody></table>
        </details>
      )}
    </div>
  );
}
