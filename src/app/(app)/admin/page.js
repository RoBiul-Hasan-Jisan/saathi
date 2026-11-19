import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listAllCards } from "@/lib/store";
import { storageMode } from "@/lib/mongo";
import { computeStats } from "@/lib/stats";
import { FORMS, FREQUENCIES, DOSE_OPTIONS, FOOD_OPTIONS, INFO_PANEL } from "@/lib/templates";

export const dynamic = "force-dynamic";

const fmt = (iso) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

function Gate({ label, value, target, ok }) {
  return (
    <div className="stat">
      <b>{value}</b>
      <span>{label}</span>
      <small className={ok === false ? "bad" : ok ? "good" : ""}>{target}</small>
    </div>
  );
}

export default async function AdminPage() {
  const user = await getSession();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const cards = await listAllCards();
  const s = computeStats(cards);
  const events = cards
    .flatMap((c) => (c.events || []).map((e) => ({ ...e, patient: c.patientName })))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 40);

  return (
    <>
      <h1>Pilot overview</h1>
      <p className="muted">Storage: {storageMode()}</p>

      <div className="stats">
        <Gate label="Teach-back success" value={s.teachBackRate == null ? "—" : `${s.teachBackRate}%`} target="target ≥ 80%" ok={s.teachBackRate == null ? undefined : s.teachBackRate >= 80} />
        <Gate label="Median card creation" value={s.medianSeconds == null ? "—" : `${s.medianSeconds}s`} target="target < 180s" ok={s.medianSeconds == null ? undefined : s.medianSeconds < 180} />
        <Gate label="Human-verified" value={s.verifiedRate == null ? "—" : `${s.verifiedRate}%`} target="target 100%" ok={s.verifiedRate == null ? undefined : s.verifiedRate === 100} />
        <Gate label="Cards issued" value={s.issued} target={`${s.teachBackCount} teach-back checks`} />
        <Gate label="Unclear flags" value={s.unclearFlags} target="sent to prescribers" />
      </div>

      <h2>Verification log</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>When</th><th>Event</th><th>By</th><th>Patient</th></tr>
          </thead>
          <tbody>
            {events.map((e, i) => (
              <tr key={i}>
                <td>{fmt(e.at)}</td>
                <td>{e.type.replaceAll("_", " ")}{e.line != null ? ` (line ${e.line + 1})` : ""}</td>
                <td>{e.by} <small className="muted">{e.role}</small></td>
                <td>{e.patient}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Approved template library</h2>
      <p className="muted">
        Read-only here. Changes need clinical review before use. Info panel reviewed: <b>{INFO_PANEL.reviewed ? "yes" : "no — sample text"}</b>
      </p>
      <div className="panel">
        <p><b>Forms:</b> {FORMS.map((f) => f.en).join(" · ")}</p>
        <p><b>Timings:</b> {FREQUENCIES.map((f) => f.en).join(" · ")}</p>
        <p><b>Food:</b> {FOOD_OPTIONS.map((f) => f.en).join(" · ")}</p>
        <p><b>Amounts:</b> {Object.entries(DOSE_OPTIONS).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" | ")}</p>
      </div>
    </>
  );
}
