import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCardById } from "@/lib/store";
import { canViewCard } from "@/lib/perms";
import CardView from "@/components/CardView";
import CardActions from "@/components/CardActions";

export const dynamic = "force-dynamic";

export default async function CardPage({ params }) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");

  const card = await getCardById(id);
  if (!card || !canViewCard(user, card)) notFound();

  return (
    <>
      <CardActions card={card} role={user.role} />
      <CardView card={card} />
    </>
  );
}
