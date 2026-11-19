// Pilot metrics from the deck: teach-back success, median card-creation time, human verification,
// offline readiness. Pure functions over cards / readiness reports.

export function computeStats(cards) {
  const issued = cards.filter((c) => c.status === "issued");
  const withTeachBack = issued.filter((c) => c.teachBack);
  const passed = withTeachBack.filter((c) => c.teachBack.result === "pass").length;

  const secs = issued.map((c) => c.creationSeconds).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  let median = null;
  if (secs.length) {
    const mid = Math.floor(secs.length / 2);
    median = secs.length % 2 ? secs[mid] : Math.round((secs[mid - 1] + secs[mid]) / 2);
  }

  const events = cards.flatMap((c) => c.events || []);
  return {
    total: cards.length,
    issued: issued.length,
    awaiting: cards.filter((c) => c.status === "awaiting_prescriber").length,
    ready: cards.filter((c) => c.status === "ready_to_issue").length,
    voided: cards.filter((c) => c.status === "voided").length,
    teachBackCount: withTeachBack.length,
    teachBackRate: withTeachBack.length ? Math.round((passed / withTeachBack.length) * 100) : null,
    medianSeconds: median,
    verifiedRate: issued.length ? Math.round((issued.filter((c) => c.verifier?.name && c.verifier?.at).length / issued.length) * 100) : null,
    unclearFlags: events.filter((e) => e.type === "flagged_unclear").length,
    guardFlags: cards.reduce((n, c) => n + (c.guard?.flags?.length || 0), 0),
    offlineCards: cards.filter((c) => c.offline).length,
  };
}

// Latest report per device, then the average readiness score.
export function readinessSummary(reports) {
  const latest = new Map();
  for (const r of [...reports].sort((a, b) => (a.at < b.at ? -1 : 1))) latest.set(r.deviceId, r);
  const list = [...latest.values()];
  return {
    devices: list.length,
    averageScore: list.length ? Math.round(list.reduce((s, r) => s + r.score, 0) / list.length) : null,
    belowTarget: list.filter((r) => r.score < 95).length,
  };
}
