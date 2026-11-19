import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import DemoLogin from "@/components/DemoLogin";
import FirebaseAuthForm from "@/components/FirebaseAuthForm";
import { DEMO_USERS } from "@/lib/demoUsers";

export const metadata = { title: "Sign in — Saathi" };

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect("/dashboard");

  const demoOn = process.env.ENABLE_DEMO !== "false";
  const users = DEMO_USERS.map(({ role, title, blurb }) => ({ role, title, blurb }));

  return (
    <main className="container narrow">
      <Link href="/" className="brand dark">
        <span className="brand-mark">+</span> Saathi
      </Link>
      <h1>Sign in</h1>

      {demoOn && (
        <div className="panel">
          <h2>Demo accounts</h2>
          <p className="muted">One click, instant, no password.</p>
          <DemoLogin users={users} />
        </div>
      )}

      <div className="panel">
        <h2>Email &amp; password</h2>
        <FirebaseAuthForm />
      </div>
    </main>
  );
}
