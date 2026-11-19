"use client";
import { Suspense } from "react";
import NewCardForm from "@/components/NewCardForm";
import { useAuth } from "@/lib/auth";

export default function NewCard() {
  const { user } = useAuth();
  if (user && !["pharmacist", "chw"].includes(user.role)) return <div className="notice warn">Only pharmacy staff and health workers create cards.</div>;
  return <Suspense fallback={<p className="muted">Loading…</p>}><NewCardForm /></Suspense>;
}
