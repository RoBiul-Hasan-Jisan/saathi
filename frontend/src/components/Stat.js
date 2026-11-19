export default function Stat({ label, value, hint }) {
  return (
    <div className="card stat">
      <b>{value ?? "—"}</b>
      <div className="small">{label}</div>
      {hint && <div className="small muted">{hint}</div>}
    </div>
  );
}
