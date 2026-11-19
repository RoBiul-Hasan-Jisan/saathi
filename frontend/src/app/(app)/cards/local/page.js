"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getPending, syncedIdFor, syncPending } from "@/lib/offline";
import CardView from "@/components/CardView";
import QrCode from "@/components/QrCode";
import AudioGuide from "@/components/AudioGuide";
import { publicUrl } from "@/lib/share";

// A card saved on this device while offline. After it syncs, this page forwards to the real card.
function Local() {
  const id = useSearchParams().get("id") || "";
  const router = useRouter();
  const [item, setItem] = useState(undefined);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const synced = syncedIdFor(id);
    if (synced) return router.replace(`/cards/${synced}`);
    getPending(id).then(setItem).catch(() => setItem(null));
  }, [id, router]);

  async function retry() {
    setMsg("Sending…");
    const r = await syncPending();
    const mine = r.find((x) => x.localId === id);
    if (mine?.ok) router.replace(`/cards/${mine.id}`);
    else setMsg(mine?.offline ? "Still offline." : mine?.error || "Nothing to send.");
  }

  if (item === undefined) return <p className="muted">Loading…</p>;
  if (!item) return <div className="notice warn">This offline card is not on this device any more. <Link href="/dashboard">Back home</Link></div>;
  const flaggedUnclear = item.card.status === "awaiting_prescriber";
  return (
    <div className="stack" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="notice warn"><b>Saved on this device only.</b> It will be sent to the server automatically when the internet is back. DoctorGuard will run then, and you will be asked to review any flags. {item.status === "error" && <b>Last attempt failed: {item.error}</b>}</div>
      <CardView card={item.card} />
      {!flaggedUnclear && <AudioGuide card={item.card} />}
      <div className="card row between"><div><b>QR code</b><div className="small muted">The QR page works once the card has synced.</div></div><QrCode text={publicUrl(item.card.token)} /></div>
      <div className="row noprint"><button className="btn" onClick={retry}>Send now</button><button className="btn secondary" onClick={() => window.print()}>Print</button>{msg && <span className="small">{msg}</span>}</div>
    </div>
  );
}

export default function LocalPage() {
  return <Suspense fallback={<p className="muted">Loading…</p>}><Local /></Suspense>;
}
