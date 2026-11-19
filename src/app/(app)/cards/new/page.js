import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF } from "@/lib/perms";
import NewCardForm from "@/components/NewCardForm";

export const metadata = { title: "New card — Saathi" };

export default async function NewCardPage() {
  const user = await getSession();
  if (!user || !STAFF.includes(user.role)) redirect("/dashboard");

  return (
    <>
      <h1>New medicine card</h1>
      <p className="muted">
        Copy the clinician-approved prescription exactly. Choose from approved patterns instead of typing free text. If
        anything is unclear, flag it — never guess.
      </p>
      <NewCardForm />
    </>
  );
}
