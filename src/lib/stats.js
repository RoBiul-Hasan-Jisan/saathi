// Pilot metrics from the deck: teach-back success, median card-creation time,
// human-verification rate. Pure function, safe to call from server components.
export function computeStats(cards) {
  const issued = cards.filter((c) => c.status === "issued");
  const withTeachBack = issued.filter((c) => c.teachBack);
  const passed = withTeachBack.filter((c) => c.teachBack.result === "pass").length;

  const secs = issued
    .map((c) => c.creationSeconds)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let median = null;
  if (secs.length) {
    const mid = Math.floor(secs.length / 2);
    median = secs.length % 2 ? secs[mid] : Math.round((secs[mid - 1] + secs[mid]) / 2);
  }

  return {
    total: cards.length,
    issued: issued.length,
    awaiting: cards.filter((c) => c.status === "awaiting_prescriber").length,
    ready: cards.filter((c) => c.status === "ready_to_issue").length,
    teachBackCount: withTeachBack.length,
    teachBackRate: withTeachBack.length ? Math.round((passed / withTeachBack.length) * 100) : null,
    medianSeconds: median,
    verifiedRate: issued.length
      ? Math.round((issued.filter((c) => c.verifier?.name && c.verifier?.at).length / issued.length) * 100)
      : null,
    unclearFlags: cards.reduce((n, c) => n + (c.events || []).filter((e) => e.type === "flagged_unclear").length, 0),
  };
}
