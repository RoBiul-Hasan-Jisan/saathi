export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "";

export const fmtDate = (ymd) =>
  ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" }) : "";

// Today's date in Dhaka as YYYY-MM-DD.
export const dhakaToday = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);

export const titleCase = (s) => String(s || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
