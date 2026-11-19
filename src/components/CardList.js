import Link from "next/link";

const STATUS = {
  issued: { label: "Issued", cls: "badge-ok" },
  awaiting_prescriber: { label: "Awaiting prescriber", cls: "badge-warn" },
  ready_to_issue: { label: "Ready to issue", cls: "badge-info" },
};

const fmt = (iso) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

export default function CardList({ cards, empty = "No cards yet." }) {
  if (!cards.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Medicines</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => {
            const s = STATUS[c.status] || { label: c.status, cls: "" };
            return (
              <tr key={c.id}>
                <td>{c.patientName}</td>
                <td>{c.lines.length}</td>
                <td>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                </td>
                <td>{fmt(c.createdAt)}</td>
                <td>
                  <Link href={`/cards/${c.id}`} className="link">
                    Open →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
