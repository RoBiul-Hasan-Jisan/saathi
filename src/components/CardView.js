"use client";
import { TIMES, INFO_PANEL } from "@/lib/templates";
import {
  TIME_LABEL_BN,
  TIME_LABEL_EN,
  FOOD_ICON,
  doseText,
  foodBn,
  lineSummaryBn,
  speechChunksBn,
  bn,
} from "@/lib/bangla";
import SpeechPlayer from "./SpeechPlayer";
import QrCode from "./QrCode";

const TIME_ICON = { morning: "🌅", afternoon: "☀️", night: "🌙" };

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "";

export default function CardView({ card }) {
  const issued = card.status === "issued";

  return (
    <article className="med-card print-area">
      <header className="med-card-head">
        <div>
          <p className="eyebrow">ওষুধের কার্ড · Medicine card</p>
          <h1>{card.patientName}</h1>
          {card.patientAge && <p className="muted">বয়স {bn(card.patientAge)} · Age {card.patientAge}</p>}
        </div>
        {issued && <QrCode token={card.token} />}
      </header>

      {!issued && (
        <div className="banner banner-warn">
          This card is <b>not issued yet</b>. Do not give it to the patient until every line is confirmed and verified.
        </div>
      )}

      {issued && <SpeechPlayer chunks={speechChunksBn(card)} />}

      <section>
        <h2 className="section-title">সময়সূচি · Daily timetable</h2>
        <div className="timetable">
          {TIMES.map((t) => {
            const items = card.lines.map((line, i) => ({ line, i })).filter(({ line }) => line.pattern?.[t] > 0);
            return (
              <div className="slot" key={t}>
                <div className="slot-head">
                  <span className="slot-icon" aria-hidden>
                    {TIME_ICON[t]}
                  </span>
                  <div>
                    <b>{TIME_LABEL_BN[t]}</b>
                    <small>{TIME_LABEL_EN[t]}</small>
                  </div>
                </div>
                {items.length ? (
                  items.map(({ line, i }) => (
                    <div className="dose" key={i}>
                      <span className="pill">{bn(i + 1)}</span>
                      <div>
                        <b>{line.name}</b> {line.strength}
                        <div className="bn">{doseText(line, line.pattern[t])}</div>
                        <div className="food">
                          {FOOD_ICON[line.food]} {foodBn(line.food)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="none">—</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">ওষুধের তালিকা · Medicines</h2>
        <ol className="med-list">
          {card.lines.map((line, i) => (
            <li key={i} className={line.status === "unclear" ? "unclear" : ""}>
              <span className="pill">{bn(i + 1)}</span>
              <div>
                <b>
                  {line.name} {line.strength}
                </b>
                {line.status === "unclear" ? (
                  <p className="warn">Waiting for prescriber: {line.note}</p>
                ) : (
                  <p className="bn">{lineSummaryBn(line)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="info-panel">
        <h2 className="section-title">
          {INFO_PANEL.titleBn}
          {!INFO_PANEL.reviewed && <span className="badge badge-warn">sample text · clinical review pending</span>}
        </h2>
        <ul>
          {INFO_PANEL.itemsBn.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <footer className="med-card-foot">
        {issued && card.verifier ? (
          <p>
            ✓ Verified by <b>{card.verifier.name}</b> · {fmt(card.verifier.at)}
          </p>
        ) : (
          <p>Not verified</p>
        )}
        <p className="muted">
          NirapodRx explains the prescriber's instructions. It does not prescribe or change them. SAMPLE ONLY — NOT
          MEDICAL ADVICE.
        </p>
        {issued && (
          <button className="btn btn-primary no-print" onClick={() => window.print()}>
            🖨 Print take-home card
          </button>
        )}
      </footer>
    </article>
  );
}
