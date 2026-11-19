import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { ROLE_LABELS } from "@/lib/demoUsers";
import { STAFF } from "@/lib/perms";

export default function Nav({ user }) {
  return (
    <header className="nav no-print">
      <div className="nav-inner">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">+</span> Saathi
        </Link>
        <nav className="nav-links">
          <Link href="/dashboard">Dashboard</Link>
          {STAFF.includes(user.role) && <Link href="/cards/new">New card</Link>}
          {user.role === "admin" && <Link href="/admin">Admin</Link>}
        </nav>
        <div className="nav-user">
          <span>
            {user.name}
            <small>{ROLE_LABELS[user.role]}{user.demo ? " · demo" : ""}</small>
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
