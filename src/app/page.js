import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DemoLogin from "@/components/DemoLogin";
import { DEMO_USERS } from "@/lib/demoUsers";

export default async function Home() {
  const user = await getSession();
  if (user) redirect("/dashboard");

  const demoOn = process.env.ENABLE_DEMO !== "false";
  const users = DEMO_USERS.map(({ role, title, blurb }) => ({ role, title, blurb }));

  return (
    <main>
      <section className="hero">
        <div className="container">
          <p className="eyebrow light">NirapodRx · Rural-first MVP</p>
          <h1>
            Saathi: medicine safety,
            <br />
            explained in Bangla.
          </h1>
          <p className="lead">
            A verified medicine card that travels from the pharmacy to the family home — audio, a visual timetable and
            a printed card, with a clear role for every person in the journey.
          </p>
          <div className="row">
            <Link href="/login" className="btn btn-light">
              Sign in
            </Link>
            <a href="#demo" className="btn btn-outline-light">
              Try a demo account
            </a>
          </div>
        </div>
      </section>

      <section className="container features">
        <div className="feature"><b>1 · Verified entry</b><span>A worker copies the prescription and confirms every line. Name and time are logged.</span></div>
        <div className="feature"><b>2 · Bangla audio guide</b><span>Plain-language instructions read aloud, so literacy is not required.</span></div>
        <div className="feature"><b>3 · Visual timetable</b><span>Morning, afternoon and night with simple icons.</span></div>
        <div className="feature"><b>4 · Offline + printed</b><span>Print a take-home card with a QR code that replays the audio.</span></div>
      </section>

      {demoOn && (
        <section className="container" id="demo">
          <h2>Demo accounts — one click, no password</h2>
          <p className="muted">Pick a role to explore. Sample data is already loaded.</p>
          <DemoLogin users={users} />
        </section>
      )}

      <footer className="container site-foot">
        <p>
          Saathi never prescribes or diagnoses. The clinician's prescription stays authoritative. SAMPLE ONLY — NOT
          MEDICAL ADVICE.
        </p>
      </footer>
    </main>
  );
}
