import Link from "next/link";
import { notFound } from "next/navigation";
import { getCardByToken } from "@/lib/store";
import { publicCard } from "@/lib/perms";
import CardView from "@/components/CardView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medicine card — Saathi" };

// Public page behind the QR code on the printed card. Unguessable token, no login,
// and only the fields the family needs (no phone, emails or audit trail).
export default async function PublicCardPage({ params }) {
  const { token } = await params;
  const card = await getCardByToken(token);
  if (!card || card.status !== "issued") notFound();

  return (
    <main className="container">
      <Link href="/" className="brand dark no-print">
        <span className="brand-mark">+</span> Saathi
      </Link>
      <CardView card={publicCard(card)} />
    </main>
  );
}
