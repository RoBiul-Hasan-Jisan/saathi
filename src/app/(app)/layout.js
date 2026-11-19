import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <>
      <Nav user={user} />
      <main className="container">{children}</main>
    </>
  );
}
