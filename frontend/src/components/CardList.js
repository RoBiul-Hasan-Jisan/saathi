"use client";
import Link from "next/link";
import { fmtDateTime } from "@/lib/format";

const BADGE = { issued: ["ok", "Issued"], awaiting_prescriber: ["warn", "Waiting for doctor"], ready_to_issue: ["warn", "Ready to issue"], voided: ["bad", "Withdrawn"] };

export default function CardList({ cards, empty = "No cards yet." }) {
  if (!cards?.length) return <p className="muted">{empty}</p>;
  return (
    <div className="stack">
      {cards.map((c) => {
        const [cls, label] = BADGE[c.status] || ["gray", c.status];
        return (
          <Link key={c.id} href={`/cards/${c.id}`} className="card tight" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <div className="row between">
              <b className="bn">{c.patientName}</b>
              <span className={`badge ${cls}`}>{label}</span>
            </div>
            <div className="small muted">{c.lines.map((l) => l.name).join(", ")} · {fmtDateTime(c.createdAt)}</div>
            {c.guardReview === "pending" && <span className="badge warn">DoctorGuard flag to review</span>}
            {c.guardReview === "referred" && <span className="badge warn">Referred to doctor</span>}
          </Link>
        );
      })}
    </div>
  );
}
