"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useLibrary } from "@/lib/library";
import CardView from "@/components/CardView";
import AudioGuide from "@/components/AudioGuide";
import AdherencePanel from "@/components/AdherencePanel";
import ReportProblem from "@/components/ReportProblem";
import QrCode from "@/components/QrCode";
import { downloadIcs } from "@/lib/ics";
import { publicUrl } from "@/lib/share";

// What a family sees after scanning the QR code. No login needed.
export default function PublicCard() {
  const { token } = useParams();
  const { phrases } = useLibrary();
  const [card, setCard] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/api/public/cards/${token}`).then((d) => setCard(d.card)).catch((e) => setErr(e.status === 404 ? "This card was not found. Check the QR code or ask the pharmacy." : e.message));
  }, [token]);

  if (err) return <div className="narrow"><div className="notice bad">{err}</div></div>;
  if (!card) return <div className="narrow center muted">Loading…</div>;

  const live = card.status === "issued";
  return (
    <div className="narrow stack">
      <div className="small muted">Saathi · medicine card</div>
      <CardView card={card} />
      {live && <AudioGuide card={card} />}
      {live && <AdherencePanel base={`/api/public/cards/${token}`} />}
      {live && (
        <div className="card noprint row between">
          <div><b>Reminders on your phone</b><div className="small muted">Adds an alarm for every dose to your calendar. Works without internet.</div></div>
          <button className="btn secondary" onClick={() => downloadIcs(card, phrases)}>Download reminders</button>
        </div>
      )}
      {live && <ReportProblem token={token} />}
      <div className="card center">
        <QrCode text={publicUrl(token)} size={150} />
        <div className="small muted">Scan to open this card again</div>
        <button className="btn secondary small noprint" onClick={() => window.print()}>Print</button>
      </div>
    </div>
  );
}
