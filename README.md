# Saathi by NirapodRx: verified Bangla medicine cards

Two separate apps:

| Folder | What it is | Port |
|---|---|---|
| `backend/` | The API (plain Node.js, MongoDB, Firebase token check) | 4000 |
| `frontend/` | The website (Next.js). It forwards `/api/*` to the backend | 3000 |

## Run it (two terminals)

You need Node.js 20 or newer.

1. **Settings files.** Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`, then fill them in (or use the two ready-made files you were sent).
2. **Backend**
   ```
   cd backend
   npm install
   npm run dev
   ```
   It prints the storage mode (MongoDB or in-memory), whether demo login is on, and whether Firebase is set up.
3. **Frontend**, in a second terminal:
   ```
   cd frontend
   npm install
   npm run dev
   ```
4. Open http://localhost:3000 and tap any demo account. No password, no waiting.

Start the backend first. If it is stopped, the website shows "server is not reachable".

## Demo accounts (one tap)

Pharmacist, community health worker, patient, caregiver, doctor, admin. Demo data is sample data.

## Real accounts (Firebase + MongoDB)

- Firebase console → Authentication → Sign-in method → turn on **Email/Password**.
- Firebase console → Project settings → Service accounts → Generate new private key. Save the file as `backend/service_account.json`.
- MongoDB Atlas → Network Access → allow your IP address (or 0.0.0.0/0 while testing).
- Put your own email in `ADMIN_EMAILS` (backend `.env`), restart, then sign up with it: you become admin.
- New pharmacist and health-worker accounts wait for approval: Admin → People & places → Approve (assign a pharmacy first).
- Doctor accounts: sign up as a patient, then an admin changes the role.

If MongoDB cannot be reached, the backend keeps working with an in-memory store (data is lost on restart) and retries after a minute.

## What is built, by roadmap phase

**Phase 1: Verified cards.** Named verifier and time on every card · approved dose and phrase lists · unclear lines go to a doctor · read-back before issuing · teach-back · pilot numbers (teach-back %, median time, verification %) · staff, pharmacies, remote sign-out · incident reports · safety gate · audit log · offline readiness.

**Phase 2: Family and follow-up.** Family sharing with consent · "I took it" adherence · missed-dose alerts · refill and course-end follow-ups (WhatsApp / SMS links) · patient lookup by phone · duplicate-medicine alerts · e-prescriptions from doctors · dialect voice clips with admin approval · de-identified CSV exports (groups under 5 hidden) · picture mode · calendar reminders (.ics).

**Phase 3: DoctorGuard.** Allergy, duplicate ingredient, same-class, interaction and maximum-daily-dose checks. Every flag shows its source and must be answered by a named person. It never blocks and never decides.

**Phase 4: Care-team loop and library governance.** Reaction reports from the QR page (a person follows up, no AI replies) · escalation to a doctor · safety-gate pause · clinical sign-off for library changes (a *different* doctor must approve) · consent flags and a de-identified analytics gate.

**Offline.** Cards made with no internet are saved on the device and sent later (safe to retry). Pages, the library and voice clips are cached by a service worker (production build only: `npm run build && npm start`).

## Important limits (please read)

- **Clinical content is a SAMPLE.** The Bangla phrases, ingredient list and DoctorGuard rules are labelled "not clinically reviewed" until a doctor approves them in the Library. Do not use with real patients before that.
- DoctorGuard flags are prompts to check, not medical advice.
- Offline cards cannot run DoctorGuard until they sync; flags then appear for a named person to answer.
- RxScan (photo of the prescription) runs in the browser. The first scan needs internet to download language data. It only suggests medicine names.
- Reminders are calendar alarms on the phone. There is no server push.
- Voice: recorded dialect clips are used when approved; patient and medicine names are always read by the device's own Bangla voice (must be installed on the device).
- Production: set a strong `SESSION_SECRET`, `ENABLE_DEMO=false`, serve over https, and host the frontend and backend so that `BACKEND_URL` points to the backend.

## Tests

`cd backend && npm test` runs 27 tests (rules and real HTTP flows for every phase).
