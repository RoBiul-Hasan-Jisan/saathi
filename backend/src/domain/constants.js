export const TIMES = ["morning", "afternoon", "night"];

export const ROLES = ["pharmacist", "patient", "caregiver", "doctor", "chw", "admin"];
// People who create and issue cards on a shared device.
export const STAFF = ["pharmacist", "chw"];
// Roles anybody may pick when signing up. Doctor and admin are always granted by an admin.
export const SELF_SIGNUP_ROLES = ["pharmacist", "patient", "caregiver", "chw"];

export const FORM_KEYS = ["tablet", "capsule", "syrup", "drops", "other"];
export const FOOD_KEYS = ["before", "after", "none"];

// Approved amounts per form: staff pick from these instead of typing free text.
export const DOSE_OPTIONS = {
  tablet: [0.5, 1, 2],
  capsule: [1, 2],
  syrup: [2.5, 5, 10, 15],
  drops: [1, 2, 3, 5],
  other: [1, 2],
};

export const SLOT_TIMES = { morning: "08:00", afternoon: "14:00", night: "21:00" };
export const GRACE_MIN = 120; // a dose counts as "missed" two hours after its slot time

export const DIALECTS = [
  { code: "std", name: "Standard Bangla" },
  { code: "ctg", name: "Chattogram" },
  { code: "syl", name: "Sylheti" },
  { code: "noa", name: "Noakhali" },
];

export const MAX_COURSE_DAYS = 90;
