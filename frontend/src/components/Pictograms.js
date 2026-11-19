"use client";
// Simple pictures for people who read little or no text: when to take it, with or without food, how much.

const S = { fill: "none", stroke: "#0f766e", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };
const wrap = (children, label) => (
  <svg viewBox="0 0 48 48" role="img" aria-label={label}>
    <title>{label}</title>
    {children}
  </svg>
);

export const Sunrise = () =>
  wrap(
    <g {...S}>
      <path d="M6 36h36M14 36a10 10 0 0 1 20 0" />
      <path d="M24 12v6M10 22l4 4M38 22l-4 4" />
    </g>,
    "Morning"
  );
export const Sun = () =>
  wrap(
    <g {...S}>
      <circle cx="24" cy="24" r="8" />
      <path d="M24 6v5M24 37v5M6 24h5M37 24h5M11 11l3.5 3.5M33.5 33.5L37 37M37 11l-3.5 3.5M14.5 33.5L11 37" />
    </g>,
    "Afternoon"
  );
export const Moon = () =>
  wrap(
    <g {...S}>
      <path d="M36 28A14 14 0 1 1 20 10a11 11 0 0 0 16 18z" />
    </g>,
    "Night"
  );
export const RiceBowl = () =>
  wrap(
    <g {...S}>
      <path d="M6 24h36a18 14 0 0 1-36 0z" />
      <path d="M12 24c2-8 22-8 24 0M18 38h12" />
    </g>,
    "After food"
  );
export const EmptyBowl = () =>
  wrap(
    <g {...S}>
      <path d="M6 20h36a18 14 0 0 1-36 0z" />
      <path d="M18 34h12" />
    </g>,
    "Before food (empty stomach)"
  );
export const Glass = () =>
  wrap(
    <g {...S}>
      <path d="M14 8h20l-3 32H17z" />
      <path d="M15 20h18" />
    </g>,
    "With water"
  );
export const Pill = () =>
  wrap(
    <g {...S} fill="#e1f3f0">
      <rect x="8" y="18" width="32" height="12" rx="6" transform="rotate(-35 24 24)" />
      <path d="M17 28l14-12" />
    </g>,
    "Tablet"
  );
export const HalfPill = () =>
  wrap(
    <g {...S}>
      <circle cx="24" cy="24" r="13" />
      <path d="M24 11v26" />
      <path d="M24 11a13 13 0 0 0 0 26z" fill="#9bd6cf" />
    </g>,
    "Half tablet"
  );
export const Capsule = () =>
  wrap(
    <g {...S}>
      <rect x="6" y="17" width="36" height="14" rx="7" transform="rotate(-30 24 24)" />
      <path d="M24 16.5l0 15" transform="rotate(-30 24 24)" />
    </g>,
    "Capsule"
  );
export const Spoon = () =>
  wrap(
    <g {...S}>
      <ellipse cx="17" cy="17" rx="8" ry="10" transform="rotate(-35 17 17)" />
      <path d="M23 24l16 16" />
    </g>,
    "Spoon (syrup)"
  );
export const Drop = () =>
  wrap(
    <g {...S}>
      <path d="M24 6C16 18 12 24 12 30a12 12 0 0 0 24 0c0-6-4-12-12-24z" />
    </g>,
    "Drops"
  );
export const Calendar = () =>
  wrap(
    <g {...S}>
      <rect x="8" y="10" width="32" height="30" rx="4" />
      <path d="M8 20h32M16 6v8M32 6v8" />
    </g>,
    "Days"
  );

export const TIME_ICON = { morning: Sunrise, afternoon: Sun, night: Moon };
export const FOOD_ICON = { after: RiceBowl, before: EmptyBowl, none: Glass };
export const FORM_ICON = { tablet: Pill, capsule: Capsule, syrup: Spoon, drops: Drop, other: Pill };

// How many tablets/capsules for one dose, as repeated pictures (syrup/drops show a number instead).
export function DoseIcons({ form, n }) {
  if (form === "tablet" && n === 0.5) return <HalfPill />;
  if (form === "tablet" || form === "capsule") {
    const Icon = FORM_ICON[form];
    return Array.from({ length: Math.min(Math.round(n), 4) }, (_, i) => <Icon key={i} />);
  }
  const Icon = FORM_ICON[form] || Pill;
  return (
    <>
      <Icon />
      <b>{n}</b>
    </>
  );
}
