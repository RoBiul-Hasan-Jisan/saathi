"use client";
import { useState } from "react";
import { useLibrary } from "@/lib/library";
import { bn, doseText, foodBn, timeBn, timeLabelBn, TIME_LABEL_EN } from "@/lib/bangla";
import { TIMES } from "@/lib/templates";
import { fmtDateTime } from "@/lib/format";
import { DoseIcons, FOOD_ICON, TIME_ICON, Calendar } from "./Pictograms";

// The patient-facing card: big Bangla text, with an optional picture mode.
export default function CardView({ card }) {
  const { phrases: P, infoPanel, meta } = useLibrary();
  const [pictures, setPictures] = useState(false);
  const reviewed = !!(meta?.phrases?.reviewed && meta?.infoPanel?.reviewed);

  return (
    <div className="stack">
      <div className="card">
        <div className="row between">
          <div>
            <h2 className="bn" style={{ marginBottom: 0 }}>{card.patientName}</h2>
            <div className="muted small">{card.patientAge != null ? `${card.patientAge} years · ` : ""}{card.status === "issued" ? "Verified card" : "Not yet issued"}</div>
          </div>
          <div className="tabs noprint" role="group" aria-label="Card style">
            <button className={`tab ${!pictures ? "on" : ""}`} onClick={() => setPictures(false)}>Words</button>
            <button className={`tab ${pictures ? "on" : ""}`} onClick={() => setPictures(true)}>Pictures</button>
          </div>
        </div>
        {card.verifier && (
          <p className="small" style={{ marginTop: ".6rem" }}>
            <span className="badge ok">Verified</span> by <b>{card.verifier.name}</b> · {fmtDateTime(card.verifier.at)}
          </p>
        )}
        {card.status === "voided" && <div className="notice bad">This card was cancelled. Do not use it. Ask the pharmacy.</div>}
        {!reviewed && <div className="notice warn small" style={{ marginTop: ".5rem" }}>Sample wording: not yet clinically reviewed by a doctor.</div>}
      </div>

      {card.lines.map((l, i) =>
        l.status === "unclear" ? (
          <div key={i} className="medline unclear">
            <b>Medicine {i + 1}: waiting for doctor</b>
            <p className="small muted">This line was not clear. A doctor will confirm it. Do not take it until then.</p>
          </div>
        ) : (
          <div key={i} className="medline">
            <div className="row between">
              <h3 className="bn" style={{ margin: 0 }}>{bn(i + 1)}. {l.name} {l.strength}</h3>
              <span className="badge gray">{l.form}</span>
            </div>
            {!pictures ? (
              <div className="stack" style={{ marginTop: ".5rem" }}>
                {TIMES.filter((t) => l.pattern?.[t] > 0).map((t) => (
                  <div key={t} className="big-bn bn">
                    <b>{timeBn(P, t)}</b>: {doseText(P, l, l.pattern[t])}
                  </div>
                ))}
                <div className="bn">{foodBn(P, l.food)} · <b>{bn(l.days)} {P["days.word"]}</b></div>
              </div>
            ) : (
              <>
                <div className="slots">
                  {TIMES.map((t) => {
                    const n = l.pattern?.[t];
                    const Icon = TIME_ICON[t];
                    return (
                      <div key={t} className={`slot ${n > 0 ? "on" : ""}`} style={n > 0 ? undefined : { opacity: 0.35 }}>
                        <Icon />
                        <div className="small bn">{timeLabelBn(P, t)}</div>
                        <div className="small muted">{TIME_LABEL_EN[t]}</div>
                        {n > 0 && <div className="picto"><DoseIcons form={l.form} n={n} /></div>}
                      </div>
                    );
                  })}
                </div>
                <div className="row" style={{ marginTop: ".5rem", justifyContent: "center" }}>
                  {(() => { const F = FOOD_ICON[l.food] || FOOD_ICON.none; return <span className="picto"><F /> <span className="bn">{foodBn(P, l.food)}</span></span>; })()}
                  <span className="picto"><Calendar /> <b className="bn">{bn(l.days)} {P["days.word"]}</b></span>
                </div>
              </>
            )}
          </div>
        )
      )}

      <div className="card">
        <h3 className="bn">{infoPanel.titleBn}</h3>
        <ul className="bn" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {infoPanel.itemsBn.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
    </div>
  );
}
