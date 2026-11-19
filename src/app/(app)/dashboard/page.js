import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listCards } from "@/lib/store";
import { computeStats } from "@/lib/stats";
import { STAFF } from "@/lib/perms";
import CardList from "@/components/CardList";
import DoctorQueue from "@/components/DoctorQueue";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export default async function Dashboard() {
  const user = await getSession();
  if (!user) redirect("/login");

  const cards = await listCards(user);
  const stats = computeStats(cards);
  const isStaff = STAFF.includes(user.role);

  if (user.role === "doctor") {
    const queue = cards.filter((c) => c.lines.some((l) => l.status === "unclear"));
    const rest = cards.filter((c) => !queue.includes(c));
    return (
      <>
        <h1>Prescriber review</h1>
        <p className="muted">Pharmacists send a question when handwriting or an instruction is unclear. Nothing is guessed.</p>
        <DoctorQueue cards={queue} />
        <h2>Other cards</h2>
        <CardList cards={rest} />
      </>
    );
  }

  return (
    <>
      <div className="row between">
        <h1>{isStaff ? "Medicine cards" : user.role === "admin" ? "All cards" : "My medicine cards"}</h1>
        {isStaff && (
          <Link href="/cards/new" className="btn btn-primary">
            + New card
          </Link>
        )}
      </div>

      {(isStaff || user.role === "admin") && (
        <div className="stats">
          <Stat label="Cards issued" value={stats.issued} />
          <Stat label="Awaiting prescriber" value={stats.awaiting} />
          <Stat label="Ready to issue" value={stats.ready} />
          <Stat
            label="Teach-back success"
            value={stats.teachBackRate == null ? "—" : `${stats.teachBackRate}%`}
            hint="target 80%+"
          />
          <Stat
            label="Median card time"
            value={stats.medianSeconds == null ? "—" : `${stats.medianSeconds}s`}
            hint="target under 3 min"
          />
        </div>
      )}

      <CardList
        cards={cards}
        empty={
          isStaff
            ? "No cards yet. Create the first one."
            : "No cards have been shared with this account yet. Ask the pharmacist to share a card with your email."
        }
      />
    </>
  );
}
